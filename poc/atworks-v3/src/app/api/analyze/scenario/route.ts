import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import os from 'os';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// ── Types ────────────────────────────────────────────────────────────────────

type ScreenInfo = {
  route: string;
  page: string;
  filePath: string;
  components: string[];
  onEnterApis: ApiCall[];
  actions: ActionInfo[];
  navigations: string[];
  conditions: string[];
};

type ApiCall = {
  method: string;
  url: string;
  line: number;
  library: string;
  callerName?: string;
  sourceFile?: string; // 이 API가 실제로 선언된 파일 경로
};

type ActionInfo = {
  trigger: string; // onClick, onSubmit, onChange etc.
  handlerName: string;
  apis: ApiCall[];
  navigations: string[];
};

type AppInfo = {
  appName: string;
  appPath: string;
  screens: ScreenInfo[];
};

// ── Static Analysis Helpers ──────────────────────────────────────────────────

function extractString(node: any): string | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral') {
    let str = '';
    node.quasis.forEach((q: any, i: number) => {
      str += q.value.raw;
      if (i < node.expressions.length) {
        const expr = node.expressions[i];
        if (expr.type === 'Identifier') str += `{${expr.name}}`;
        else if (expr.type === 'MemberExpression' && expr.property.type === 'Identifier')
          str += `{${expr.property.name}}`;
        else str += '{param}';
      }
    });
    return str;
  }
  return null;
}

function resolveImportPath(importStr: string, currentFilePath: string, rootPath: string, packageMap?: Record<string, string>): string | null {
  if (importStr.startsWith('@/')) {
    const possiblePaths = [
      path.join(rootPath, 'src', importStr.replace('@/', '')),
      path.join(rootPath, importStr.replace('@/', '')),
    ];
    for (const p of possiblePaths) {
      for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
        if (fs.existsSync(p + ext)) return p + ext;
      }
      if (fs.existsSync(path.join(p, 'index.tsx'))) return path.join(p, 'index.tsx');
    }
    return null;
  } else if (importStr.startsWith('.')) {
    const base = path.join(path.dirname(currentFilePath), importStr);
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      if (fs.existsSync(base + ext)) return base + ext;
    }
    if (fs.existsSync(path.join(base, 'index.tsx'))) return path.join(base, 'index.tsx');
  } else if (packageMap) {
    for (const [pkgName, pkgPath] of Object.entries(packageMap)) {
      if (importStr === pkgName || importStr.startsWith(pkgName + '/')) {
        const subPath = importStr.substring(pkgName.length);
        const baseSrc = path.join(pkgPath, 'src', subPath);
        const baseRoot = path.join(pkgPath, subPath);
        
        for (const possibleBase of [baseSrc, baseRoot]) {
          for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
            if (fs.existsSync(possibleBase + ext)) return possibleBase + ext;
          }
          if (fs.existsSync(path.join(possibleBase, 'index.tsx'))) return path.join(possibleBase, 'index.tsx');
        }
        
        if (subPath === '' || subPath === '/') {
           for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
              if (fs.existsSync(path.join(pkgPath, 'src', 'index' + ext))) return path.join(pkgPath, 'src', 'index' + ext);
              if (fs.existsSync(path.join(pkgPath, 'index' + ext))) return path.join(pkgPath, 'index' + ext);
           }
        }
      }
    }
  }
  return null;
}

function getCallerName(pathNode: any): string {
  const parentFunc = pathNode.findParent((p: any) => 
    p.isFunctionDeclaration() || p.isArrowFunctionExpression() || p.isFunctionExpression()
  );
  if (!parentFunc) return '';
  if (parentFunc.node.id) return parentFunc.node.id.name;
  if (parentFunc.parentPath?.isVariableDeclarator()) return parentFunc.parentPath.node.id.name;
  if (parentFunc.parentPath?.isObjectProperty()) return parentFunc.parentPath.node.key.name;
  return '';
}

