import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as fs from 'fs';
import * as path from 'path';
import { ApiCallInfo, HookResolver } from '../../types';
import { isAllowedUrl } from './filter';
import { parseFile } from './ast-parser';

interface ImportInfo {
  importedName: string;
  sourcePath: string;
}

/**
 * tsconfig.json / tsconfig.base.json의 compilerOptions.paths 동적 파싱
 */
function loadTsconfigPaths(rootDir: string): Map<string, string[]> {
  const pathMap = new Map<string, string[]>();
  const candidates = [
    path.join(rootDir, 'tsconfig.json'),
    path.join(rootDir, 'tsconfig.base.json'),
    path.resolve(rootDir, '..', 'tsconfig.json'),
    path.resolve(rootDir, '..', 'tsconfig.base.json'),
    path.resolve(rootDir, '../..', 'tsconfig.json'),
    path.resolve(rootDir, '../..', 'tsconfig.base.json'),
  ];

  for (const configFile of candidates) {
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf-8');
        const clean = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const json = JSON.parse(clean);
        const paths = json.compilerOptions?.paths || {};
        const configDir = path.dirname(configFile);

        for (const [pattern, targetArray] of Object.entries(paths)) {
          if (Array.isArray(targetArray)) {
            const resolvedTargets = targetArray.map(tStr => path.resolve(configDir, tStr));
            pathMap.set(pattern, resolvedTargets);
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }
  }
  return pathMap;
}

/**
 * 상위 루트 디렉터리 동적 추적 (모노레포 깊이에 상관없이 상위 5단계까지 자동 탐색)
 */
function getPossibleMonorepoRoots(startDir: string): string[] {
  const bases: string[] = [];
  let curr = path.resolve(startDir);
  for (let i = 0; i < 5; i++) {
    bases.push(curr);
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return bases;
}

/**
 * 컴포넌트에 사용된 import 항목 정보 수집
 */
function buildImportMap(ast: t.File): Map<string, ImportInfo> {
  const importMap = new Map<string, ImportInfo>();

  traverse(ast, {
    ImportDeclaration(p) {
      const sourcePath = p.node.source.value;
      for (const specifier of p.node.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          const importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
          const localName = specifier.local.name;
          importMap.set(localName, { importedName, sourcePath });
        } else if (t.isImportDefaultSpecifier(specifier)) {
          const localName = specifier.local.name;
          importMap.set(localName, { importedName: 'default', sourcePath });
        }
      }
    }
  });

  return importMap;
}

/**
 * TypeScript 컴파일러(tsc) 규격 준수 100% 범용 경로 해석기 (Generic Path Resolver)
 */
function resolveFilePath(currentFilePath: string, sourcePath: string, rootDir: string): string | null {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

  // [방법 1] tsconfig.json의 compilerOptions.paths 동적 해석 (공식 TS 표준)
  const tsconfigPaths = loadTsconfigPaths(rootDir);
  for (const [pattern, targetTargets] of tsconfigPaths.entries()) {
    const cleanPattern = pattern.replace(/\/\*$/, '');
    if (sourcePath === cleanPattern || sourcePath.startsWith(cleanPattern + '/')) {
      const sub = sourcePath.slice(cleanPattern.length).replace(/^\//, '');
      for (const targetBase of targetTargets) {
        const cleanBase = targetBase.replace(/\/\*$/, '');
        const candidate = sub ? path.join(cleanBase, sub) : cleanBase;

        for (const ext of extensions) {
          const fullPath = candidate + ext;
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            return fullPath;
          }
        }
      }
    }
  }

  let targetPath = '';

  // [방법 2] 상대 경로 (./, ../, ../../../ 등)
  if (sourcePath.startsWith('.')) {
    targetPath = path.resolve(path.dirname(currentFilePath), sourcePath);
  }
  // [방법 3] 표준 소스 별칭 (@/, ~/)
  else if (sourcePath.startsWith('@/') || sourcePath.startsWith('~/')) {
    targetPath = path.join(rootDir, 'src', sourcePath.slice(2));
  }
  // [방법 4] 범용 모노레포 및 node_modules 외부/공통 패키지 추적
  else if (sourcePath.startsWith('@') || !sourcePath.includes(':')) {
    const possibleBases = getPossibleMonorepoRoots(rootDir);

    const parts = sourcePath.split('/');
    const pkgFolder = sourcePath.startsWith('@') ? parts[1] : parts[0];
    const subPath = sourcePath.startsWith('@') ? parts.slice(2).join('/') : parts.slice(1).join('/');

    if (!pkgFolder) return null;

    let found: string | null = null;
    const workspaceFolders = ['packages', 'libs', 'modules', 'shared', 'apps'];

    // 4-1. 모노레포 워크스페이스 폴더 탐색
    for (const baseDir of possibleBases) {
      for (const wsFolder of workspaceFolders) {
        const candidateDir = path.join(baseDir, wsFolder, pkgFolder);
        if (fs.existsSync(candidateDir)) {
          const trySrc = path.join(candidateDir, 'src', subPath);
          const tryDirect = path.join(candidateDir, subPath);
          if (fs.existsSync(trySrc)) {
            found = trySrc;
            break;
          } else if (fs.existsSync(tryDirect)) {
            found = tryDirect;
            break;
          }
        }
      }
      if (found) break;
    }

    // 4-2. node_modules 외부/공통 패키지 탐색
    if (!found) {
      for (const baseDir of possibleBases) {
        const nmDir = path.join(baseDir, 'node_modules', sourcePath);
        if (fs.existsSync(nmDir)) {
          const pkgJsonPath = path.join(nmDir, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            try {
              const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
              const entry = pkgJson.module || pkgJson.main;
              if (entry) {
                const entryPath = path.join(nmDir, entry);
                if (fs.existsSync(entryPath)) {
                  found = entryPath;
                  break;
                }
              }
            } catch (e) {}
          }
          for (const ext of extensions) {
            const tryNm = nmDir + ext;
            if (fs.existsSync(tryNm) && fs.statSync(tryNm).isFile()) {
              found = tryNm;
              break;
            }
          }
        }
        if (found) break;
      }
    }

    if (found) {
      targetPath = found;
    } else {
      return null;
    }
  } else {
    return null;
  }

  for (const ext of extensions) {
    const fullPath = targetPath + ext;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  return null;
}

/**
 * 타겟 파일 내에서 특정 함수/변수 심볼 노드 정밀 추출 (재내보내기 Re-export 추적 지원)
 */
function resolveSymbolAstNode(
  targetAst: t.File,
  functionName: string,
  targetFilePath: string,
  rootDir: string,
  visited: Set<string> = new Set()
): { ast: t.File; file: string } | null {
  if (visited.has(targetFilePath)) return null;
  visited.add(targetFilePath);

  let foundNode: t.Statement | null = null;
  let reExportSource: string | null = null;
  const exportAllSources: string[] = [];

  traverse(targetAst, {
    FunctionDeclaration(p) {
      if (p.node.id?.name === functionName) {
        foundNode = p.node;
        p.stop();
      }
    },
    VariableDeclarator(p) {
      if (t.isIdentifier(p.node.id) && p.node.id.name === functionName && p.node.init) {
        if (t.isFunction(p.node.init) || t.isArrowFunctionExpression(p.node.init)) {
          foundNode = t.expressionStatement(p.node.init);
          p.stop();
        }
      }
    },
    ExportNamedDeclaration(p) {
      if (p.node.source) {
        for (const spec of p.node.specifiers) {
          if (t.isExportSpecifier(spec)) {
            const exportedName = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
            if (exportedName === functionName) {
              reExportSource = p.node.source.value;
              p.stop();
            }
          }
        }
      }
    },
    ExportAllDeclaration(p) {
      if (p.node.source) {
        exportAllSources.push(p.node.source.value);
      }
    }
  });

  if (foundNode) {
    return { ast: t.file(t.program([foundNode])), file: targetFilePath };
  }

  // ES6+ Named Re-export (export { fn } from 'module') 표준 구문 추적
  if (reExportSource) {
    const nextFile = resolveFilePath(targetFilePath, reExportSource, rootDir);
    if (nextFile) {
      const nextAst = parseFile(nextFile);
      if (nextAst) {
        return resolveSymbolAstNode(nextAst, functionName, nextFile, rootDir, visited);
      }
    }
  }

  // ES6+ Export-All (export * from 'module') 표준 Barrel 구문 연쇄 추적
  for (const exportAllSrc of exportAllSources) {
    const nextFile = resolveFilePath(targetFilePath, exportAllSrc, rootDir);
    if (nextFile) {
      const nextAst = parseFile(nextFile);
      if (nextAst) {
        const res = resolveSymbolAstNode(nextAst, functionName, nextFile, rootDir, visited);
        if (res) return res;
      }
    }
  }

  return null;
}

/**
 * 범용 정밀 심볼 역추적 (Symbol Tracing - Re-export Barrel 패턴 완벽 지원)
 */
export function findApiCalls(
  ast: t.File,
  resolvers: HookResolver[] = [],
  currentFilePath?: string,
  rootDir?: string,
  visitedFiles: Set<string> = new Set()
): ApiCallInfo[] {
  const calls: ApiCallInfo[] = [];
  const importMap = buildImportMap(ast);

  if (currentFilePath) {
    visitedFiles.add(currentFilePath);
  }

  traverse(ast, {
    CallExpression(p) {
      const { node } = p;
      const callee = node.callee;
      let calleeName = '';

      if (t.isIdentifier(callee)) {
        calleeName = callee.name;
      } else if (t.isMemberExpression(callee)) {
        if (t.isIdentifier(callee.object)) {
          calleeName = callee.object.name;
        }
        if (t.isIdentifier(callee.property)) {
          calleeName += `.${callee.property.name}`;
        }
      }

      if (!calleeName) return;

      // 1단계: 플러그인 리졸버 검사 (Scope AST 전달하여 변수 추적 지원)
      for (const resolver of resolvers) {
        const result = resolver.resolve(calleeName, node.arguments as any[], ast);
        if (result) {
          if (result.endpoint && isAllowedUrl(result.endpoint)) {
            calls.push({ ...result, calleeName }); // calleeName 바인딩
            p.skip();
            return;
          }
          continue;
        }
      }

      // 2단계: 범용 import 심볼 역추적 (Symbol Tracing - Re-export barrel 패턴 연쇄 추적)
      if (currentFilePath && rootDir && importMap.has(calleeName)) {
        const { importedName, sourcePath } = importMap.get(calleeName)!;
        const targetFile = resolveFilePath(currentFilePath, sourcePath, rootDir);

        if (targetFile && !visitedFiles.has(targetFile)) {
          const targetAst = parseFile(targetFile);
          if (targetAst) {
            // Re-export Barrel 패턴(export * from './...')까지 연쇄 심볼 추적
            const resolvedSymbol = resolveSymbolAstNode(targetAst, importedName, targetFile, rootDir, new Set(visitedFiles));
            const subAst = resolvedSymbol ? resolvedSymbol.ast : targetAst;
            const subFile = resolvedSymbol ? resolvedSymbol.file : targetFile;

            const subCalls = findApiCalls(subAst, resolvers, subFile, rootDir, new Set(visitedFiles));
            if (subCalls.length > 0) {
              calls.push(...subCalls);
              p.skip();
            }
          }
        }
      }
    }
  });

  return calls;
}

// ── 시나리오 흐름 추출 헬퍼 ─────────────────────────────────────

/** CallExpression에서 calleeName 문자열 추출 */
function extractCalleeName(callee: t.Expression | t.V8IntrinsicIdentifier): string {
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee)) {
    const obj = t.isIdentifier(callee.object) ? callee.object.name : '';
    const prop = t.isIdentifier(callee.property) ? callee.property.name : '';
    return obj && prop ? `${obj}.${prop}` : obj || prop;
  }
  return '';
}

