import { NextResponse } from 'next/server';
import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

export async function POST(request: Request) {
  try {
    const { rootPath } = await request.json();
    if (!rootPath || !fs.existsSync(rootPath)) {
      return NextResponse.json({ error: 'Invalid or missing rootPath' }, { status: 400 });
    }

    const apis: any[] = [];

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

        traverse(ast, {
          CallExpression(pathNode) {
            const callee = pathNode.node.callee;
            let method = '';
            let url = '';
            let library = '';
            let queryKey = '';

            // fetch
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
            // axios/apiClient OR React Query Cache Invalidation
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
            // React Query / SWR
            else if (callee.type === 'Identifier' && (callee.name === 'useQuery' || callee.name === 'useSWR')) {
              const arg = pathNode.node.arguments[0];
              
              // useQuery({ queryKey: ['cart'], queryFn: ... })
              if (arg && arg.type === 'ObjectExpression') {
                 const keyProp = arg.properties.find((p: any) => p.key && p.key.name === 'queryKey') as any;
                 if (keyProp) queryKey = extractString(keyProp.value) || '';
                 
                 // Look for fetch/axios inside queryFn
                 const fnProp = arg.properties.find((p: any) => p.key && p.key.name === 'queryFn');
                 if (fnProp) {
                    // It will be parsed later by traverse, but for useQuery itself, we can label it with the queryKey
                    url = `[Query] ${queryKey}`;
                    method = 'GET';
                 }
              } else {
                 queryKey = extractString(arg) || '';
                 url = queryKey;
                 method = 'GET';
              }
              library = callee.name;
            }
            // Try to find if this API call is wrapped in a function and get the wrapper name
            let wrapperFunction = '';
            let p: any = pathNode.parentPath;
            while (p && !wrapperFunction) {
              if (p.node.type === 'FunctionDeclaration' && p.node.id) {
                wrapperFunction = p.node.id.name;
              } else if (p.node.type === 'VariableDeclarator' && p.node.id.type === 'Identifier') {
                wrapperFunction = p.node.id.name;
              } else if (p.node.type === 'ExportNamedDeclaration' && p.node.declaration?.type === 'FunctionDeclaration' && p.node.declaration.id) {
                wrapperFunction = p.node.declaration.id.name;
              }
              p = p.parentPath;
            }

            // useMutation (TanStack)
            let mutationWrapperName = '';
            if (callee.type === 'Identifier' && callee.name === 'useMutation') {
              const arg = pathNode.node.arguments[0];
              if (arg && arg.type === 'ObjectExpression') {
                 // look for mutationFn
                 const mutFnProp = arg.properties.find((prop: any) => prop.key && prop.key.name === 'mutationFn') as any;
                 if (mutFnProp) {
                    // Extract the function being called inside mutationFn
                    // e.g. mutationFn: () => addToCartApi()
                    if (mutFnProp.value.type === 'ArrowFunctionExpression' || mutFnProp.value.type === 'FunctionExpression') {
                       const body = mutFnProp.value.body;
                       if (body.type === 'CallExpression' && body.callee.type === 'Identifier') {
                          mutationWrapperName = body.callee.name;
                       }
                    } else if (mutFnProp.value.type === 'Identifier') {
                       mutationWrapperName = mutFnProp.value.name;
                    }
                 }
              }

              url = `[Mutation] ${pathNode.scope.block.type === 'ArrowFunctionExpression' ? 'ArrowFunction' : 'Block'}`;
              if (pathNode.parentPath?.node.type === 'VariableDeclarator' && pathNode.parentPath.node.id.type === 'Identifier') {
                 url = `[Mutation] ${pathNode.parentPath.node.id.name}`;
              }
              if (mutationWrapperName) {
                 // We will resolve this later in Pass 2
                 url = `[MutationFn] ${mutationWrapperName}`;
              }
              method = 'POST';
              library = 'react-query';
            }

            if (url && method) {
              allApis.push({
                id: Math.random().toString(36).substring(7),
                method,
                url,
                queryKey, // store queryKey for cross-reference
                library,
                wrapperFunction, // name of the function wrapping this API call
                mutationWrapperName, // if this is a mutation, the name of the function it calls
                filePath: file,
                line: pathNode.node.loc?.start.line || 0,
                pathNode // reference for block/scope checking
              });
            }
          }
        });

      } catch (parseErr) {
        // Ignore parsing errors for individual files
      }
    }

    // 2nd Pass: Global URL Resolution (MutationFn & Invalidate)
    for (let i = 0; i < allApis.length; i++) {
      const apiA = allApis[i];

      // Resolve MutationFn across files
      if (apiA.mutationWrapperName) {
         const target = allApis.find(a => a.wrapperFunction === apiA.mutationWrapperName);
         if (target) {
            apiA.method = target.method;
            apiA.url = target.url;
         }
      }
    }

    // 3rd Pass: Build Chains
    for (let i = 0; i < allApis.length; i++) {
      const apiA = allApis[i];
      apiA.chains = [];

      for (let j = 0; j < allApis.length; j++) {
        if (i === j) continue;
        const apiB = allApis[j];

        // 1. Same File Callback / onSuccess / mutationFn
        let parent = apiB.pathNode.parentPath;
        let isInsideA = false;
        let chainType = 'callback';
        
        if (apiA.filePath === apiB.filePath) {
            let tempChainType = 'callback';
            while (parent) {
               if (parent === apiA.pathNode) {
                  isInsideA = true;
                  chainType = tempChainType;
                  break;
               }
               if (parent.node.type === 'ObjectProperty' && parent.node.key && (parent.node.key as any).name === 'onSuccess') {
                  tempChainType = 'onSuccess';
               } else if (parent.node.type === 'ObjectProperty' && parent.node.key && (parent.node.key as any).name === 'mutationFn') {
                  tempChainType = 'mutationFn';
               } else if (parent.node?.type === 'CallExpression' && parent.node?.callee?.type === 'MemberExpression') {
                  if ((parent.node.callee.property as any)?.name === 'then') {
                     tempChainType = 'then';
                  }
               }
               parent = parent.parentPath;
            }

            if (isInsideA) {
               apiA.chains.push({
                  type: chainType,
                  target: { method: apiB.method, url: apiB.url, line: apiB.line, file: apiB.filePath }
               });
            }
        }
      }

      // 3. Resolve [Invalidate] cross-file!
      // If any of apiA's chains are an Invalidate, let's map it to the actual GET API.
      const resolvedChains: any[] = [];
      for (const chain of apiA.chains) {
         if (chain.target.method === 'REFETCH' && chain.target.url.startsWith('[Invalidate]')) {
             const key = chain.target.url.replace('[Invalidate] ', '');
             // Find all APIs that have this queryKey and are GET
             const targets = allApis.filter(a => a.queryKey === key && a.method === 'GET');
             if (targets.length > 0) {
                 for (const t of targets) {
                     resolvedChains.push({
                        type: `${chain.type} → invalidateQueries`,
                        target: { method: t.method, url: t.url, line: t.line, file: t.filePath }
                     });
                 }
             } else {
                 resolvedChains.push(chain); // keep original if not found
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
       const seenChains = new Set();
       for (const chain of api.chains) {
          const key = `${chain.target.method}-${chain.target.url}-${chain.target.file}`;
          if (!seenChains.has(key)) {
             seenChains.add(key);
             uniqueChains.push(chain);
          }
       }
       api.chains = uniqueChains;
    }

    return NextResponse.json({ apis: allApis });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
          str += `\${${expr.name}}`;
        } else if (expr.type === 'MemberExpression' && expr.property.type === 'Identifier') {
          if (expr.object.type === 'Identifier') {
            str += `\${${expr.object.name}.${expr.property.name}}`;
          } else {
            str += `\${${expr.property.name}}`;
          }
        } else if (expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression' && expr.callee.property.type === 'Identifier') {
          if (expr.callee.object.type === 'Identifier') {
            str += `\${${expr.callee.object.name}.${expr.callee.property.name}()}`;
          } else {
            str += `\${${expr.callee.property.name}()}`;
          }
        } else {
          str += '${param}';
        }
      }
    });
    return str;
  }
  if (node.type === 'ArrayExpression') return extractString(node.elements[0]);
  return null;
}