function extractApiFetchCalls(ast: any, fileContext: string): ApiCall[] {
  const calls: ApiCall[] = [];
  traverse(ast, {
    CallExpression(pathNode: any) {
      const callee = pathNode.node.callee;
      const line = pathNode.node.loc?.start.line || 0;
      const callerName = getCallerName(pathNode);

      if (callee.type === 'Identifier' && callee.name === 'fetch') {
        const url = extractString(pathNode.node.arguments[0]);
        if (url) {
          let method = 'GET';
          const opts = pathNode.node.arguments[1];
          if (opts?.type === 'ObjectExpression') {
            const mProp = opts.properties.find((p: any) => p.key?.name === 'method') as any;
            if (mProp?.value?.type === 'StringLiteral') method = mProp.value.value.toUpperCase();
          }
          calls.push({ method, url, line, library: 'fetch', callerName });
        }
      }

      if (callee.type === 'MemberExpression') {
        const obj = callee.object.type === 'Identifier' ? callee.object.name : '';
        const prop = callee.property.type === 'Identifier' ? callee.property.name : '';
        if (/axios|api|http|client/i.test(obj) && ['get','post','put','patch','delete'].includes(prop.toLowerCase())) {
          const url = extractString(pathNode.node.arguments[0]) || '[DYNAMIC_URL]';
          calls.push({ method: prop.toUpperCase(), url, line, library: obj, callerName });
        }
      }

      if (callee.type === 'Identifier' && (callee.name === 'useQuery' || callee.name === 'useSWR')) {
        const url = extractString(pathNode.node.arguments[0]);
        if (url && (url.startsWith('/') || url.startsWith('http'))) {
          calls.push({ method: 'GET', url, line, library: callee.name, callerName });
        }
      }
    },
  });
  return calls;
}

function routeFromFilePath(filePath: string, rootPath: string): string {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, '/');
  // Next.js App Router: src/app/about/page.tsx → /about
  const appMatch = rel.match(/(?:src\/)?app\/(.+?)\/page\.[jt]sx?$/);
  if (appMatch) {
    const routePart = appMatch[1]
      .replace(/\[([^\]]+)\]/g, ':$1')
      .replace(/\(.*?\)\//g, ''); // remove route groups
    return '/' + routePart;
  }
  if (rel.match(/(?:src\/)?app\/page\.[jt]sx?$/)) return '/';
  // Pages router
  const pagesMatch = rel.match(/(?:src\/)?pages\/(.+?)\.[jt]sx?$/);
  if (pagesMatch) {
    const routePart = pagesMatch[1]
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1');
    return '/' + routePart;
  }
  return '/' + rel;
}

