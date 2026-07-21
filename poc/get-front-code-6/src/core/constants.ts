import * as t from '@babel/types';
import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import { expressionToUrl } from './url-expression';

export function collectStringConstants(ast: File): Map<string, string> {
  const constants = new Map<string, string>();

  traverse(ast, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id)) return;
      const resolved = expressionToUrl(path.node.init, constants);
      if (resolved && !resolved.isDynamic) {
        constants.set(path.node.id.name, resolved.value);
      }
    },
  });

  return constants;
}