/** 노드에서 문자열 리터럴 값 추출 (캐시 키 등) */
function extractStringLiteral(node: t.Node): string | null {
  if (t.isStringLiteral(node)) return node.value;
  if (t.isTemplateLiteral(node) && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? null;
  }
  return null;
}

/** Array 노드에서 캐시 키 추출 (예: ['cart', userId]) */
function extractQueryKey(node: t.Node): string {
  if (t.isArrayExpression(node)) {
    return node.elements
      .map(el => (el ? extractStringLiteral(el) ?? '...' : ''))
      .filter(Boolean)
      .join(', ');
  }
  return extractStringLiteral(node) ?? '?';
}

/** 이벤트 핸들러 함수명 추출: onClick={handleFoo} → "handleFoo" */
function extractEventHandlerName(path: any): string | null {
  const jsxAttr = path.findParent((p: any) => p.isJSXAttribute());
  if (jsxAttr) {
    const name = jsxAttr.node.name;
    if (t.isJSXIdentifier(name)) return name.name; // onClick, onSubmit ...
  }
  return null;
}

/** BlockStatement 내의 모든 API 콜을 line 순서대로 수집 (심볼 역추적 포함) */
function collectApiCallsInBlock(
  blockNode: t.BlockStatement,
  resolvers: HookResolver[],
  ast: t.File,
  importMap?: Map<string, { importedName: string; sourcePath: string }>,
  currentFilePath?: string,
  rootDir?: string
): { order: number; method: string; endpoint: string }[] {
  const results: { order: number; method: string; endpoint: string; line: number }[] = [];
  let order = 0;

  traverse(t.file(t.program([t.expressionStatement(t.arrowFunctionExpression([], blockNode))])), {
    CallExpression(p) {
      const calleeName = extractCalleeName(p.node.callee as t.Expression);
      if (!calleeName) return;

      // 1단계: 리졸버 직접 매칭
      for (const resolver of resolvers) {
        const resolved = resolver.resolve(calleeName, p.node.arguments as any[], ast);
        if (resolved && resolved.endpoint && isAllowedUrl(resolved.endpoint)) {
          results.push({
            order: order++,
            method: resolved.method,
            endpoint: resolved.endpoint,
            line: p.node.loc?.start.line ?? 0,
          });
          p.skip();
          return;
        }
      }

      // 2단계: import 심볼 역추적 — 파일 전체가 아닌 해당 함수만 정밀 추출
      if (importMap && currentFilePath && rootDir && importMap.has(calleeName)) {
        const { importedName, sourcePath } = importMap.get(calleeName)!;
        const targetFile = resolveFilePath(currentFilePath, sourcePath, rootDir);
        if (targetFile) {
          const targetAst = parseFile(targetFile);
          if (targetAst) {
            // ★ 핵심 수정: 파일 전체(findApiCalls) 대신 심볼 함수만(resolveSymbolAstNode) 추출
            const resolved = resolveSymbolAstNode(targetAst, importedName, targetFile, rootDir);
            const subAst = resolved ? resolved.ast : null;
            if (subAst) {
              const subCalls = findApiCalls(subAst, resolvers, resolved!.file, rootDir);
              for (const call of subCalls) {
                if (call.endpoint && isAllowedUrl(call.endpoint)) {
                  results.push({
                    order: order++,
                    method: call.method,
                    endpoint: call.endpoint,
                    line: p.node.loc?.start.line ?? 0,
                  });
                }
              }
              if (subCalls.length > 0) {
                p.skip();
                return;
              }
            }
          }
        }
      }
    },
  });

  // line 기준 정렬 후 order 재부여
  results.sort((a, b) => a.line - b.line);
  return results.map((r, i) => ({ order: i + 1, method: r.method, endpoint: r.endpoint }));
}