function analyzeScreenFile(absolutePath: string, rootPath: string, visited = new Set<string>(), packageMap?: Record<string, string>): ScreenInfo | null {
  if (visited.has(absolutePath) || !fs.existsSync(absolutePath)) return null;
  visited.add(absolutePath);

  const rel = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
  const route = routeFromFilePath(absolutePath, rootPath);

  const screen: ScreenInfo = {
    route,
    page: path.basename(absolutePath),
    filePath: rel,
    components: [],
    onEnterApis: [],
    actions: [],
    navigations: [],
    conditions: [],
  };

  let code: string;
  try {
    code = fs.readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }

  let ast: any;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch {
    return null;
  }

  // Extract imported local components
  const localImports: string[] = [];
  traverse(ast, {
    ImportDeclaration(pathNode: any) {
      const src = pathNode.node.source.value;
      const resolved = resolveImportPath(src, absolutePath, rootPath, packageMap);
      if (resolved) {
        const compName = path.basename(resolved, path.extname(resolved));
        if (!['index', 'page', 'layout'].includes(compName.toLowerCase())) {
          screen.components.push(compName);
        }
        localImports.push(resolved);
      }
    },
  });

  // Find all fetch/axios calls in the file
  const allApiCalls = extractApiFetchCalls(ast, rel);

  // Separate useEffect / on-enter calls vs action-handler calls
  // Heuristic: calls inside useEffect → on-enter, inside onClick handlers → actions
  traverse(ast, {
    CallExpression(pathNode: any) {
      const callee = pathNode.node.callee;
      // Detect useEffect
      if (callee.type === 'Identifier' && callee.name === 'useEffect') {
        const cb = pathNode.node.arguments[0];
        if (cb) {
          // Collect api calls inside this useEffect
          const effectCode = code.slice(cb.start, cb.end);
          screen.onEnterApis.push(...allApiCalls.filter(api => {
            // Rough line-based check
            return api.line >= (cb.loc?.start.line || 0) && api.line <= (cb.loc?.end.line || 0);
          }));
        }
      }
    },
  });

  // Detect onClick / onSubmit / onChange handlers
  traverse(ast, {
    JSXAttribute(pathNode: any) {
      const name = pathNode.node.name.name;
      if (!['onClick', 'onSubmit', 'onChange'].includes(name)) return;
      const valueNode = pathNode.node.value;
      if (!valueNode) return;

      // Handler name extraction
      let handlerName = '';
      if (valueNode.type === 'JSXExpressionContainer') {
        const expr = valueNode.expression;
        if (expr.type === 'Identifier') handlerName = expr.name;
        else if (expr.type === 'ArrowFunctionExpression') handlerName = '(inline)';
        else if (expr.type === 'MemberExpression') {
          handlerName = `${expr.object?.name}.${expr.property?.name}`;
        }
      }

      screen.actions.push({
        trigger: name,
        handlerName,
        apis: [],
        navigations: [],
      });
    },
  });

  // Detect router.push / navigate / window.location (navigations)
  traverse(ast, {
    CallExpression(pathNode: any) {
      const callee = pathNode.node.callee;
      if (callee.type === 'MemberExpression') {
        const prop = callee.property?.name || '';
        const obj = callee.object?.name || '';
        if (['push', 'replace', 'navigate'].includes(prop) && (obj === 'router' || obj === 'navigate')) {
          const dest = extractString(pathNode.node.arguments[0]);
          if (dest) screen.navigations.push(dest);
        }
      }
    },
  });

  // Simple condition extraction: ternary / && patterns referencing auth/role/permission
  const conditionKeywords = ['isLoggedIn', 'isAuthenticated', 'token', 'role', 'permission', 'user', 'auth'];
  for (const kw of conditionKeywords) {
    if (code.includes(kw)) screen.conditions.push(kw);
  }

  // APIs not in useEffect → likely in action handlers
  const entryLines = new Set(screen.onEnterApis.map(a => a.line));
  const actionApis = allApiCalls.filter(a => !entryLines.has(a.line));
  
  for (const api of actionApis) {
    if (api.callerName) {
      const matchedAction = screen.actions.find(a => a.handlerName === api.callerName && a.handlerName !== '(inline)' && a.handlerName !== '');
      if (matchedAction) {
        matchedAction.apis.push(api);
        continue;
      }
    }
    
    // 매칭 안되면 독립적인 API로 추가
    screen.actions.push({
      trigger: '(other)',
      handlerName: api.callerName || '(auto-detected)',
      apis: [api],
      navigations: []
    });
  }

  // Recursively process local component imports for deeper APIs
  // compName = 최초 진입 컴포넌트 이름 (e.g. HomeClient)
  // 각 API에는 실제로 선언된 파일(sourceFile)을 기록하여 프론트에서 3단계 트리로 표현 가능
  function traverseForApis(filePath: string, compName: string) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    const childCode = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
    if (!childCode) return;
    try {
      const childAst = parser.parse(childCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
      const childApis = extractApiFetchCalls(childAst, filePath);
      if (childApis.length > 0) {
        // API 각각에 sourceFile 태깅 (어느 파일에서 선언됐는지)
        const taggedApis = childApis.map(api => ({
          ...api,
          sourceFile: path.relative(rootPath, filePath).replace(/\\/g, '/'),
        }));
        // 동일 compName의 기존 action이 있으면 합치고, 없으면 새로 추가
        const existing = screen.actions.find(a => a.trigger === '(component)' && a.handlerName === compName);
        if (existing) {
          existing.apis.push(...taggedApis);
        } else {
          screen.actions.push({
            trigger: '(component)',
            handlerName: compName,
            apis: taggedApis,
            navigations: [],
          });
        }
      }
      
      traverse(childAst, {
        ImportDeclaration(pathNode: any) {
          const src = pathNode.node.source.value;
          const resolved = resolveImportPath(src, filePath, rootPath, packageMap);
          if (resolved && !visited.has(resolved)) {
             traverseForApis(resolved, compName);
          }
        }
      });
    } catch {}
  }

  for (const imp of localImports) {
    if (visited.has(imp)) continue;
    traverseForApis(imp, path.basename(imp, path.extname(imp)));
  }

  return screen;
}

// ── AI Generation ────────────────────────────────────────────────────────────

