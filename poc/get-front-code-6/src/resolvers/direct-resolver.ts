import * as t from '@babel/types';
import type { ApiCallInfo } from '@/types';
import { expressionToUrl } from '@/core/url-expression';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

export function resolveDirectCall(node: t.CallExpression, constants: Map<string, string>): ApiCallInfo | null {
  if (t.isIdentifier(node.callee, { name: 'fetch' })) {
    const url = expressionToUrl(node.arguments[0], constants);
    if (!url) return null;
    return {
      method: resolveFetchMethod(node) ?? 'GET',
      endpoint: url.value,
      isDynamic: url.isDynamic,
      rawUrl: url.value,
      resolver: 'fetch',
    };
  }

  if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.object)) {
    const property = node.callee.property;
    if (!t.isIdentifier(property) || !HTTP_METHODS.has(property.name)) return null;
    const url = expressionToUrl(node.arguments[0], constants);
    if (!url) return null;
    return {
      method: property.name.toUpperCase() as ApiCallInfo['method'],
      endpoint: url.value,
      isDynamic: url.isDynamic,
      rawUrl: url.value,
      resolver: 'axios',
    };
  }

  if (t.isIdentifier(node.callee, { name: 'axios' })) {
    const first = node.arguments[0];
    if (t.isStringLiteral(first) || t.isTemplateLiteral(first) || t.isIdentifier(first) || t.isBinaryExpression(first)) {
      const url = expressionToUrl(first, constants);
      if (!url) return null;
      return { method: 'UNKNOWN', endpoint: url.value, isDynamic: url.isDynamic, rawUrl: url.value, resolver: 'axios' };
    }

    if (t.isObjectExpression(first)) {
      const urlNode = objectValue(first, 'url');
      const methodNode = objectValue(first, 'method');
      const url = expressionToUrl(urlNode, constants);
      if (!url) return null;
      return {
        method: methodNode && t.isStringLiteral(methodNode) ? methodNode.value.toUpperCase() as ApiCallInfo['method'] : 'UNKNOWN',
        endpoint: url.value,
        isDynamic: url.isDynamic,
        rawUrl: url.value,
        resolver: 'axios',
      };
    }
  }

  return null;
}

function resolveFetchMethod(node: t.CallExpression): ApiCallInfo['method'] | null {
  const init = node.arguments[1];
  if (!t.isObjectExpression(init)) return null;
  const method = objectValue(init, 'method');
  if (!t.isStringLiteral(method)) return null;
  const value = method.value.toUpperCase();
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(value) ? value as ApiCallInfo['method'] : 'UNKNOWN';
}

function objectValue(objectNode: t.ObjectExpression, key: string): t.Expression | null {
  for (const property of objectNode.properties) {
    if (!t.isObjectProperty(property)) continue;
    if (t.isIdentifier(property.key, { name: key }) || t.isStringLiteral(property.key, { value: key })) {
      return t.isExpression(property.value) ? property.value : null;
    }
  }
  return null;
}
