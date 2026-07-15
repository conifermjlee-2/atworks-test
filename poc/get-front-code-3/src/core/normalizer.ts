import * as t from '@babel/types';

/**
 * 템플릿 리터럴 노드(`/users/${userId}`)를 분석하여
 * `/users/{userId}` 형태의 정규화된 문자열로 변환합니다.
 */
export function normalizeTemplateLiteral(node: t.TemplateLiteral): string {
  let result = '';
  const quasis = node.quasis;
  const expressions = node.expressions;

  for (let i = 0; i < quasis.length; i++) {
    result += quasis[i].value.raw;
    if (i < expressions.length) {
      const expr = expressions[i];
      // 변수명이 명확한 경우 해당 변수명을 중괄호에 넣음 (예: {userId})
      if (t.isIdentifier(expr)) {
        result += `{${expr.name}}`;
      } else {
        // 복잡한 연산식인 경우 단순 {param} 처리
        result += `{param}`;
      }
    }
  }
  return result;
}

/**
 * baseURL과 endpoint 문자열을 중복 슬래시(/) 없이 병합합니다.
 */
export function mergeBaseUrl(baseURL: string, endpoint: string): string {
  const cleanBase = baseURL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  
  if (!cleanBase) return `/${cleanEndpoint}`;
  if (!cleanEndpoint) return cleanBase;
  
  return `${cleanBase}/${cleanEndpoint}`;
}
