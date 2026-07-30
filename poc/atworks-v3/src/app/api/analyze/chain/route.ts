import { NextResponse } from 'next/server';
import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

export async function POST(request: Request) {
  console.log('HIT POST /api/analyze/chain');
  try {
    const body = await request.json();
    const { rootPath } = body;
    if (!rootPath || !fs.existsSync(rootPath)) {
      return NextResponse.json({ error: 'Invalid or missing rootPath' }, { status: 400 });
    }

    // Find all source files
    const sourceFiles = globSync('**/*.{js,jsx,ts,tsx}', {
      cwd: rootPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
    });

    const allApis: any[] = [];

    for (const file of sourceFiles) {
      const absolutePath = path.join(rootPath, file);
      const code = fs.readFileSync(absolutePath, 'utf-8');

      try {
        const ast = parser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'decorators-legacy'],
        });

        // Per-file: track AST node ranges that are "inline" hook callbacks
        // so we don't double-count them as separate top-level APIs
        const skippedNodeStarts = new Set<number>();

        traverse(ast, {
          CallExpression(pathNode) {
            const callee = pathNode.node.callee;
            const nodeStart = pathNode.node.start ?? -1;

            // Skip nodes that were absorbed into a parent hook
            if (skippedNodeStarts.has(nodeStart)) return;

            let method = '';
            let url = '';
            let library = '';
            let queryKey = '';
            let queryFnName = '';

            // ── fetch ────────────────────────────────────────────────────
            if (callee.type === 'Identifier' && callee.name === 'fetch') {
              url = extractString(pathNode.node.arguments[0]) || '';
              method = 'GET';
              const optionsNode = pathNode.node.arguments[1];
              if (optionsNode && optionsNode.type === 'ObjectExpression') {
                const methodProp = optionsNode.properties.find((p: any) => p.key && p.key.name === 'method') as any;
                if (methodProp && methodProp.value.type === 'StringLiteral') method = methodProp.value.value.toUpperCase();
              }
              library = 'fetch';
            }

            // ── axios/apiClient OR invalidateQueries ─────────────────────
            else if (callee.type === 'MemberExpression') {
              const objectName = callee.object.type === 'Identifier' ? callee.object.name : '';
              const propertyName = callee.property.type === 'Identifier' ? callee.property.name : '';
              const isAxiosOrApi = /axios|api|http|client/i.test(objectName);
              const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

              if (isAxiosOrApi && httpMethods.includes(propertyName.toLowerCase())) {
                url = extractString(pathNode.node.arguments[0]) || '[DYNAMIC_URL]';
                method = propertyName.toUpperCase();
                library = objectName;
              } else if (propertyName === 'invalidateQueries') {
                const arg = pathNode.node.arguments[0];
                if (arg && arg.type === 'ObjectExpression') {
                  const queryKeyProp = arg.properties.find((p: any) => p.key && p.key.name === 'queryKey') as any;
                  if (queryKeyProp) queryKey = extractString(queryKeyProp.value) || 'unknown_key';
                } else if (arg) {
                  queryKey = extractString(arg) || 'unknown_key';
                }
                url = `[Invalidate] ${queryKey}`;
                method = 'REFETCH';
                library = 'react-query';
              }
            }

            // ── useQuery / useSWR ────────────────────────────────────────
            else if (callee.type === 'Identifier' && (callee.name === 'useQuery' || callee.name === 'useSWR')) {
              const arg = pathNode.node.arguments[0];
              let resolvedLine: number | undefined;

              if (arg && arg.type === 'ObjectExpression') {
                // queryKey
                const keyProp = arg.properties.find((p: any) => p.key && p.key.name === 'queryKey') as any;
                if (keyProp) queryKey = extractString(keyProp.value) || '';

                // queryFn
                const fnProp = arg.properties.find((p: any) => p.key && p.key.name === 'queryFn') as any;
                if (fnProp) {
                  if (fnProp.value.type === 'Identifier') {
                    // queryFn: fetchData  (external fn reference → resolve in Pass 2)
                    queryFnName = fnProp.value.name;
                    url = `[Query] ${queryKey}`;
                    method = 'GET';
                  } else if (fnProp.value.type === 'ArrowFunctionExpression' || fnProp.value.type === 'FunctionExpression') {
                    // queryFn: async () => { return axios.get(...) }  (inline fn)
                    const extracted = extractApiCallFromNode(fnProp.value.body);
                    if (extracted) {
                      url = extracted.url;
                      method = extracted.method;
                      resolvedLine = extracted.line;
                      if (resolvedLine) (pathNode as any).__resolvedLine = resolvedLine;
                      // Mark all inner nodes inside this fn as skipped
                      markSkippedNodes(fnProp.value.body, skippedNodeStarts);
                    } else {
                      url = `[Query] ${queryKey}`;
                      method = 'GET';
                    }
                  } else {
                    url = `[Query] ${queryKey}`;
                    method = 'GET';
                  }
                } else {
                  url = `[Query] ${queryKey}`;
                  method = 'GET';
                }
              } else {
                // useSWR('url', fetcher) – first arg is the URL directly
                const directUrl = extractString(arg) || '';
                url = directUrl;
                method = 'GET';
                queryKey = directUrl;
              }
              library = callee.name;
            }

            // ── RTK Query custom hooks (useGetXxxQuery / useXxxMutation) ─
            else if (
              callee.type === 'Identifier' &&
              callee.name.startsWith('use') &&
              (callee.name.endsWith('Query') || callee.name.endsWith('Mutation')) &&
              callee.name !== 'useQuery' &&
              callee.name !== 'useMutation'
            ) {
              const isMutation = callee.name.endsWith('Mutation');
              method = isMutation ? 'POST' : 'GET';
              const baseName = callee.name.replace(/^use/, '').replace(/Query$/, '').replace(/Mutation$/, '');
              url = isMutation ? `[Mutation] ${baseName}` : `[Query] ${baseName}`;
              library = 'rtk-query';
            }

            // ── useMutation (TanStack) ───────────────────────────────────
            else if (callee.type === 'Identifier' && callee.name === 'useMutation') {
              const arg = pathNode.node.arguments[0];
              let mutationWrapperName = '';
              let resolvedMethod = 'POST';
              let resolvedUrl = '';
              let resolvedLine: number | undefined;

              if (arg && arg.type === 'ObjectExpression') {
                const mutFnProp = arg.properties.find((prop: any) => prop.key && prop.key.name === 'mutationFn') as any;
                if (mutFnProp) {
                  if (mutFnProp.value.type === 'Identifier') {
                    // mutationFn: addToCartApi  (fn reference)
                    mutationWrapperName = mutFnProp.value.name;
                  } else if (mutFnProp.value.type === 'ArrowFunctionExpression' || mutFnProp.value.type === 'FunctionExpression') {
                    // mutationFn: (data) => axios.post(...)  (inline)
                    const fnBody = mutFnProp.value.body;
                    // body can be an expression (concise arrow) or a BlockStatement
                    const extracted = extractApiCallFromNode(fnBody);
                    if (extracted) {
                      resolvedUrl = extracted.url;
                      resolvedMethod = extracted.method;
                      resolvedLine = extracted.line;
                      markSkippedNodes(fnBody, skippedNodeStarts);
                    } else if (fnBody.type === 'CallExpression' && fnBody.callee.type === 'Identifier') {
                      mutationWrapperName = fnBody.callee.name;
                    }
                  }
                }
              }

              // Determine display name
              let mutationDisplayName = 'useMutation';
              if (pathNode.parentPath?.node.type === 'VariableDeclarator' && (pathNode.parentPath.node.id as any).type === 'Identifier') {
                mutationDisplayName = (pathNode.parentPath.node.id as any).name;
              }

              url = resolvedUrl || (mutationWrapperName ? `[MutationFn] ${mutationWrapperName}` : `[Mutation] ${mutationDisplayName}`);
              method = resolvedMethod;
              library = 'react-query';

              // Push early with extra metadata so we can resolve mutationWrapperName in Pass 2
              const wrapperFunction = getWrapperFunction(pathNode);
              allApis.push({
                id: Math.random().toString(36).substring(7),
                method,
                url,
                queryKey,
                queryFnName,
                library,
                wrapperFunction,
                mutationWrapperName,
                filePath: file,
                line: resolvedLine || pathNode.node.loc?.start.line || 0,
                pathNode,
              });
              return; // early return to skip bottom push
            }

            if (!url || !method) return;

            // Find wrapper function
            const wrapperFunction = getWrapperFunction(pathNode);
            
            // Allow resolvedLine from useQuery/useSWR (though they fall through here)
            let finalLine = pathNode.node.loc?.start.line || 0;
            if ((callee.name === 'useQuery' || callee.name === 'useSWR') && (pathNode as any).__resolvedLine) {
                finalLine = (pathNode as any).__resolvedLine;
            }

            allApis.push({
              id: Math.random().toString(36).substring(7),
              method,
              url,
              queryKey,
              queryFnName,
              library,
              wrapperFunction,
              mutationWrapperName: '',
              filePath: file,
              line: finalLine,
              pathNode,
            });
          },
        });

      } catch (parseErr) {
        // Ignore parsing errors for individual files
      }
    }

    // ── 2nd Pass: Global URL Resolution ──────────────────────────────────
    for (let i = 0; i < allApis.length; i++) {
      const apiA = allApis[i];

      // Resolve MutationFn cross-file reference
      if (apiA.mutationWrapperName && apiA.url.startsWith('[MutationFn]')) {
        const target = allApis.find(a => a.wrapperFunction === apiA.mutationWrapperName);
        if (target) {
          apiA.method = target.method;
          apiA.url = target.url;
        }
      }

      // Resolve QueryFn function reference: queryFn: fetchCartItems → GET /api/cart
      if (apiA.queryFnName && apiA.url.startsWith('[Query]')) {
        const target = allApis.find(a =>
          a.wrapperFunction === apiA.queryFnName ||
          a.mutationWrapperName === apiA.queryFnName
        );
        if (target) {
          apiA.url = target.url;
          apiA.method = target.method;
        }
      }
    }

    // ── 3rd Pass: Build Chains ────────────────────────────────────────────
    for (let i = 0; i < allApis.length; i++) {
      const apiA = allApis[i];
      apiA.chains = [];

      for (let j = 0; j < allApis.length; j++) {
        if (i === j) continue;
        const apiB = allApis[j];

        // Only chain within same file
        if (apiA.filePath !== apiB.filePath) continue;

        // Walk up apiB's parent path to see if it's inside apiA's scope
        let parent = apiB.pathNode.parentPath;
        let isInsideA = false;
        let chainType = 'callback';
        let tempChainType = 'callback';

        while (parent) {
          // Compare by AST node identity (more reliable than Path object identity)
          if (parent.node === apiA.pathNode.node) {
            isInsideA = true;
            chainType = tempChainType;
            break;
          }
          if (parent.node.type === 'ObjectProperty' && parent.node.key) {
            const keyName = (parent.node.key as any).name;
            if (keyName === 'onSuccess') tempChainType = 'onSuccess';
            else if (keyName === 'mutationFn') tempChainType = 'mutationFn';
            else if (keyName === 'queryFn') tempChainType = 'queryFn';
          } else if (
            parent.node?.type === 'CallExpression' &&
            (parent.node?.callee as any)?.type === 'MemberExpression' &&
            (parent.node?.callee as any)?.property?.name === 'then'
          ) {
            tempChainType = 'then';
          }
          parent = parent.parentPath;
        }

        if (isInsideA) {
          apiA.chains.push({
            type: chainType,
            target: { method: apiB.method, url: apiB.url, line: apiB.line, file: apiB.filePath },
          });
        }
      }

      // Resolve [Invalidate] → actual GET APIs (cross-file)
      const resolvedChains: any[] = [];
      for (const chain of apiA.chains) {
        // Skip internal queryFn chains (they are part of the hook, not a "transition")
        if (chain.type === 'queryFn' || chain.type === 'mutationFn') continue;

        if (chain.target.method === 'REFETCH' && chain.target.url.startsWith('[Invalidate]')) {
          const key = chain.target.url.replace('[Invalidate] ', '');
          // Match GET APIs whose queryKey starts with the invalidated key
          // e.g. invalidate('posts') matches queryKey='posts' AND queryKey='post' (prefix) AND queryKey='posts,id'
          const targets = allApis.filter(a => {
            if (a.method !== 'GET') return false;
            const qk = a.queryKey || '';
            if (qk === '') return false; // RTK Query 커스텀 훅 등 queryKey 없는 것 제외
            // React Query 스타일 배열 접두사 매칭:
            // 'posts'는 'posts' 또는 'posts,어쩌구'와 매칭되지만, 'post'와는 매칭되지 않아야 함.
            return qk === key || qk.startsWith(key + ',');
          });
          if (targets.length > 0) {
            for (const t of targets) {
              resolvedChains.push({
                type: chain.type, // keep original (e.g. 'onSuccess')
                transitionLine: chain.target.line, // 22번 줄 (invalidateQueries 호출 위치)
                target: { method: t.method, url: t.url, line: t.line, file: t.filePath },
              });
            }
          } else {
            resolvedChains.push(chain);
          }
        } else {
          resolvedChains.push(chain);
        }
      }
      apiA.chains = resolvedChains;
    }

    // Prepare for JSON response
    for (const api of allApis) {
      delete api.pathNode;

      // Deduplicate chains
      const uniqueChains: any[] = [];
      const seenChains = new Set<string>();
      for (const chain of api.chains) {
        const key = `${chain.target.method}-${chain.target.url}-${chain.target.file}`;
        if (!seenChains.has(key)) {
          seenChains.add(key);
          uniqueChains.push(chain);
        }
      }
      api.chains = uniqueChains;
    }

    // Only return hook-based APIs (always), plus any API that has chains
    const hookLibraries = new Set(['useQuery', 'useSWR', 'react-query', 'rtk-query']);
    const result = allApis.filter(api => hookLibraries.has(api.library) || api.chains.length > 0);
    return NextResponse.json({ apis: result });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWrapperFunction(pathNode: any): string {
  let p: any = pathNode.parentPath;
  while (p) {
    if (p.node.type === 'FunctionDeclaration' && p.node.id) return p.node.id.name;
    if (p.node.type === 'VariableDeclarator' && p.node.id?.type === 'Identifier') return p.node.id.name;
    if (p.node.type === 'ExportNamedDeclaration' && p.node.declaration?.type === 'FunctionDeclaration' && p.node.declaration.id) return p.node.declaration.id.name;
    p = p.parentPath;
  }
  return '';
}

