/**
 * 호출된 대상 URL이 외부의 노이즈성 서비스(애널리틱스 등)인지 필터링합니다.
 */
export function isAllowedUrl(url: string, ignoreDomains: string[] = []): boolean {
  // 기본적으로 차단할 노이즈 도메인들
  const defaultIgnores = [
    'sentry.io',
    'google-analytics.com',
    'googletagmanager.com'
  ];
  
  const combinedIgnores = [...defaultIgnores, ...ignoreDomains];
  
  for (const domain of combinedIgnores) {
    if (url.includes(domain)) {
      return false; // 무시할 대상이면 false 반환
    }
  }
  return true;
}

/**
 * 호출 대상(callee) 이름이 실제 우리가 추적할 가치가 있는 API 클라이언트인지 확인합니다.
 */
export function isTargetCallee(calleeName: string, wrapperFunctions: string[] = []): boolean {
  // 기본적으로 fetch, axios 및 자주 쓰이는 api, client 등의 변수명을 허용
  const allowed = ['fetch', 'axios', 'api', 'client', 'useSWR', 'useQuery', 'useMutation', ...wrapperFunctions];
  
  return allowed.some(allowedName => 
    calleeName === allowedName || 
    calleeName.includes(`.${allowedName}`) || 
    calleeName.startsWith(allowedName)
  );
}
