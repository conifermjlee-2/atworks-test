import * as t from '@babel/types';
import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { ApiCallInfo } from '@/types';
import { expressionToUrl } from '@/core/url-expression';

export function collectRtkEndpoints(ast: File, constants: Map<string, string>): Map<string, ApiCallInfo> {
  const endpoints = new Map<string, ApiCallInfo>();

  traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee, { name: 'createApi' })) return;
      const config = path.node.arguments[0];
      if (!t.isObjectExpression(config)) return;
      const endpointsProperty = objectValue(config, 'endpoints');
      if (!t.isArrowFunctionExpression(endpointsProperty) && !t.isFunctionExpression(endpointsProperty)) return;
      if (!t.isObjectExpression(endpointsProperty.body)) return;

      for (const property of endpointsProperty.body.properties) {
        if (!t.isObjectProperty(property)) continue;
        const endpointName = propertyKey(property.key);
        const call = property.value;
        if (!endpointName || !t.isCallExpression(call)) continue;
        const definition = call.arguments[0];
        if (!t.isObjectExpression(definition)) continue;

        const query = objectValue(definition, 'query');
        const api = resolveQueryDefinition(query, constants);
        if (api) endpoints.set(endpointName, api);
      }
    },
  });

  return endpoints;
}

function resolveQueryDefinition(node: t.Expression | null, constants: Map<string, string>): ApiCallInfo | null {
  if (!node) return null;
  if (t.isStringLiteral(node) || t.isTemplateLiteral(node) || t.isBinaryExpression(node) || t.isIdentifier(node)) {
    const url = expressionToUrl(node, constants);
    return url ? { method: 'GET', endpoint: url.value, isDynamic: url.isDynamic, rawUrl: url.value, resolver: 'rtk-query' } : null;
  }

  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    if (t.isStringLiteral(node.body) || t.isTemplateLiteral(node.body) || t.isBinaryExpression(node.body) || t.isIdentifier(node.body)) {
      const url = expressionToUrl(node.body, constants);
      return url ? { method: 'GET', endpoint: url.value, isDynamic: url.isDynamic, rawUrl: url.value, resolver: 'rtk-query' } : null;
    }
    if (t.isObjectExpression(node.body)) {
      const urlNode = objectValue(node.body, 'url');
      const methodNode = objectValue(node.body, 'method');
      const url = expressionToUrl(urlNode, constants);
      return url ? {
        method: methodNode && t.isStringLiteral(methodNode) ? methodNode.value.toUpperCase() as ApiCallInfo['method'] : 'GET',
        endpoint: url.value,
        isDynamic: url.isDynamic,
        rawUrl: url.value,
        resolver: 'rtk-query',
      } : null;
    }
  }

  return null;
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

function propertyKey(node: t.Node): string | null {
  if (t.isIdentifier(node)) return node.name;
  if (t.isStringLiteral(node)) return node.value;
  return null;
}
