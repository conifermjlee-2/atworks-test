import * as t from '@babel/types';

/**
 * 템플릿 리터럴 노드(`/users/${userId}`)를 분석하여
 * `/users/{userId}` 형태의 정규화된 문자열로 변환합니다.
 * 기획서 7.3: 템플릿 리터럴 치환 로직
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
        // 변수명이 명확한 경우 (예: ${userId} → {userId})
        result += `{${expr.name}}`;
      } else if (t.isMemberExpression(expr)) {
        // body.taskCode 처럼 점 표기법이면 → {param}으로 정규화
        result += `{param}`;
      } else {
        result += `{param}`;
      }
    }
  }
  return result;
}

/**
 * baseURL과 endpoint 문자열을 중복 슬래시(/) 없이 병합합니다.
 * 기획서 7.3: BaseURL 병합 로직
 */
export function mergeBaseUrl(baseURL: string, endpoint: string): string {
  const cleanBase = baseURL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');

  if (!cleanBase) return `/${cleanEndpoint}`;
  if (!cleanEndpoint) return cleanBase;

  return `${cleanBase}/${cleanEndpoint}`;
}
