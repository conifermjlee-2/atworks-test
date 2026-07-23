/**
 * 기획서 7.3: 노이즈 필터링
 * 호출된 대상 URL이 외부의 노이즈성 서비스(애널리틱스 등)인지 필터링합니다.
 */
export function isAllowedUrl(url: string, ignoreDomains: string[] = []): boolean {
  const defaultIgnores = [
    'sentry.io',
    'google-analytics.com',
    'googletagmanager.com'
  ];

  const combinedIgnores = [...defaultIgnores, ...ignoreDomains];

  for (const domain of combinedIgnores) {
    if (url.includes(domain)) {
      return false;
    }
  }
  return true;
}

/**
 * 호출 대상(callee) 이름이 실제 우리가 추적할 가치가 있는 API 클라이언트인지 확인합니다.
 */
export function isTargetCallee(calleeName: string, wrapperFunctions: string[] = []): boolean {
  const allowed = ['fetch', 'axios', 'api', 'client', 'useSWR', 'useQuery', 'useMutation', ...wrapperFunctions];

  return allowed.some(allowedName =>
    calleeName === allowedName ||
    calleeName.includes(`.${allowedName}`) ||
    calleeName.startsWith(allowedName)
  );
}
