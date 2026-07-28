# Frontend API Scenario Analyzer

React/Next.js 프로젝트를 정적 분석해서 API 호출 지점과 후행 동작을 컴포넌트별, 라우트별 문서로 생성하는 Node CLI입니다.

## 실행

```bash
npm run analyze -- <분석할_프로젝트_경로> --out docs/api-scenarios
```

예시:

```bash
npm run analyze -- ../my-next-app --out docs/api-scenarios
```

## 산출물

- `component-api-scenarios.md`: 컴포넌트/파일 단위 API 시나리오
- `route-api-scenarios.md`: Next.js 라우트 단위 API 시나리오
- `analysis-summary.json`: 기계 처리용 요약 데이터

## 분석 범위

- Next.js App Router / Pages Router 라우트 매핑
- `fetch`, `axios`, `apiClient`/`client`류 호출
- `useQuery`, `useMutation`, `useEffect`, `getServerSideProps`, `getStaticProps`
- `router.push`, `redirect`, `navigate`
- `invalidateQueries`, `refetch`
- `onError`, `catch`, `toast`, `alert`
- `enabled` 조건

정적 분석상 확정하기 어려운 동적 엔드포인트나 커스텀 래퍼는 `(추정)` 또는 `확인 필요`로 표시합니다.
