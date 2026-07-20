/**
 * 기획서 7.3절: 노이즈 필터링
 * Sentry, GA 등 API 통신과 무관한 외부 도메인 배제
 */
export function isAllowedUrl(url: string, ignoreDomains: string[] = []): boolean {
  const defaultIgnores = [
    'sentry.io',
    'google-analytics.com',
    'googletagmanager.com',
    'analytics.google.com',
    'gtag(',
  ];

  const combined = [...defaultIgnores, ...ignoreDomains];
  for (const domain of combined) {
    if (url.includes(domain)) return false;
  }
  return true;
}