/**
 * Recursively search an AST sub-tree for the first axios/fetch/api call.
 * Returns { method, url } or null.
 */
function extractApiCallFromNode(node: any): { method: string; url: string; line?: number } | null {
  if (!node) return null;
  const line = node.loc?.start.line;

  if (node.type === 'CallExpression') {
    const callee = node.callee;
    // axios.get / axios.post / api.get etc.
    if (callee.type === 'MemberExpression') {
      const objName = callee.object?.type === 'Identifier' ? callee.object.name : '';
      const propName = callee.property?.type === 'Identifier' ? callee.property.name : '';
      const isAxiosLike = /axios|api|http|client/i.test(objName);
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
      if (isAxiosLike && httpMethods.includes(propName.toLowerCase())) {
        const url = extractString(node.arguments[0]) || '[DYNAMIC_URL]';
        return { method: propName.toUpperCase(), url, line };
      }
    }
    // fetch('url')
    if (callee.type === 'Identifier' && callee.name === 'fetch') {
      const url = extractString(node.arguments[0]) || '[DYNAMIC_URL]';
      return { method: 'GET', url, line };
    }
    // Drill into callee arguments recursively
    for (const arg of (node.arguments || [])) {
      const r = extractApiCallFromNode(arg);
      if (r) return r;
    }
  }

  // BlockStatement: search all statements
  if (node.type === 'BlockStatement') {
    for (const stmt of (node.body || [])) {
      const r = extractApiCallFromNode(stmt);
      if (r) return r;
    }
  }

  // ReturnStatement
  if (node.type === 'ReturnStatement' && node.argument) {
    return extractApiCallFromNode(node.argument);
  }

  // AwaitExpression
  if (node.type === 'AwaitExpression' && node.argument) {
    return extractApiCallFromNode(node.argument);
  }

  // VariableDeclaration
  if (node.type === 'VariableDeclaration') {
    for (const decl of (node.declarations || [])) {
      const r = extractApiCallFromNode(decl.init);
      if (r) return r;
    }
  }

  // ExpressionStatement
  if (node.type === 'ExpressionStatement' && node.expression) {
    return extractApiCallFromNode(node.expression);
  }

  return null;
}

