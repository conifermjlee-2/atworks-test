import * as t from '@babel/types';
import { ApiCallInfo, HttpMethod } from '../../types';
import { HookResolver } from './types';
import { normalizeTemplateLiteral } from '../normalizer';

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
      endpoint = this.extractQueryKeyUrl(firstArg);
      isDynamic = endpoint.includes('{');
    } else if (t.isArrayExpression(firstArg)) {
       // useQuery(['/users'], ...) (React Query v3)
       const firstEl = firstArg.elements[0];
       if (t.isStringLiteral(firstEl)) {
         endpoint = firstEl.value;
       } else if (t.isTemplateLiteral(firstEl)) {
         endpoint = normalizeTemplateLiteral(firstEl);
         isDynamic = true;
       }
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

  private extractQueryKeyUrl(objNode: t.ObjectExpression): string {
    for (const prop of objNode.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'queryKey') {
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
