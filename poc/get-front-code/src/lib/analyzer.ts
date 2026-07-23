import simpleGit from 'simple-git';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// CommonJS interop for babel traverse
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as any).default;

interface ApiMapping {
  page: string;
  endpoints: string[];
}

interface ApiFlow {
  page: string;
  api: string;
  nextPage: string;
}

export async function analyzeRepo(repoUrl: string): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-front-code-'));
  const git = simpleGit();

  try {
    // 1. Clone repository
    await git.clone(repoUrl, tempDir);

    // 2. Find all js/ts files
    const files = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: tempDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
    });

    const viewMappings = new Map<string, Set<string>>();
    const flows: ApiFlow[] = [];

    // 3. Analyze each file
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const code = fs.readFileSync(filePath, 'utf-8');

      let pageRoute = file.replace(/\\/g, '/');
      if (pageRoute.includes('src/pages/') || pageRoute.includes('pages/')) {
        pageRoute = pageRoute.split('pages/')[1].replace(/\.(js|jsx|ts|tsx)$/, '');
        if (pageRoute === 'index') pageRoute = '/';
        else pageRoute = '/' + pageRoute;
      } else if (pageRoute.includes('src/app/') || pageRoute.includes('app/')) {
        let appRoute = pageRoute.split('app/')[1];
        appRoute = appRoute.replace(/(^|\/)page\.(js|jsx|ts|tsx)$/, '');
        pageRoute = appRoute ? '/' + appRoute : '/';
      } else {
        pageRoute = path.basename(file);
      }

      try {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'decorators-legacy']
        });

        const fileApis = new Set<string>();

        traverse(ast, {
          CallExpression(path: any) {
            const callee = path.node.callee;
            let isApiCall = false;
            let apiEndpoint = '';

            let apiMethod = 'GET';
            if (callee.type === 'Identifier' && callee.name === 'fetch') {
              isApiCall = true;
              const options = path.node.arguments[1];
              if (options && options.type === 'ObjectExpression') {
                const methodProp = options.properties.find((p: any) => p.key && (p.key.name === 'method' || p.key.value === 'method'));
                if (methodProp && methodProp.value.type === 'StringLiteral') {
                  apiMethod = methodProp.value.value.toUpperCase();
                }
              }
            } else if (callee.type === 'MemberExpression') {
              const obj = callee.object;
              const prop = callee.property;
              if (
                obj.type === 'Identifier' && 
                (obj.name === 'axios' || obj.name === 'api' || obj.name === 'client')
              ) {
                isApiCall = true;
                if (prop.type === 'Identifier' && ['get', 'post', 'put', 'delete', 'patch'].includes(prop.name)) {
                  apiMethod = prop.name.toUpperCase();
                }
              }
            } else if (callee.type === 'Identifier' && (callee.name === 'useQuery')) {
              isApiCall = true;
              apiMethod = 'GET';
              apiEndpoint = 'ReactQuery Hook';
            } else if (callee.type === 'Identifier' && (callee.name === 'useMutation')) {
              isApiCall = true;
              apiMethod = 'MUTATION';
              apiEndpoint = 'ReactQuery Hook';
            }

            if (isApiCall) {
              const arg0 = path.node.arguments[0];
              if (!apiEndpoint && arg0) {
                if (arg0.type === 'StringLiteral') {
                  apiEndpoint = arg0.value;
                } else if (arg0.type === 'TemplateLiteral') {
                  let templateStr = '';
                  arg0.quasis.forEach((q: any, i: number) => {
                    templateStr += q.value.raw;
                    if (i < arg0.expressions.length) {
                      const expr = arg0.expressions[i];
                      if (expr.type === 'Identifier') {
                        templateStr += `\${${expr.name}}`;
                      } else if (expr.type === 'MemberExpression' && expr.property.type === 'Identifier') {
                        templateStr += `\${...${expr.property.name}}`;
                      } else {
                        templateStr += '${...}';
                      }
                    }
                  });
                  apiEndpoint = templateStr;
                } else if (arg0.type === 'Identifier') {
                  const binding = path.scope.getBinding(arg0.name);
                  let resolved = false;
                  if (binding && binding.path.isVariableDeclarator()) {
                    const init = binding.path.node.init;
                    if (init) {
                      if (init.type === 'StringLiteral') {
                        apiEndpoint = init.value;
                        resolved = true;
                      } else if (init.type === 'TemplateLiteral') {
                        let templateStr = '';
                        init.quasis.forEach((q: any, i: number) => {
                          templateStr += q.value.raw;
                          if (i < init.expressions.length) {
                            const expr = init.expressions[i];
                            if (expr.type === 'Identifier') {
                              templateStr += `\${${expr.name}}`;
                            } else if (expr.type === 'MemberExpression' && expr.property.type === 'Identifier') {
                              templateStr += `\${...${expr.property.name}}`;
                            } else {
                              templateStr += '${...}';
                            }
                          }
                        });
                        apiEndpoint = templateStr;
                        resolved = true;
                      }
                    }
                  }
                  if (!resolved) {
                    let origin = '';
                    if (binding) {
                      if (binding.kind === 'module') origin = ' (Import됨)';
                      else if (binding.kind === 'param') origin = ' (파라미터/Prop)';
                      else origin = ` (Line ${binding.path.node.loc?.start.line || '?'})`;
                    } else {
                      origin = ' (전역/외부변수)';
                    }
                    apiEndpoint = `{변수: ${arg0.name}${origin}}`;
                  }
                } else if (arg0.type === 'MemberExpression') {
                  apiEndpoint = `{객체속성 참조}`;
                } else if (arg0.type === 'BinaryExpression') {
                  apiEndpoint = `{문자열 연산 조합}`;
                } else if (arg0.type === 'CallExpression') {
                  const calleeName = arg0.callee.type === 'Identifier' ? arg0.callee.name : '함수';
                  apiEndpoint = `{함수호출: ${calleeName}()}`;
                } else if (arg0.type === 'ConditionalExpression' || arg0.type === 'LogicalExpression') {
                  apiEndpoint = `{조건부 URL}`;
                } else {
                  apiEndpoint = `{동적 할당 (Dynamic URL)}`;
                }
              }

              if (apiEndpoint) {
                const fullEndpoint = `[${apiMethod}] ${apiEndpoint}`;
                fileApis.add(fullEndpoint);
                
                const awaitParent = path.findParent((p: any) => p.isAwaitExpression());
                if (awaitParent) {
                  const blockParent = awaitParent.findParent((p: any) => p.isBlockStatement());
                  if (blockParent) {
                    blockParent.traverse({
                      CallExpression(routePath: any) {
                        checkRouting(routePath, pageRoute, fullEndpoint, flows);
                      }
                    });
                  }
                }
                
                const memberParent = path.findParent((p: any) => p.isMemberExpression() && p.node.property.type === 'Identifier' && p.node.property.name === 'then');
                if (memberParent) {
                  const callParent = memberParent.parentPath;
                  if (callParent && callParent.isCallExpression()) {
                    callParent.traverse({
                      CallExpression(routePath: any) {
                        checkRouting(routePath, pageRoute, fullEndpoint, flows);
                      }
                    });
                  }
                }
              }
            }
          }
        });

        if (fileApis.size > 0) {
          viewMappings.set(pageRoute, fileApis);
        }

      } catch (err) {
        // skip parse errors
      }
    }

    let markdown = '# 📊 Frontend Code Analysis Result\n\n';
    
    markdown += '## 1. API 화면 묶음 (View-API Mapping)\n\n';

    if (viewMappings.size === 0) {
      markdown += '> 발견된 API 호출 내역이 없습니다.\n\n';
    } else {
      for (const [page, apis] of Array.from(viewMappings.entries())) {
        markdown += `### 🖥️ 화면: \`${page}\`\n`;
        for (const api of Array.from(apis)) {
          markdown += `- \`${api}\`\n`;
        }
        markdown += '\n';
      }
    }

    markdown += '## 2. API Flow (Cross-Screen Flow)\n\n';
    if (flows.length === 0) {
      markdown += '> 발견된 화면 간 이동(Flow)이 없습니다.\n\n';
    } else {
      flows.forEach((flow, idx) => {
        markdown += `### 🔄 Flow ${idx + 1}\n`;
        markdown += `1. **\`${flow.page}\`**\n`;
        markdown += `   - \`${flow.api}\` 호출 성공 시 ➡️ **\`${flow.nextPage}\` 으로 이동**\n\n`;
      });
    }

    return markdown;

  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function checkRouting(path: any, pageRoute: string, apiEndpoint: string, flows: ApiFlow[]) {
  const callee = path.node.callee;
  let nextPage = '';

  if (callee.type === 'MemberExpression') {
    const obj = callee.object;
    const prop = callee.property;
    if (obj.type === 'Identifier' && (obj.name === 'router' || obj.name === 'history') && prop.type === 'Identifier' && (prop.name === 'push' || prop.name === 'replace')) {
      const arg0 = path.node.arguments[0];
      if (arg0 && arg0.type === 'StringLiteral') {
        nextPage = arg0.value;
      }
    }
  } else if (callee.type === 'Identifier' && callee.name === 'navigate') {
    const arg0 = path.node.arguments[0];
    if (arg0 && arg0.type === 'StringLiteral') {
      nextPage = arg0.value;
    }
  }

  if (nextPage) {
    const exists = flows.some(f => f.page === pageRoute && f.api === apiEndpoint && f.nextPage === nextPage);
    if (!exists) {
      flows.push({ page: pageRoute, api: apiEndpoint, nextPage });
    }
  }
}
