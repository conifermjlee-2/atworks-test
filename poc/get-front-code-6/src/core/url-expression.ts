import * as t from '@babel/types';

export interface UrlValue {
  value: string;
  isDynamic: boolean;
}

export function expressionToUrl(node: t.Node | null | undefined, constants = new Map<string, string>()): UrlValue | null {
  if (!node) return null;

  if (t.isStringLiteral(node)) return { value: node.value, isDynamic: false };
  if (t.isTemplateLiteral(node)) {
    let value = '';
    node.quasis.forEach((quasi, index) => {
      value += quasi.value.cooked ?? quasi.value.raw;
      const expression = node.expressions[index];
      if (expression) value += `{${expressionToToken(expression, constants)}}`;
    });
    return { value, isDynamic: node.expressions.length > 0 };
  }

  if (t.isIdentifier(node)) {
    const known = constants.get(node.name);
    return known ? { value: known, isDynamic: false } : { value: `{${node.name}}`, isDynamic: true };
  }

  if (t.isMemberExpression(node)) {
    return { value: `{${expressionToToken(node, constants)}}`, isDynamic: true };
  }

  if (t.isBinaryExpression(node) && node.operator === '+') {
    const left = expressionToUrl(node.left, constants);
    const right = expressionToUrl(node.right, constants);
    if (!left || !right) return null;
    return { value: `${left.value}${right.value}`, isDynamic: left.isDynamic || right.isDynamic };
  }

  if (t.isArrayExpression(node)) {
    const first = node.elements[0];
    if (!first) return null;
    return expressionToUrl(first, constants);
  }

  return { value: `{${expressionToToken(node, constants)}}`, isDynamic: true };
}

export function expressionToToken(node: t.Node, constants = new Map<string, string>()): string {
  if (t.isIdentifier(node)) return constants.get(node.name) ?? node.name;
  if (t.isStringLiteral(node)) return node.value;
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isMemberExpression(node)) {
    return `${expressionToToken(node.object, constants)}.${expressionToToken(node.property, constants)}`;
  }
  if (t.isArrayExpression(node)) {
    return node.elements.map(element => element ? expressionToToken(element, constants) : 'empty').join('.');
  }
  if (t.isCallExpression(node)) return t.isIdentifier(node.callee) ? `${node.callee.name}()` : 'call()';
  return node.type;
}
