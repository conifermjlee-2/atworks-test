import fs from 'fs/promises';
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import type { ApiCallInfo } from '@/types';
import type { ProjectConfig } from './project-config';
import { parseSource } from './parser';
import { collectImports } from './imports';
import { collectStringConstants } from './constants';
import { resolveDirectCall } from '@/resolvers/direct-resolver';

export async function traceSymbolCall(
  symbolName: string,
  fromFile: string,
  config: ProjectConfig,
  visited = new Set<string>(),
): Promise<ApiCallInfo | null> {
  const source = await fs.readFile(fromFile, 'utf8').catch(() => null);
  if (!source) return null;

  const ast = parseSource(source, fromFile);
  const imports = collectImports(ast, fromFile, config);
  const importedFrom = imports.symbols.get(symbolName);
  if (importedFrom && !visited.has(`${importedFrom}:${symbolName}`)) {
    visited.add(`${importedFrom}:${symbolName}`);
    return traceSymbolCall(symbolName, importedFrom, config, visited);
  }

  const constants = collectStringConstants(ast);
  let found: ApiCallInfo | null = null;

  traverse(ast, {
    FunctionDeclaration(path) {
      if (found || !path.node.id || path.node.id.name !== symbolName) return;
      path.traverse({
        CallExpression(innerPath) {
          const api = resolveDirectCall(innerPath.node, constants);
          if (api) {
            found = { ...api, resolver: 'symbol-trace' };
            innerPath.stop();
          }
        },
      });
    },
    VariableDeclarator(path) {
      if (found || !t.isIdentifier(path.node.id, { name: symbolName })) return;
      const init = path.node.init;
      if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return;
      path.traverse({
        CallExpression(innerPath) {
          const api = resolveDirectCall(innerPath.node, constants);
          if (api) {
            found = { ...api, resolver: 'symbol-trace' };
            innerPath.stop();
          }
        },
      });
    },
  });

  return found;
}
