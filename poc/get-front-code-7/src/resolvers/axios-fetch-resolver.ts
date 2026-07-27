import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ApiCallInfo, HttpMethod, HookResolver } from '../types';
import { normalizeTemplateLiteral } from '../core/parser/normalizer';

/**
 * 변수 식별자(Identifier - e.g. let url = '/api/v1/users') 값 및 
 * 제어흐름 상의 모든 재할당(Assignment - e.g. url = '/api/v2/users') 값 다중 추적
 */
function resolveVariableValue(varName: string, scopeNode?: t.Node): string | null {
  if (!scopeNode) return null;
  const values = new Set<string>();
  
  try {
    traverse(scopeNode as any, {
      VariableDeclarator(p) {
        if (t.isIdentifier(p.node.id) && p.node.id.name === varName && p.node.init) {
          if (t.isStringLiteral(p.node.init)) {
            values.add(p.node.init.value);
          } else if (t.isTemplateLiteral(p.node.init)) {
            values.add(normalizeTemplateLiteral(p.node.init));
          }
        }
      },
      AssignmentExpression(p) {
        if (t.isIdentifier(p.node.left) && p.node.left.name === varName) {
          if (t.isStringLiteral(p.node.right)) {
            values.add(p.node.right.value);
          } else if (t.isTemplateLiteral(p.node.right)) {
            values.add(normalizeTemplateLiteral(p.node.right));
          }
        }
      }
    });
  } catch (err) {
    // ignore
  }
  
  if (values.size === 0) return null;
  return Array.from(values).join(' | ');
}

/**
 * Axios & Fetch Resolver (v5.3 — Control Flow Multi-capture Upgraded)
 * - axios.get/post/put/delete/patch(), fetch(), api.get() 기본 HTTP 클라이언트 추출
 * - myCustomHttpClient, *HttpClient, *Client 등 커스텀 인스턴스 패턴 및 .download() 지원
 * - 변수(Identifier - e.g. let url = '...') 선언 및 제어 분기 내 재할당 다중 스캔 지원
 */
export class AxiosFetchResolver implements HookResolver {
  name = 'Axios/Fetch Resolver';

  resolve(calleeName: string, args: any[], scopeNode?: t.Node): ApiCallInfo | null {
    let method: HttpMethod = 'UNKNOWN';
    let isHttpClient = false;

    if (calleeName === 'fetch') {
      isHttpClient = true;
      method = this.extractFetchMethod(args);
    } else if (
      calleeName.startsWith('axios.') ||
      calleeName.startsWith('api.') ||
      calleeName.startsWith('client.') ||
      calleeName.startsWith('http.') ||
      calleeName.toLowerCase().includes('client.') ||
      calleeName.toLowerCase().includes('http.')
    ) {
      isHttpClient = true;
      const parts = calleeName.split('.');
      if (parts.length > 1) {
        const propName = parts[parts.length - 1].toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(propName)) {
          method = propName as HttpMethod;
        } else if (propName === 'DOWNLOAD') {
          method = 'GET';
        }
      }
    } else if (calleeName === 'axios') {
      isHttpClient = true;
      method = this.extractFetchMethod(args);
    }

    if (!isHttpClient) return null;

    const firstArg = args[0];
    let endpoint = '';
    let isDynamic = false;

    if (t.isStringLiteral(firstArg)) {
      endpoint = firstArg.value;
    } else if (t.isTemplateLiteral(firstArg)) {
      endpoint = normalizeTemplateLiteral(firstArg);
      isDynamic = true;
    } else if (t.isIdentifier(firstArg)) {
      // 변수로 전달된 경우(let url = '...'), AST 변수 선언부를 추적하여 값 복원
      const resolvedVar = resolveVariableValue(firstArg.name, scopeNode);
      if (resolvedVar) {
        endpoint = resolvedVar;
        isDynamic = resolvedVar.includes('{');
      } else {
        endpoint = `{${firstArg.name}}`;
        isDynamic = true;
      }
    }

    if (endpoint) {
      return { method, endpoint, isDynamic, rawUrl: endpoint };
    }

    return null;
  }

  private extractFetchMethod(args: any[]): HttpMethod {
    if (args.length > 1) {
      const initArg = args[1];
      if (t.isObjectExpression(initArg)) {
        for (const prop of initArg.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            prop.key.name === 'method'
          ) {
            if (t.isStringLiteral(prop.value)) {
              const m = prop.value.value.toUpperCase();
              if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(m)) {
                return m as HttpMethod;
              }
            }
          }
        }
      }
    }
    return 'GET';
  }
}
