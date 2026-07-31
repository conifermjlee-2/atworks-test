import { NextResponse } from 'next/server';
import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

type FlowNode = {
  type: 'screen' | 'component' | 'api';
  name: string;
  filePath: string;
  children: FlowNode[];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPath = searchParams.get('rootPath');
    
    if (!rootPath || !fs.existsSync(rootPath)) {
      return NextResponse.json({ error: 'Invalid or missing rootPath' }, { status: 400 });
    }

    // Find entry points (Screens)
    const pageFiles = globSync('**/{app,pages,src/app,src/pages}/**/{page.tsx,page.jsx,index.tsx,index.jsx}', {
      cwd: rootPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
    });

    const screens: FlowNode[] = [];
    const visitedFiles = new Set<string>();

    for (const file of pageFiles) {
      const absolutePath = path.join(rootPath, file);
      const screenNode = analyzeFileRecursively(absolutePath, rootPath, visitedFiles, 'screen');
      if (screenNode) {
        screens.push(screenNode);
      }
    }

    return NextResponse.json({ screens });
  } catch (error: any) {
    console.error('Flow analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function resolveImportPath(importStr: string, currentFilePath: string, rootPath: string): string | null {
  let targetPath = '';
  if (importStr.startsWith('@/')) {
    // Assuming @ maps to src or root
    const possiblePaths = [
      path.join(rootPath, 'src', importStr.replace('@/', '')),
      path.join(rootPath, importStr.replace('@/', ''))
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p + '.tsx')) return p + '.tsx';
      if (fs.existsSync(p + '.ts')) return p + '.ts';
      if (fs.existsSync(p + '.jsx')) return p + '.jsx';
      if (fs.existsSync(p + '.js')) return p + '.js';
      if (fs.existsSync(path.join(p, 'index.tsx'))) return path.join(p, 'index.tsx');
    }
    return possiblePaths[0] + '.tsx'; // Fallback
  } else if (importStr.startsWith('.')) {
    targetPath = path.join(path.dirname(currentFilePath), importStr);
    if (fs.existsSync(targetPath + '.tsx')) return targetPath + '.tsx';
    if (fs.existsSync(targetPath + '.ts')) return targetPath + '.ts';
    if (fs.existsSync(targetPath + '.jsx')) return targetPath + '.jsx';
    if (fs.existsSync(targetPath + '.js')) return targetPath + '.js';
    if (fs.existsSync(path.join(targetPath, 'index.tsx'))) return path.join(targetPath, 'index.tsx');
    return targetPath + '.tsx'; // Fallback
  }
  return null;
}

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
        else str += '{param}';
      }
    });
    return str;
  }
  return null;
}

function analyzeFileRecursively(
  absolutePath: string, 
  rootPath: string, 
  visited: Set<string>, 
  type: 'screen' | 'component'
): FlowNode | null {
  if (visited.has(absolutePath) || !fs.existsSync(absolutePath)) {
    return null; // Avoid infinite loops or missing files
  }
  visited.add(absolutePath);

  const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
  const fileName = path.basename(absolutePath, path.extname(absolutePath));
  
  const nodeName = type === 'screen' ? relativePath : fileName;
  
  const node: FlowNode = {
    type,
    name: nodeName,
    filePath: relativePath,
    children: []
  };

  try {
    const code = fs.readFileSync(absolutePath, 'utf-8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });

    const localImports: { name: string; path: string }[] = [];

    traverse(ast, {
      // Find imports
      ImportDeclaration(pathNode) {
        const source = pathNode.node.source.value;
        if (source.startsWith('.') || source.startsWith('@/')) {
          const resolved = resolveImportPath(source, absolutePath, rootPath);
          if (resolved) {
            localImports.push({ name: source, path: resolved });
          }
        }
      },
      // Find API calls
      CallExpression(pathNode) {
        const callee = pathNode.node.callee;
        
        // 1. fetch
        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          const urlNode = pathNode.node.arguments[0];
          const url = extractString(urlNode);
          if (url && (url.startsWith('http') || url.startsWith('/'))) {
            let method = 'GET';
            const optionsNode = pathNode.node.arguments[1];
            if (optionsNode && optionsNode.type === 'ObjectExpression') {
              const mProp = optionsNode.properties.find((p: any) => p.key && p.key.name === 'method') as any;
              if (mProp && mProp.value.type === 'StringLiteral') method = mProp.value.value.toUpperCase();
            }
            node.children.push({ type: 'api', name: `${method} ${url}`, filePath: `fetch · Line ${pathNode.node.loc?.start.line}`, children: [] });
          }
        }

        // 2. axios / client
        if (callee.type === 'MemberExpression') {
          const objName = callee.object.type === 'Identifier' ? callee.object.name : '';
          const propName = callee.property.type === 'Identifier' ? callee.property.name : '';
          
          if (/axios|api|http|client/i.test(objName) && ['get','post','put','patch','delete'].includes(propName.toLowerCase())) {
            const urlNode = pathNode.node.arguments[0];
            const url = extractString(urlNode) || '[DYNAMIC_URL]';
            node.children.push({ type: 'api', name: `${propName.toUpperCase()} ${url}`, filePath: `${objName} · Line ${pathNode.node.loc?.start.line}`, children: [] });
          }
        }

        // 3. RTK Query / React Query
        if (callee.type === 'Identifier' && (callee.name === 'useQuery' || callee.name === 'useSWR')) {
          const urlNode = pathNode.node.arguments[0];
          const url = extractString(urlNode);
          if (url && (url.startsWith('http') || url.startsWith('/'))) {
            node.children.push({ type: 'api', name: `GET ${url}`, filePath: `${callee.name} · Line ${pathNode.node.loc?.start.line}`, children: [] });
          }
        }
      }
    });

    // Recursively process local imports
    for (const imp of localImports) {
      const childNode = analyzeFileRecursively(imp.path, rootPath, new Set(visited), 'component');
      if (childNode && childNode.children.length > 0) {
        // Only add components if they have API calls or child components that have API calls
        // To keep the tree clean, we filter out components that do absolutely nothing related to APIs
        node.children.push(childNode);
      }
    }

  } catch (e) {
    console.error(`Failed to parse ${absolutePath}`, e);
  }

  // Filter out screens/components that have no API calls and no children with API calls
  if (type === 'screen' && node.children.length === 0) {
    return null;
  }

  return node;
}