/** invalidateQueries / mutate 로 refetch 되는 쿼리 키를 수집 (ObjectExpression 옵션 형태 포함) */
function collectRefetchKeys(node: t.BlockStatement | t.ObjectExpression): string[] {
  const keys: string[] = [];

  // ObjectExpression인 경우 (useMutation 옵션 객체): onSuccess 프로퍼티 내부를 탐색
  const nodesToSearch: t.Node[] = [];
  if (t.isObjectExpression(node)) {
    for (const prop of node.properties) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        (prop.key.name === 'onSuccess' || prop.key.name === 'onSettled')
      ) {
        nodesToSearch.push(prop.value);
      }
    }
  } else {
    nodesToSearch.push(node);
  }

  for (const searchNode of nodesToSearch) {
    const wrapper = t.isBlockStatement(searchNode)
      ? t.file(t.program([t.expressionStatement(t.arrowFunctionExpression([], searchNode as t.BlockStatement))]))
      : t.isExpression(searchNode)
        ? t.file(t.program([t.expressionStatement(searchNode as t.Expression)]))
        : null;
    if (!wrapper) continue;

    traverse(wrapper, {
      CallExpression(p) {
        const calleeName = extractCalleeName(p.node.callee as t.Expression);
        if (
          calleeName === 'queryClient.invalidateQueries' ||
          calleeName === 'queryClient.resetQueries' ||
          calleeName === 'mutate' ||
          calleeName === 'revalidate'
        ) {
          const firstArg = p.node.arguments[0];
          if (firstArg) {
            if (t.isObjectExpression(firstArg)) {
              for (const prop of firstArg.properties) {
                if (
                  t.isObjectProperty(prop) &&
                  t.isIdentifier(prop.key) &&
                  prop.key.name === 'queryKey'
                ) {
                  keys.push(extractQueryKey(prop.value as t.Node));
                }
              }
            } else {
              keys.push(extractQueryKey(firstArg));
            }
          }
        }
      },
    });
  }

  return [...new Set(keys)];
}

