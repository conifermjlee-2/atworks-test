import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod } from '../../types';
import { HookResolver } from './types';
import { normalizeTemplateLiteral } from '../normalizer';

export class AxiosFetchResolver implements HookResolver {
  resolve(calleeName: string, args: Array<t.Node | null>): ApiCallInfo | null {
    let method: HttpMethod = 'UNKNOWN';
    let isAxiosOrFetch = false;

    if (calleeName === 'fetch') {
      isAxiosOrFetch = true;
      method = this.extractFetchMethod(args);
    } else if (calleeName.startsWith('axios.')) {
      isAxiosOrFetch = true;
      const parts = calleeName.split('.');
      if (parts.length > 1) {
        const propName = parts[1].toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(propName)) {
          method = propName as HttpMethod;
        }
      }
    } else if (calleeName === 'axios') {
       isAxiosOrFetch = true;
       method = this.extractFetchMethod(args); // axios(url, { method: 'POST' }) pattern
    }

    if (!isAxiosOrFetch) return null;

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
      return {
        method,
        endpoint,
        isDynamic,
        rawUrl: endpoint
      };
    }

    return null;
  }

  private extractFetchMethod(args: Array<t.Node | null>): HttpMethod {
    if (args.length > 1) {
      const initArg = args[1];
      if (t.isObjectExpression(initArg)) {
        for (const prop of initArg.properties) {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'method') {
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
