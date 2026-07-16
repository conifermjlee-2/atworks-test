import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod } from '../../types';
import { HookResolver } from './types';
import { normalizeTemplateLiteral } from '../normalizer';

/**
 * 기획서 6.2: React Query Resolver (TanStack Query)
 * 우선순위: queryFn 콜백 내부 추적 → queryKey 배열 휴리스틱(Fallback)
 */
export class ReactQueryResolver implements HookResolver {
  resolve(calleeName: string, args: Array<t.Node | null>): ApiCallInfo | null {
    if (calleeName !== 'useQuery' && calleeName !== 'useMutation') {
      return null;
    }

    const firstArg = args[0];
    let endpoint = '';
    let isDynamic = false;
    let method: HttpMethod = calleeName === 'useMutation' ? 'POST' : 'GET';

    if (t.isObjectExpression(firstArg)) {
      // 기획서 6.2 최우선: queryFn 콜백 내부의 실제 HTTP 호출 추적
      const queryFnResult = this.extractFromQueryFn(firstArg);
      if (queryFnResult) {
        return queryFnResult;
      }

      // 기획서 6.2 Fallback: queryKey 배열 휴리스틱
      endpoint = this.extractQueryKeyUrl(firstArg);
      isDynamic = endpoint.includes('{');
    } else if (t.isArrayExpression(firstArg)) {
      // useQuery(['/users'], ...) React Query v3
      const firstEl = firstArg.elements[0];
      if (t.isStringLiteral(firstEl)) {
        endpoint = firstEl.value;
      } else if (t.isTemplateLiteral(firstEl)) {
        endpoint = normalizeTemplateLiteral(firstEl);
        isDynamic = true;
      }
    }

    if (endpoint) {
      return { method, endpoint, isDynamic, rawUrl: endpoint };
    }

    return null;
  }

  /**
   * queryFn: () => axios.get('/users') 콜백 내부에서 실제 HTTP URL 추적
   */
  private extractFromQueryFn(objNode: t.ObjectExpression): ApiCallInfo | null {
    for (const prop of objNode.properties) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === 'queryFn'
      ) {
        const fnBody = this.getFunctionBody(prop.value);
        if (!fnBody) continue;

        // 콜백 내부에서 axios.get/post/... 또는 fetch 패턴 탐색
        const httpCall = this.findHttpCallInBody(fnBody);
        if (httpCall) return httpCall;
      }
    }
    return null;
  }

  private getFunctionBody(node: t.Node): t.BlockStatement | t.Expression | null {
    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      return node.body;
    }
    return null;
  }

  private findHttpCallInBody(body: t.BlockStatement | t.Expression): ApiCallInfo | null {
    // 단일 표현식 (async () => axios.get('/url'))
    if (t.isCallExpression(body)) {
      return this.extractFromHttpCall(body);
    }

    if (t.isBlockStatement(body)) {
      for (const stmt of body.body) {
        const found = this.searchStatement(stmt);
        if (found) return found;
      }
    }
    return null;
  }

  private searchStatement(stmt: t.Statement): ApiCallInfo | null {
    if (t.isReturnStatement(stmt) && stmt.argument) {
      if (t.isCallExpression(stmt.argument)) {
        return this.extractFromHttpCall(stmt.argument);
      }
      // await axios.get(...)
      if (t.isAwaitExpression(stmt.argument) && t.isCallExpression(stmt.argument.argument)) {
        return this.extractFromHttpCall(stmt.argument.argument);
      }
    }
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      return this.extractFromHttpCall(stmt.expression);
    }
    return null;
  }

  private extractFromHttpCall(callNode: t.CallExpression): ApiCallInfo | null {
    const callee = callNode.callee;
    let methodName = '';

    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      const methodStr = callee.property.name.toUpperCase();
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodStr)) {
        methodName = methodStr;
      }
    } else if (t.isIdentifier(callee) && callee.name === 'fetch') {
      methodName = 'GET'; // fetch 기본은 GET
    }

    if (!methodName) return null;

    const firstArg = callNode.arguments[0];
    let endpoint = '';
    let isDynamic = false;

    if (t.isStringLiteral(firstArg)) {
      endpoint = firstArg.value;
    } else if (t.isTemplateLiteral(firstArg)) {
      endpoint = normalizeTemplateLiteral(firstArg);
      isDynamic = true;
    }

    if (endpoint) {
      return {
        method: methodName as HttpMethod,
        endpoint,
        isDynamic,
        rawUrl: endpoint
      };
    }
    return null;
  }

  private extractQueryKeyUrl(objNode: t.ObjectExpression): string {
    for (const prop of objNode.properties) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === 'queryKey'
      ) {
        const value = prop.value;
        if (t.isArrayExpression(value)) {
          const firstEl = value.elements[0];
          if (t.isStringLiteral(firstEl)) return firstEl.value;
          if (t.isTemplateLiteral(firstEl)) return normalizeTemplateLiteral(firstEl);
        }
      }
    }
    return '';
  }
}
