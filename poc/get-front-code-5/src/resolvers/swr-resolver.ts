import * as t from '@babel/types';
import { ApiCallInfo, HookResolver } from '../types';
import { normalizeTemplateLiteral } from '../core/parser/normalizer';

/**
 * 기획서 6.4절: SWR Resolver (Vercel)
 * useSWR의 첫 번째 인자(키 = URL)를 추출. 메서드는 항상 GET.
 */
export class SwrResolver implements HookResolver {
  name = 'SWR Resolver';

  resolve(calleeName: string, args: any[]): ApiCallInfo | null {
    if (calleeName !== 'useSWR') return null;

    const firstArg = args[0];
    let endpoint = '';
    let isDynamic = false;

    if (t.isStringLiteral(firstArg)) {
      endpoint = firstArg.value;
    } else if (t.isTemplateLiteral(firstArg)) {
      endpoint = normalizeTemplateLiteral(firstArg);
      isDynamic = true;
    } else if (t.isArrayExpression(firstArg)) {
      // useSWR(['/api/user', token]) 패턴
      const firstEl = firstArg.elements[0];
      if (t.isStringLiteral(firstEl)) {
        endpoint = firstEl.value;
      } else if (t.isTemplateLiteral(firstEl)) {
        endpoint = normalizeTemplateLiteral(firstEl);
        isDynamic = true;
      }
    }

    if (endpoint) {
      return { method: 'GET', endpoint, isDynamic, rawUrl: endpoint };
    }
    return null;
  }
}
