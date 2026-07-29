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

    const candidates: any[] = [];

    // Find all source files
    const sourceFiles = globSync('**/*.{js,jsx,ts,tsx}', {
      cwd: rootPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
    });

    for (const file of sourceFiles) {
      const absolutePath = path.join(rootPath, file);
      const code = fs.readFileSync(absolutePath, 'utf-8');

      try {
        const ast = parser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'decorators-legacy'],
        });

        // Custom traversal to find API calls
        traverse(ast, {
          CallExpression(pathNode) {
            const callee = pathNode.node.callee;
            
            // 1. fetch('url', ...)
            if (callee.type === 'Identifier' && callee.name === 'fetch') {
              const urlNode = pathNode.node.arguments[0];
              let url = extractString(urlNode);
              
              let method = 'GET'; // Default
              const optionsNode = pathNode.node.arguments[1];
              if (optionsNode && optionsNode.type === 'ObjectExpression') {
                const methodProp = optionsNode.properties.find(
                  (p: any) => p.key && p.key.name === 'method'
                ) as any;
                if (methodProp && methodProp.value.type === 'StringLiteral') {
                  method = methodProp.value.value.toUpperCase();
                }
              }

              if (url) {
                candidates.push({
                  id: Math.random().toString(36).substring(7),
                  method,
                  url,
                  confidence: 'High',
                  library: 'fetch',
                  filePath: file,
                  line: pathNode.node.loc?.start.line || 0,
                });
              }
            }

            // 2. axios.get('url'), apiClient.post('url'), axiosClient.get('url')
            if (callee.type === 'MemberExpression') {
              const objectName = callee.object.type === 'Identifier' ? callee.object.name : '';
              const propertyName = callee.property.type === 'Identifier' ? callee.property.name : '';
              
              // Broaden heuristics: if object matches /axios|api|http|client/i
              const isAxiosOrApi = /axios|api|http|client/i.test(objectName);
              const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
              
              if (isAxiosOrApi && httpMethods.includes(propertyName.toLowerCase())) {
                const urlNode = pathNode.node.arguments[0];
                let url = extractString(urlNode) || '[DYNAMIC_URL]';

                candidates.push({
                  id: Math.random().toString(36).substring(7),
                  method: propertyName.toUpperCase(),
                  url,
                  confidence: 'High',
                  library: objectName,
                  filePath: file,
                  line: pathNode.node.loc?.start.line || 0,
                });
              }
            }

            // 3. React Query / SWR / RTK Query patterns
            if (callee.type === 'Identifier' && (callee.name === 'useQuery' || callee.name === 'useSWR')) {
              const keyNode = pathNode.node.arguments[0];
              let keyStr = extractString(keyNode);
              
              if (callee.name === 'useSWR' && keyStr && (keyStr.startsWith('/') || keyStr.startsWith('http'))) {
                candidates.push({
                  id: Math.random().toString(36).substring(7),
                  method: 'GET',
                  url: keyStr,
                  confidence: 'Medium',
                  library: 'useSWR',
                  filePath: file,
                  line: pathNode.node.loc?.start.line || 0,
                });
              } else if (callee.name === 'useQuery') {
                if (keyStr && (keyStr.startsWith('/') || keyStr.startsWith('http'))) {
                  candidates.push({
                    id: Math.random().toString(36).substring(7),
                    method: 'GET',
                    url: keyStr,
                    confidence: 'Low',
                    library: 'react-query',
                    filePath: file,
                    line: pathNode.node.loc?.start.line || 0,
                  });
                }
              }
            }

            // 4. RTK Query patterns (builder.query, builder.mutation)
            if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'builder') {
              if (callee.property.type === 'Identifier' && (callee.property.name === 'query' || callee.property.name === 'mutation')) {
                const configObj = pathNode.node.arguments[0];
                if (configObj && configObj.type === 'ObjectExpression') {
                  const queryProp = configObj.properties.find((p: any) => p.key && p.key.name === 'query') as any;
                  if (queryProp && (queryProp.value.type === 'ArrowFunctionExpression' || queryProp.value.type === 'FunctionExpression')) {
                    const body = queryProp.value.body;
                    let method = callee.property.name === 'mutation' ? 'POST' : 'GET';
                    let url = '';

                    if (body.type === 'TemplateLiteral' || body.type === 'StringLiteral') {
                      url = extractString(body) || '';
                    } else if (body.type === 'ObjectExpression') {
                      const urlProp = body.properties.find((p: any) => p.key && p.key.name === 'url');
                      if (urlProp) url = extractString(urlProp.value) || '';
                      
                      const methodProp = body.properties.find((p: any) => p.key && p.key.name === 'method');
                      if (methodProp && methodProp.value.type === 'StringLiteral') {
                        method = methodProp.value.value.toUpperCase();
                      }
                    }

                    if (url) {
                      candidates.push({
                        id: Math.random().toString(36).substring(7),
                        method,
                        url,
                        confidence: 'Medium',
                        library: 'rtk-query',
                        filePath: file,
                        line: pathNode.node.loc?.start.line || 0,
                      });
                    }
                  }
                }
              }
            }
          }
        });

      } catch (parseErr) {
        // Ignore parsing errors for individual files
      }
    }

    // Deduplicate candidates slightly for cleaner UX
    const uniqueCandidates = candidates.reduce((acc, current) => {
      const key = `${current.method}-${current.url}-${current.filePath}`;
      if (!acc.find((item: any) => `${item.method}-${item.url}-${item.filePath}` === key)) {
        acc.push(current);
      }
      return acc;
    }, []);

    return NextResponse.json({ candidates: uniqueCandidates });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Helper to extract string from AST node
function extractString(node: any): string | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') {
    return node.value;
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
  if (node.type === 'ArrayExpression') {
     return extractString(node.elements[0]);
  }
  return null;
}
