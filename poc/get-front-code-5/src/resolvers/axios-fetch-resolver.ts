import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod, HookResolver } from '../types';
import { normalizeTemplateLiteral } from '../core/parser/normalizer';

/**
 * plan-v5.md 4장: Axios & Fetch Resolver (항상 기본 활성화 — 저수준 Fallback)
 * axios.get/post/put/delete/patch(), fetch(), api.get() 등 순수 HTTP 클라이언트 추출
 */
export class AxiosFetchResolver implements HookResolver {
  name = 'Axios/Fetch Resolver';

  resolve(calleeName: string, args: any[]): ApiCallInfo | null {
    let method: HttpMethod = 'UNKNOWN';
    let isHttpClient = false;

    if (calleeName === 'fetch') {
      isHttpClient = true;
      method = this.extractFetchMethod(args);
    } else if (
      calleeName.startsWith('axios.') ||
      calleeName.startsWith('api.') ||
      calleeName.startsWith('client.') ||
      calleeName.startsWith('http.')
    ) {
      isHttpClient = true;
      const parts = calleeName.split('.');
      if (parts.length > 1) {
        const propName = parts[1].toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(propName)) {
          method = propName as HttpMethod;
        }
      }
    } else if (calleeName === 'axios') {
      // axios(url, { method: 'POST' }) 패턴
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
