import * as t from '@babel/types';

/**
 * 기획서 7.3절: 템플릿 리터럴 치환
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
 * 기획서 7.3절: BaseURL 병합
 * baseURL + endpoint 중복 슬래시 없이 병합
 */
export function mergeBaseUrl(baseURL: string, endpoint: string): string {
  const cleanBase = baseURL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  if (!cleanBase) return `/${cleanEndpoint}`;
  if (!cleanEndpoint) return cleanBase;
  return `${cleanBase}/${cleanEndpoint}`;
}