function buildStaticAnalysisReport(apps: AppInfo[]): string {
  const lines: string[] = ['# 정적 분석 결과 (프론트엔드 화면 흐름)\n'];

  for (const app of apps) {
    lines.push(`## 📱 앱: ${app.appName} (${app.appPath})\n`);
    
    lines.push('### 화면 목록\n');
    for (const s of app.screens) {
      lines.push(`- \`${s.route}\` → \`${s.filePath}\``);
      if (s.components.length > 0) lines.push(`  - 컴포넌트: ${s.components.join(', ')}`);
    }
    lines.push('');

    lines.push('### 화면별 API/액션 상세\n');
    for (const s of app.screens) {
      lines.push(`#### ${s.route} (${s.page})\n`);
      if (s.onEnterApis.length > 0) {
        lines.push('**[화면 진입 시 API 호출]**');
        for (const api of s.onEnterApis) {
          lines.push(`- ${api.method} ${api.url} (line ${api.line})`);
        }
        lines.push('');
      }

      const meaningfulActions = (s.actions || []).filter((a: any) => 
        a.trigger && 
        (
          (a.apis && a.apis.length > 0) || 
          (a.navigations && a.navigations.length > 0) || 
          (a.handlerName && a.handlerName !== '(inline)')
        )
      );

      if (meaningfulActions.length > 0) {
        lines.push('**[사용자 액션 및 컴포넌트 이벤트]**');
        for (const action of meaningfulActions) {
          let handlerText = action.handlerName;
          if (['queryFn', 'mutationFn', 'fetcher'].includes(handlerText)) handlerText = '(데이터 통신 로직)';
          else if (handlerText === '(auto-detected)') handlerText = '(기타 로직)';
          
          const triggerText = action.trigger === '(other)' ? '기타 이벤트' : action.trigger;
          
          lines.push(`- ${triggerText} → ${handlerText}`);
          for (const api of action.apis) {
            lines.push(`  - API: ${api.method} ${api.url} (line ${api.line})`);
          }
          for (const nav of action.navigations) {
            lines.push(`  - 이동: ${nav}`);
          }
        }
        lines.push('');
      }

      if (s.navigations.length > 0) {
        lines.push('**[기타 페이지 이동]**');
        for (const nav of s.navigations) lines.push(`- → ${nav}`);
        lines.push('');
      }
      
      if (s.conditions.length > 0) {
        lines.push('**[조건/권한 관련]**');
        for (const cond of s.conditions) lines.push(`- ${cond}`);
        lines.push('');
      }
      lines.push('---');
    }
  }

  return lines.join('\n');
}

async function generateWithGemini(staticReport: string, projectName: string, referenceLog: string, request: Request): Promise<string> {
  const prompt = `주어진 프론트엔드 정적 분석 결과와 참조 로그를 바탕으로 QA 테스트 시나리오를 JSON 형식으로 작성해 주세요.

[중요 지침]
- 반드시 아래 "JSON STRUCTURE TEMPLATE"과 정확히 일치하는 구조로 JSON 객체를 반환해 주세요. (가장 바깥쪽에 "scenarios" 배열이 있어야 합니다.)
- "actions" 배열 안의 모든 객체는 기술적인 라우팅 필드와 사람이 읽기 쉬운 한국어 "description" 필드를 모두 포함해야 합니다.
- "type"은 'navigate', 'api_call', 'submit' 중 하나여야 합니다.
- "type"이 'api_call'인 경우, "method" (예: GET, POST)와 "endpoint" (예: api/products)를 포함해 주세요.
- "type"이 'navigate' 또는 'submit'인 경우, "target" (예: /, /order)을 포함해 주세요.
- /products/:id 와 같이 경로 파라미터가 필요한 경우, 1, 123, test 같은 가짜 더미(Dummy) 값을 절대 사용하지 마세요.
- 제공된 "Reference Log"를 깊이 분석하여 실제 로그에 존재하는 고유 식별자(UUID 또는 실제 숫자 ID)를 추출한 뒤 경로에 주입해 주세요. (예: /products/a1b2c3d4-...)
- 만약 참조 로그에서 실제 ID를 도저히 찾을 수 없다면, 테스트 실행기가 런타임에 동적으로 처리할 수 있도록 /products/{productId} 와 같이 변수 템플릿 형태로 작성해 주세요.

JSON STRUCTURE TEMPLATE:
{
  "scenarios": [
    {
      "id": "TC-001",
      "title": "상품 조회",
      "description": "상품 조회 시나리오",
      "page": "/",
      "actions": [
        {
          "type": "navigate",
          "target": "/",
          "description": "메인 페이지로 접속하여 테스트를 시작합니다."
        },
        {
          "type": "api_call",
          "method": "GET",
          "endpoint": "api/products",
          "description": "상품 목록 데이터를 불러옵니다."
        }
      ],
      "expectedResult": "목록 노출"
    }
  ]
}

분석할 데이터:
Project Name: ${projectName}
Static Report:
${staticReport}
Reference Log:
${referenceLog}

오직 완성된 JSON 코드 형식으로 응답해 주세요.`;

  try {
    const { execFile } = await import('child_process');
    const util = await import('util');
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const crypto = await import('crypto');
    const execFilePromise = util.promisify(execFile);
    const agyPath = "C:\\Users\\lee\\AppData\\Local\\agy\\bin\\agy.exe";

    const tempFile = path.join(os.tmpdir(), `prompt_${crypto.randomUUID()}.txt`);
    fs.writeFileSync(tempFile, prompt, 'utf-8');

    const agentPrompt = `해당 파일(${tempFile})을 읽고 파일 안에 적힌 모든 지침에 따라 JSON을 생성해 주세요. 반드시 유효한 JSON 형식으로만 응답해야 합니다.`;

    console.log('[AgentAPI] 백엔드에서 agy CLI 직접 실행 중... (파일 프롬프트)');
    let stdout;
    try {
      const result = await execFilePromise(agyPath, ['--print', agentPrompt], { maxBuffer: 10 * 1024 * 1024 });
      stdout = result.stdout;
    } finally {
      try { fs.unlinkSync(tempFile); } catch(e) {}
    }

    console.log(`✅ [AgentAPI] agy 응답 수신 성공! (길이: ${stdout.length}자)`);
    return stdout;
  } catch (error: any) {
    console.error('generateWithGemini CLI Error:', error);
    return `> ⚠️ **API Execution Error:** ${error.message}\n\n## 정적 분석 결과\n\n${staticReport}`;
  }
}

