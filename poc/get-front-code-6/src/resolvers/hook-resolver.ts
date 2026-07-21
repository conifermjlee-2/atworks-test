import * as t from '@babel/types';
import type { ApiCallInfo } from '@/types';
import { expressionToUrl } from '@/core/url-expression';
import { resolveDirectCall } from './direct-resolver';

export function resolveReactQuery(node: t.CallExpression, constants: Map<string, string>): ApiCallInfo | null {
  if (!t.isIdentifier(node.callee) || !['useQuery', 'useMutation'].includes(node.callee.name)) return null;
  const objectArg = node.arguments.find(t.isObjectExpression);
  if (objectArg) {
    const queryFn = objectValue(objectArg, node.callee.name === 'useMutation' ? 'mutationFn' : 'queryFn');
    const nested = firstUrlLikeCall(queryFn, constants);
    if (nested) return { ...nested, resolver: 'react-query' };
    const queryKey = objectValue(objectArg, 'queryKey');
    const fallback = expressionToUrl(queryKey, constants);
    if (fallback) return { method: 'GET', endpoint: fallback.value, isDynamic: fallback.isDynamic, rawUrl: fallback.value, resolver: 'react-query' };
  }
  return null;
}

export function resolveSWR(node: t.CallExpression, constants: Map<string, string>): ApiCallInfo | null {
  if (!t.isIdentifier(node.callee) || !['useSWR', 'useSWRMutation'].includes(node.callee.name)) return null;
  const url = expressionToUrl(node.arguments[0], constants);
  if (!url) return null;
  return { method: 'GET', endpoint: url.value, isDynamic: url.isDynamic, rawUrl: url.value, resolver: 'swr' };
}

export function resolveRtkUsage(node: t.CallExpression, rtkEndpoints: Map<string, ApiCallInfo>): ApiCallInfo | null {
  if (!t.isIdentifier(node.callee)) return null;
  const match = node.callee.name.match(/^use(.+)(Query|Mutation)$/);
  if (!match) return null;
  const endpointName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
  const api = rtkEndpoints.get(endpointName);
  return api ? { ...api, resolver: 'rtk-query' } : null;
}

function firstUrlLikeCall(node: t.Node | null, constants: Map<string, string>): ApiCallInfo | null {
  if (!node) return null;
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    if (t.isCallExpression(node.body)) return urlFromCall(node.body, constants);
    if (t.isBlockStatement(node.body)) {
      for (const statement of node.body.body) {
        if (t.isReturnStatement(statement) && t.isCallExpression(statement.argument)) {
          return urlFromCall(statement.argument, constants);
        }
      }
    }
  }
  return null;
}

function urlFromCall(node: t.CallExpression, constants: Map<string, string>): ApiCallInfo | null {
  return resolveDirectCall(node, constants);
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
