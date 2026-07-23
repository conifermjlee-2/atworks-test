import * as t from '@babel/types';

/**
 * plan-v5.md 6장: 동적 URL 템플릿 리터럴 정규화
 * `/users/${userId}` → `/users/{userId}` 형태로 정규화
 */
export function normalizeTemplateLiteral(node: t.TemplateLiteral): string {
  let result = '';
  const quasis = node.quasis;
  const expressions = node.expressions;

  for (let i = 0; i < quasis.length; i++) {
    result += quasis[i].value.raw;
    if (i < expressions.length) {
      const expr = expressions[i];
      if (t.isIdentifier(expr)) {
        result += `{${expr.name}}`;
      } else if (t.isMemberExpression(expr)) {
        result += `{param}`;
      } else {
        result += `{param}`;
      }
    }
  }
  return result;
}

/**
 * 엔드포인트 패턴 정규화 함수
 * - `${param}` 이나 `:param` 형태의 플레이스홀더를 `{param}` 형태로 통일
 */
export function normalizeEndpointPattern(pattern: string, args?: any[]): { endpoint: string; isDynamic: boolean } {
  let endpoint = pattern.replace(/\$\{(\w+)\}/g, '{$1}').replace(/:(\w+)/g, '{$1}');
  const isDynamic = endpoint.includes('{');
  return { endpoint, isDynamic };
}