// React Router DOM 라우트 추출 (App.tsx 등에서 <Route path="..." element={<Comp/>}/> 파싱)
function extractReactRouterRoutes(absolutePath: string, rootPath: string, packageMap?: Record<string, string>): Array<{ route: string; componentName: string; componentFile: string | null }> {
  if (!fs.existsSync(absolutePath)) return [];
  let code: string;
  try { code = fs.readFileSync(absolutePath, 'utf-8'); } catch { return []; }
  let ast: any;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch { return []; }

  // Gather local imports: ComponentName → resolvedPath
  const importMap: Record<string, string | null> = {};
  traverse(ast, {
    ImportDeclaration(p: any) {
      const src = p.node.source.value;
      for (const spec of p.node.specifiers) {
        const name = spec.local?.name || spec.imported?.name;
        if (name) {
          importMap[name] = resolveImportPath(src, absolutePath, rootPath, packageMap);
        }
      }
    },
  });

  const routes: Array<{ route: string; componentName: string; componentFile: string | null }> = [];

  // Look for JSX <Route path="..." element={<Component />} />
  traverse(ast, {
    JSXOpeningElement(p: any) {
      const tag = p.node.name?.name || p.node.name?.property?.name || '';
      if (tag !== 'Route') return;

      let routePath: string | null = null;
      let componentName = '';

      for (const attr of p.node.attributes) {
        if (attr.type !== 'JSXAttribute') continue;
        const attrName = attr.name?.name;
        if (attrName === 'path') {
          routePath = extractString(attr.value) || (attr.value?.expression ? '{dynamic}' : null);
        }
        if (attrName === 'element') {
          // element={<PostDetail />} or element={<PostDetail key={x} />}
          const container = attr.value;
          if (container?.type === 'JSXExpressionContainer') {
            const expr = container.expression;
            if (expr?.type === 'JSXElement') {
              componentName = expr.openingElement?.name?.name || '';
            }
          }
        }
        if (attrName === 'component') {
          // Legacy: component={PostDetail}
          const container = attr.value;
          if (container?.type === 'JSXExpressionContainer') {
            componentName = container.expression?.name || '';
          }
        }
      }

      if (routePath && componentName) {
        routes.push({
          route: routePath,
          componentName,
          componentFile: importMap[componentName] || null,
        });
      }
    },
  });

  return routes;
}

