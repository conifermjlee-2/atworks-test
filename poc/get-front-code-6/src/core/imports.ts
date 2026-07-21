import path from 'path';
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { ProjectConfig } from './project-config';

export interface ImportMap {
  symbols: Map<string, string>;
}

export function collectImports(ast: File, filePath: string, config: ProjectConfig): ImportMap {
  const symbols = new Map<string, string>();

  traverse(ast, {
    ImportDeclaration(importPath) {
      const resolved = resolveImport(filePath, importPath.node.source.value, config);
      if (!resolved) return;

      for (const specifier of importPath.node.specifiers) {
        if (t.isImportSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
          symbols.set(specifier.local.name, resolved);
        }
      }
    },
  });

  return { symbols };
}

export function resolveImport(fromFile: string, request: string, config: ProjectConfig): string | null {
  if (!request.startsWith('.') && !request.startsWith('/')) {
    const aliasResolved = resolveAlias(request, config);
    return aliasResolved ? withExtension(aliasResolved) : null;
  }

  const absolute = request.startsWith('/')
    ? path.resolve(config.rootDir, `.${request}`)
    : path.resolve(path.dirname(fromFile), request);

  return withExtension(absolute);
}

function resolveAlias(request: string, config: ProjectConfig): string | null {
  for (const entry of config.paths) {
    const aliasPrefix = entry.alias.replace(/\*$/, '');
    if (!request.startsWith(aliasPrefix)) continue;

    const rest = request.slice(aliasPrefix.length);
    const target = entry.targets[0]?.replace(/\*$/, rest);
    if (!target) continue;
    return path.resolve(config.baseUrl, target);
  }

  if (request.startsWith('@/')) {
    return path.resolve(config.rootDir, 'src', request.slice(2));
  }

  return null;
}

function withExtension(basePath: string): string | null {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const extension of extensions) {
    const candidate = `${basePath}${extension}`;
    try {
      require('fs').accessSync(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}
