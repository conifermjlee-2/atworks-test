import * as t from '@babel/types';
import { ApiCallInfo } from '../../types';
import { HookResolver } from './types';
import { normalizeTemplateLiteral } from '../normalizer';

export class SwrResolver implements HookResolver {
  resolve(calleeName: string, args: Array<t.Node | null>): ApiCallInfo | null {
    if (calleeName !== 'useSWR') {
      return null;
    }

    const firstArg = args[0];
    let endpoint = '';
    let isDynamic = false;

    if (t.isStringLiteral(firstArg)) {
      endpoint = firstArg.value;
    } else if (t.isTemplateLiteral(firstArg)) {
      endpoint = normalizeTemplateLiteral(firstArg);
      isDynamic = true;
    } else if (t.isArrayExpression(firstArg)) {
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
        method: 'GET', // SWR defaults to GET
        endpoint,
        isDynamic,
        rawUrl: endpoint
      };
    }

    return null;
  }
}