import { ScenarioFlow } from '../../types';

/**
 * 파일 AST에서 시나리오 흐름을 추출합니다.
 * - MOUNT: useEffect / useQuery 내부 API 호출
 * - EVENT: JSX 이벤트 핸들러(onClick 등) 또는 useMutation 내부 API 호출
 */
export function findScenarios(
  ast: t.File,
  resolvers: HookResolver[],
  filePath: string,
  rootDir: string
): ScenarioFlow[] {
  const scenarios: ScenarioFlow[] = [];
  const pathModule = require('path');
  const viewName = pathModule.basename(filePath, pathModule.extname(filePath));
  const relativePath = pathModule.relative(rootDir, filePath).replace(/\\/g, '/');
  const importMap = buildImportMap(ast);

  const MOUNT_HOOKS = new Set(['useEffect', 'useQuery', 'useInfiniteQuery', 'useSWR', 'useQueries']);
  const EVENT_HOOKS = new Set(['useMutation', 'useCallback']);

  /** 함수 노드(화살표/일반)로부터 BlockStatement를 추출 */
  function getBlock(node: t.Node): t.BlockStatement | null {
    if (
      (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) &&
      t.isBlockStatement(node.body)
    ) return node.body;
    return null;
  }

  /** ObjectExpression({ queryFn, mutationFn }) 에서 함수 값을 가진 특정 키 추출 */
  function getFnFromOption(obj: t.ObjectExpression, ...keys: string[]): t.BlockStatement | null {
    for (const prop of obj.properties) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        keys.includes(prop.key.name)
      ) {
        // () => fetchFn() 형태 또는 () => { ... } 형태
        const block = getBlock(prop.value as t.Node);
        if (block) return block;
        // 표현식 바디 화살표함수: () => fetchFn() → ExpressionStatement로 래핑
        if (
          (t.isArrowFunctionExpression(prop.value) || t.isFunctionExpression(prop.value)) &&
          t.isExpression((prop.value as any).body)
        ) {
          // 표현식 body를 BlockStatement로 변환
          return t.blockStatement([t.expressionStatement((prop.value as any).body)]);
        }
      }
    }
    return null;
  }

  /** ObjectExpression에서 queryFn/mutationFn이 심볼 참조인 경우 처리 */
  function getSymbolNameFromOption(obj: t.ObjectExpression, ...keys: string[]): string | null {
    for (const prop of obj.properties) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        keys.includes(prop.key.name) &&
        t.isIdentifier(prop.value)
      ) {
        return (prop.value as t.Identifier).name;
      }
    }
    return null;
  }

  traverse(ast, {
    CallExpression(p) {
      const calleeName = extractCalleeName(p.node.callee as t.Expression);
      if (!calleeName) return;

      // ── MOUNT 트리거 ─────────────────────────────────────────
      if (MOUNT_HOOKS.has(calleeName)) {
        const firstArg = p.node.arguments[0];
        if (!firstArg) return;

        let blockNode: t.BlockStatement | null = null;
        let refetchKeys: string[] = [];

        // A) 전통 형태: useEffect(() => { ... })
        if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
          blockNode = getBlock(firstArg) ?? null;
          if (blockNode) refetchKeys = collectRefetchKeys(blockNode);
        }
        // B) React Query v5 객체 형태: useQuery({ queryFn: () => ... })
        else if (t.isObjectExpression(firstArg)) {
          blockNode = getFnFromOption(firstArg, 'queryFn', 'select');
          refetchKeys = collectRefetchKeys(firstArg); // onSuccess 등도 탐색

          // queryFn이 심볼 참조인 경우: { queryFn: fetchProducts }
          if (!blockNode) {
            const symName = getSymbolNameFromOption(firstArg, 'queryFn');
            if (symName && importMap.has(symName)) {
              const { importedName, sourcePath } = importMap.get(symName)!;
              const targetFile = resolveFilePath(filePath, sourcePath, rootDir);
              if (targetFile) {
                const targetAst = parseFile(targetFile);
                if (targetAst) {
                  // 파일 전체가 아닌 해당 심볼 함수만 정밀 추출
                  const resolved = resolveSymbolAstNode(targetAst, importedName, targetFile, rootDir);
                  const subAst = resolved ? resolved.ast : null;
                  if (subAst) {
                    const subCalls = findApiCalls(subAst, resolvers, resolved!.file, rootDir);
                    if (subCalls.length > 0) {
                      scenarios.push({
                        triggerType: 'MOUNT',
                        triggerSource: calleeName,
                        file: relativePath,
                        viewName,
                        apiCalls: subCalls.map((c, i) => ({ order: i + 1, method: c.method, endpoint: c.endpoint })),
                        ...(refetchKeys.length > 0 && { triggersRefetch: refetchKeys }),
                      });
                      p.skip();
                      return;
                    }
                  }
                }
              }
            }
          }
        }
        // C) useSWR(url, fetcher): 첫 번째 인수가 URL 문자열
        else {
          const urlStr = extractStringLiteral(firstArg);
          if (urlStr && isAllowedUrl(urlStr)) {
            scenarios.push({
              triggerType: 'MOUNT',
              triggerSource: calleeName,
              file: relativePath,
              viewName,
              apiCalls: [{ order: 1, method: 'GET', endpoint: urlStr }],
            });
          }
          p.skip();
          return;
        }

        if (blockNode) {
          const apiCalls = collectApiCallsInBlock(blockNode, resolvers, ast, importMap, filePath, rootDir);
          if (apiCalls.length > 0) {
            scenarios.push({
              triggerType: 'MOUNT',
              triggerSource: calleeName,
              file: relativePath,
              viewName,
              apiCalls,
              ...(refetchKeys.length > 0 && { triggersRefetch: refetchKeys }),
            });
          }
        }
        p.skip();
        return;
      }

      // ── EVENT 트리거 ─────────────────────────────────────────
      if (EVENT_HOOKS.has(calleeName)) {
        const firstArg = p.node.arguments[0];
        if (!firstArg) return;

        let blockNode: t.BlockStatement | null = null;
        let refetchKeys: string[] = [];

        // A) 직접 콜백 형태: useMutation(async () => { ... })
        if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
          blockNode = getBlock(firstArg) ?? null;
          if (blockNode) refetchKeys = collectRefetchKeys(blockNode);
        }
        // B) 객체 형태: useMutation({ mutationFn: ..., onSuccess: ... })
        else if (t.isObjectExpression(firstArg)) {
          blockNode = getFnFromOption(firstArg, 'mutationFn');
          refetchKeys = collectRefetchKeys(firstArg);

          // mutationFn이 심볼 참조인 경우
          if (!blockNode) {
            const symName = getSymbolNameFromOption(firstArg, 'mutationFn');
            if (symName && importMap.has(symName)) {
              const { importedName, sourcePath } = importMap.get(symName)!;
              const targetFile = resolveFilePath(filePath, sourcePath, rootDir);
              if (targetFile) {
                const targetAst = parseFile(targetFile);
                if (targetAst) {
                  // 파일 전체가 아닌 해당 심볼 함수만 정밀 추출
                  const resolved = resolveSymbolAstNode(targetAst, importedName, targetFile, rootDir);
                  const subAst = resolved ? resolved.ast : null;
                  if (subAst) {
                    const subCalls = findApiCalls(subAst, resolvers, resolved!.file, rootDir);
                    if (subCalls.length > 0) {
                      scenarios.push({
                        triggerType: 'EVENT',
                        triggerSource: calleeName,
                        file: relativePath,
                        viewName,
                        apiCalls: subCalls.map((c, i) => ({ order: i + 1, method: c.method, endpoint: c.endpoint })),
                        ...(refetchKeys.length > 0 && { triggersRefetch: refetchKeys }),
                      });
                      p.skip();
                      return;
                    }
                  }
                }
              }
            }
          }
        }

        if (blockNode) {
          const apiCalls = collectApiCallsInBlock(blockNode, resolvers, ast, importMap, filePath, rootDir);
          if (apiCalls.length > 0) {
            scenarios.push({
              triggerType: 'EVENT',
              triggerSource: calleeName,
              file: relativePath,
              viewName,
              apiCalls,
              ...(refetchKeys.length > 0 && { triggersRefetch: refetchKeys }),
            });
          }
        }
        p.skip();
        return;
      }
    },

    // ── EVENT 트리거: JSX 이벤트 핸들러 내 직접 async 함수 ─────
    JSXAttribute(p) {
      const attrName = t.isJSXIdentifier(p.node.name) ? p.node.name.name : '';
      const isEventAttr = attrName.startsWith('on') && attrName.length > 2;
      if (!isEventAttr) return;

      const value = p.node.value;
      if (!value || !t.isJSXExpressionContainer(value)) return;

      const expr = value.expression;
      const block = getBlock(expr);
      if (block) {
        const apiCalls = collectApiCallsInBlock(block, resolvers, ast, importMap, filePath, rootDir);
        const refetchKeys = collectRefetchKeys(block);
        if (apiCalls.length > 0) {
          scenarios.push({
            triggerType: 'EVENT',
            triggerSource: attrName,
            file: relativePath,
            viewName,
            apiCalls,
            ...(refetchKeys.length > 0 && { triggersRefetch: refetchKeys }),
          });
        }
      }
    },
  });

  return scenarios;
}
