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