/**
 * Recursively mark all CallExpression start positions as skipped,
 * so they won't be treated as independent top-level API entries.
 */
function markSkippedNodes(node: any, skipped: Set<number>): void {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.start != null) {
    skipped.add(node.start);
  }
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) { if (item && typeof item === 'object' && item.type) markSkippedNodes(item, skipped); }
    } else if (child && typeof child === 'object' && child.type) {
      markSkippedNodes(child, skipped);
    }
  }
}

function extractString(node: any): string | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'ArrayExpression') {
    return node.elements.filter((e: any) => e && e.type === 'StringLiteral').map((e: any) => e.value).join(',');
  }
  if (node.type === 'TemplateLiteral') {
    let str = '';
    node.quasis.forEach((q: any, i: number) => {
      str += q.value.raw;
      if (i < node.expressions.length) {
        const expr = node.expressions[i];
        if (expr.type === 'Identifier') {
          str += `{${expr.name}}`;
        } else if (expr.type === 'MemberExpression' && expr.property.type === 'Identifier') {
          if (expr.object.type === 'Identifier') {
            str += `{${expr.object.name}.${expr.property.name}}`;
          } else {
            str += `{${expr.property.name}}`;
          }
        } else if (expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression' && expr.callee.property.type === 'Identifier') {
          if (expr.callee.object.type === 'Identifier') {
            str += `{${expr.callee.object.name}.${expr.callee.property.name}()}`;
          } else {
            str += `{${expr.callee.property.name}()}`;
          }
        } else {
          str += '{param}';
        }
      }
    });
    return str;
  }
  return null;
}
