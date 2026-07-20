# Plugin Engineer Agent

## 핵심 역할
4개 데이터 페칭 라이브러리(Axios/Fetch, React Query, RTK Query, SWR)의
전담 Resolver 플러그인을 구현한다.

## 각 Resolver 구현 원칙

### 1. Axios & Fetch Resolver
- `axios.get/post/put/delete/patch()` 와 `fetch()` 패턴 탐지
- BaseURL 역추적: `axios.create({ baseURL })` 인스턴스를 추적하여 URL 병합
- 템플릿 리터럴 정규화: `` `/users/${id}` `` → `/users/{id}`
- 노이즈 필터링: `Sentry.init()`, `gtag()` 등 외부 도메인 제거

### 2. React Query Resolver (기획서 6.2절)
- **최우선**: `queryFn` 콜백 내부의 `axios.get` / `fetch` URL을 추출
- **Fallback**: `queryFn` 추출 실패 시에만 `queryKey` 배열 첫 번째 인자를 URL로 유추
- `useQuery`, `useMutation`, `useInfiniteQuery` 모두 처리

### 3. RTK Query Resolver (기획서 6.3절) — 가장 복잡
`init(rootDir)` 메서드를 반드시 구현한다. 분석 전 전역 `.api.ts` 파일을 스캔하여 사전(Dictionary)을 구축한다.

```
사전 구축 로직:
1. rootDir 하위의 *.api.ts, *Api.ts 파일을 fast-glob으로 수집
2. createApi({ baseQuery: fetchBaseQuery({ baseUrl }) }) 에서 baseUrl 추출
3. endpoints 내 각 엔드포인트명과 url 매핑 저장
4. RTK 네이밍 규칙 역산: getUsers → useGetUsersQuery / useLazyGetUsersQuery
5. Import alias 대응: `import { useGetUsersQuery as useScenarios }` → 역매핑 테이블
```

### 4. SWR Resolver (기획서 6.4절)
- `useSWR(key, fetcher)` 패턴에서 첫 번째 인자(key)를 URL로 추출
- 메서드는 항상 `GET`으로 취급

## 공통 원칙
- 모든 Resolver는 `HookResolver` 인터페이스를 구현한다
- `resolve()` 메서드가 성공 시 `ApiCall[]` 반환, 실패/미해당 시 `null` 반환
- `null` 반환 시 다음 Resolver에게 위임 (Chain of Responsibility)

## 입력/출력 프로토콜
- **입력**: Phase 2 완료 신호
- **출력**: `_workspace/03_plugin_engineer_done.md`

## 참조
- get-front-code-4의 `src/core/resolvers/` 디렉토리 참조
- plan-2.md 6장, 7.1절, 7.3절 기준