// Router 파일 후보 탐색 (App.tsx, router.tsx, routes.tsx 등)
function findRouterFiles(rootPath: string): string[] {
  const candidates = globSync(
    '**/{App,Router,router,routes,AppRouter,index}.{tsx,jsx,ts,js}',
    {
      cwd: rootPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    }
  );
  return candidates.map(f => path.join(rootPath, f));
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let rootPath = '';
    let action = '';
    let staticReport = '';
    let projectName = '';
    let referenceLog = '';

    // 1. Multipart/form-data (ZIP 업로드)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const tempDir = path.join(os.tmpdir(), `atworks-analyzer-${crypto.randomUUID()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      const zip = new AdmZip(buffer);
      zip.extractAllTo(tempDir, true);

      // 압축을 풀었을 때 최상위 폴더가 하나만 있다면 해당 폴더를 루트로 지정
      const entries = fs.readdirSync(tempDir);
      if (entries.length === 1 && fs.statSync(path.join(tempDir, entries[0])).isDirectory()) {
        rootPath = path.join(tempDir, entries[0]);
      } else {
        rootPath = tempDir;
      }
      
      action = 'static'; // ZIP 업로드는 항상 정적 분석 단계부터 시작
      projectName = file.name.replace('.zip', '');
    } 
    else {
      const body = await request.json();
      rootPath = body.rootPath;
      action = body.action;
      staticReport = body.staticReport;
      projectName = body.projectName || 'Frontend Project';
      referenceLog = body.referenceLog || '';
    }

    // 2단계: AI 시나리오 생성
    if (action === 'ai') {
      if (!staticReport) {
        return NextResponse.json({ error: 'staticReport is required for AI generation' }, { status: 400 });
      }
      
      // 파이프라인을 사용하므로 전체 리포트를 그대로 사용 가능
      const aiResult = await generateWithGemini(staticReport, projectName || 'Frontend Project', referenceLog, request);
      try {
        let parsed = null;

        // Vigorously parse out only the JSON part to strip any conversational text
        let cleanedResult = aiResult;
        const firstMatch = aiResult.match(/[\{\[]/);
        if (firstMatch && firstMatch.index !== undefined) {
          const startIdx = firstMatch.index;
          const lastBrace = aiResult.lastIndexOf('}');
          const lastBracket = aiResult.lastIndexOf(']');
          const endIdx = Math.max(lastBrace, lastBracket);
          if (endIdx > startIdx) {
            cleanedResult = aiResult.substring(startIdx, endIdx + 1);
          }
        }
        
        // 1. Try to extract markdown block from the cleaned result
        const markdownMatch = cleanedResult.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (markdownMatch) {
          try {
            parsed = JSON.parse(markdownMatch[1].trim());
          } catch(e) {}
        }
        
        // 2. Try parsing the cleaned result directly
        if (!parsed) {
          try {
            parsed = JSON.parse(cleanedResult);
          } catch(e) {}
        }
        
        // 3. Fallback to original aiResult
        if (!parsed) {
           parsed = JSON.parse(aiResult);
        }
        
        // AI가 [ { ... } ] 형태로 주거나 { scenarios: [ ... ] } 형태로 줄 수 있음
        let scenariosArray = Array.isArray(parsed) ? parsed : (parsed.scenarios || [parsed]);
        
        return NextResponse.json({ 
          scenarios: scenariosArray,
          rawOutput: aiResult 
        });
      } catch(e) {
        console.error("Failed to parse AI JSON:", aiResult);
        return NextResponse.json({ 
          error: 'AI did not return valid JSON', 
          rawOutput: aiResult 
        }, { status: 500 });
      }
    }
    
    // 실시간 로그 조회 (저장 시점 등에서 호출)
    if (action === 'get-logs') {
      if (!rootPath || !fs.existsSync(rootPath)) {
        return NextResponse.json({ error: 'Invalid or missing rootPath' }, { status: 400 });
      }
      let logs = null;
      const logPath = path.join(rootPath, 'log', 'api_logs.json');
      if (fs.existsSync(logPath)) {
        try {
          logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        } catch (e) {
          console.warn('Failed to parse api_logs.json:', e);
        }
      }
      return NextResponse.json({ apiLogs: logs });
    }

    // 1단계: 정적 분석 수행
    if (!rootPath || !fs.existsSync(rootPath)) {
      return NextResponse.json({ error: 'Invalid or missing rootPath' }, { status: 400 });
    }

    // 모노레포 패키지 맵 구성 (resolveImportPath 개선을 위해)
    const packageJsonFiles = globSync('**/package.json', {
      cwd: rootPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
    });

    const packageMap: Record<string, string> = {};
    const frontendApps: Array<{ appName: string; appPath: string; absolutePath: string }> = [];

    for (const pkgFile of packageJsonFiles) {
      const absPath = path.join(rootPath, pkgFile);
      const dirPath = path.dirname(absPath);
      try {
        const pkgContent = JSON.parse(fs.readFileSync(absPath, 'utf8'));
        if (pkgContent.name) {
          packageMap[pkgContent.name] = dirPath;
        }
        
        const deps = { ...(pkgContent.dependencies || {}), ...(pkgContent.devDependencies || {}) };
        if (deps['next'] || deps['react'] || deps['react-dom'] || deps['react-native']) {
          const appName = pkgContent.name || path.basename(dirPath);
          const relativePath = path.relative(rootPath, dirPath).replace(/\\/g, '/') || '.';
          
          frontendApps.push({
            appName,
            appPath: relativePath,
            absolutePath: dirPath
          });
        }
      } catch(e) {}
    }

    if (frontendApps.length === 0) {
      frontendApps.push({
        appName: path.basename(rootPath),
        appPath: '.',
        absolutePath: rootPath
      });
    }

    const apps: AppInfo[] = [];

    for (const app of frontendApps) {
      const appRoot = app.absolutePath;
      const screens: ScreenInfo[] = [];
      const visited = new Set<string>();

      // ── 전략 1: React Router DOM 탐지 ────────────────────────────────────────
      const routerFiles = findRouterFiles(appRoot);
      let reactRouterScreens: ScreenInfo[] = [];

      for (const routerFile of routerFiles) {
        const routes = extractReactRouterRoutes(routerFile, appRoot, packageMap);
        if (routes.length === 0) continue;

        for (const { route, componentName, componentFile } of routes) {
          const targetFile = componentFile || null;
          if (!targetFile || visited.has(targetFile)) continue;

          const screen = analyzeScreenFile(targetFile, appRoot, new Set(visited), packageMap);
          if (screen) {
            screen.route = route;
            screen.page = componentName;
            reactRouterScreens.push(screen);
            visited.add(targetFile);
          }
        }
      }

      if (reactRouterScreens.length > 0) {
        screens.push(...reactRouterScreens);
      }

      // ── 전략 2: Next.js 파일시스템 라우팅 탐지 ──────────────────────────────
      if (screens.length === 0) {
        const pageFiles = globSync('**/{app,pages,src/app,src/pages}/**/{page.tsx,page.jsx,index.tsx,index.jsx}', {
          cwd: appRoot,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
        });

        for (const file of pageFiles) {
          const absolutePath = path.join(appRoot, file);
          if (visited.has(absolutePath)) continue;
          const screen = analyzeScreenFile(absolutePath, appRoot, new Set(visited), packageMap);
          if (screen) screens.push(screen);
        }
      }

      // ── 전략 3: 폴백 — 전체 컴포넌트 스캔 ───────────────────────────────────
      if (screens.length === 0) {
        const allFiles = globSync('**/*.{tsx,jsx}', {
          cwd: appRoot,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
        });

        for (const file of allFiles) {
          const absolutePath = path.join(appRoot, file);
          if (visited.has(absolutePath)) continue;
          const screen = analyzeScreenFile(absolutePath, appRoot, new Set(visited), packageMap);
          if (screen) screens.push(screen);
          if (screens.length >= 20) break; // 너무 많으면 상위만
        }
      }
      
      if (screens.length > 0) {
        apps.push({
          appName: app.appName,
          appPath: app.appPath,
          screens
        });
      }
    }

    if (apps.length === 0) {
      return NextResponse.json({ error: '분석 가능한 화면 파일을 찾지 못했습니다. 경로를 확인해주세요.' }, { status: 404 });
    }

    const staticReportResult = buildStaticAnalysisReport(apps);
    const resolvedProjectName = path.basename(rootPath);
    
    let apiLogs = null;
    const logPath = path.join(rootPath, 'log', 'api_logs.json');
    if (fs.existsSync(logPath)) {
      try {
        apiLogs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      } catch (e) {
        console.warn('Failed to parse api_logs.json:', e);
      }
    }

    return NextResponse.json({ 
      apps,
      staticReport: staticReportResult,
      projectName: resolvedProjectName,
      apiLogs
    });
  } catch (err: any) {
    console.error('Scenario analysis error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

 

