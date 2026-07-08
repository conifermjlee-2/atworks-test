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
        pageRoute = pageRoute.split('app/')[1].replace(/\/page\.(js|jsx|ts|tsx)$/, '');
        pageRoute = '/' + pageRoute;
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

            if (callee.type === 'Identifier' && callee.name === 'fetch') {
              isApiCall = true;
            } else if (callee.type === 'MemberExpression') {
              const obj = callee.object;
              const prop = callee.property;
              if (
                obj.type === 'Identifier' && 
                (obj.name === 'axios' || obj.name === 'api' || obj.name === 'client')
              ) {
                isApiCall = true;
              }
            } else if (callee.type === 'Identifier' && (callee.name === 'useQuery' || callee.name === 'useMutation')) {
              isApiCall = true;
              apiEndpoint = 'ReactQuery Hook';
            }

            if (isApiCall) {
              const arg0 = path.node.arguments[0];
              if (!apiEndpoint && arg0) {
                if (arg0.type === 'StringLiteral') {
                  apiEndpoint = arg0.value;
                } else if (arg0.type === 'TemplateLiteral') {
                  apiEndpoint = arg0.quasis.map((q: any) => q.value.raw).join('${...}');
                } else {
                  apiEndpoint = 'Dynamic URL';
                }
              }

              if (apiEndpoint) {
                fileApis.add(apiEndpoint);
                
                const awaitParent = path.findParent((p: any) => p.isAwaitExpression());
                if (awaitParent) {
                  const blockParent = awaitParent.findParent((p: any) => p.isBlockStatement());
                  if (blockParent) {
                    blockParent.traverse({
                      CallExpression(routePath: any) {
                        checkRouting(routePath, pageRoute, apiEndpoint, flows);
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
                        checkRouting(routePath, pageRoute, apiEndpoint, flows);
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
