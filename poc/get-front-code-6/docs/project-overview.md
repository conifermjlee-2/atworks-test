# get-front-code-6 프로젝트 설명

`get-front-code-6`는 React 및 Next.js 프론트엔드 프로젝트의 소스 코드를 정적 분석해서, 화면별로 호출되는 REST API를 추출하는 로컬 분석 도구입니다. 인터넷 연결이 없는 폐쇄망 환경에서도 동작하도록 Babel AST 기반으로 파일을 읽고 분석합니다.

## 목적

- 프론트엔드 화면과 API 호출 간의 매핑을 자동 생성합니다.
- `fetch`, `axios`, React Query, SWR, RTK Query 사용 패턴을 분석합니다.
- Next.js App Router의 백엔드 Route Handler는 분석 대상에서 제외합니다.
- 분석 결과를 대시보드에서 확인하고 Markdown으로 복사할 수 있습니다.

## 기술 스택

- Next.js 15.1.0
- React 19
- TypeScript 5.9.3
- `@babel/parser`
- `@babel/traverse`
- `@babel/types`
- `fast-glob`
- `enhanced-resolve`

## 실행 방법

```bash
npm install
npm run dev -- -p 3006
```

브라우저에서 다음 주소로 접속합니다.

```text
http://localhost:3006
```

검증 명령은 다음과 같습니다.

```bash
npm run typecheck
npm run build
```

## 주요 화면

메인 대시보드는 `src/app/page.tsx`에 있습니다.

사용자는 분석 대상 로컬 폴더 경로를 입력한 뒤 분석을 실행합니다. 결과는 화면 단위 아코디언으로 표시되며, 각 API 호출은 HTTP Method, Endpoint, Resolver, 동적 URL 여부를 함께 보여줍니다.

## API

분석 API는 다음 엔드포인트를 사용합니다.

```http
POST /api/analyze
Content-Type: application/json
```

요청 Body:

```json
{
  "targetPath": "C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\..."
}
```

응답 예시:

```json
{
  "targetPath": "C:\\target\\frontend",
  "totalFiles": 3,
  "totalViews": 2,
  "totalApis": 6,
  "mappings": [
    {
      "file": "app/dashboard/page.tsx",
      "viewName": "/dashboard",
      "callType": "Client",
      "api": {
        "method": "GET",
        "endpoint": "/api/users",
        "isDynamic": false,
        "rawUrl": "/api/users",
        "resolver": "fetch"
      }
    }
  ],
  "errors": []
}
```

## 아키텍처

```text
사용자 입력 경로
  -> path-guard
  -> project-config
  -> source-adapter
  -> parser / constants / imports
  -> resolvers
  -> analyzer
  -> POST /api/analyze
  -> dashboard UI
```

## 주요 모듈

| 경로 | 역할 |
|---|---|
| `src/app/page.tsx` | 분석 실행 UI와 결과 대시보드 |
| `src/app/api/analyze/route.ts` | 분석 API 엔드포인트 |
| `src/core/analyzer.ts` | 전체 분석 흐름 조율 |
| `src/adapters/source-adapter.ts` | 분석 대상 파일 수집, Route Handler 제외, callType 판별 |
| `src/core/parser.ts` | Babel AST 파싱 |
| `src/core/imports.ts` | import 및 tsconfig paths alias 해석 |
| `src/core/constants.ts` | 문자열 상수 수집 |
| `src/core/url-expression.ts` | 문자열, 템플릿 리터럴, 덧셈 URL 표현 정규화 |
| `src/core/symbol-tracer.ts` | import된 유틸리티 함수 내부 API 호출 추적 |
| `src/resolvers/direct-resolver.ts` | `fetch`, `axios` 직접 호출 분석 |
| `src/resolvers/hook-resolver.ts` | React Query, SWR, RTK Query hook 사용 분석 |
| `src/resolvers/rtk-indexer.ts` | RTK Query `createApi` endpoint 사전 수집 |
| `src/types/index.ts` | 분석 결과 타입 정의 |

## 분석 지원 범위

### Fetch

```ts
fetch('/api/users');
fetch('/api/users', { method: 'POST' });
```

### Axios

```ts
axios.get('/api/users');
axios.post('/api/users');
axios({ url: '/api/users', method: 'DELETE' });
```

### React Query

```ts
useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users'),
});
```

### SWR

```ts
useSWR('/api/users', fetcher);
useSWRMutation('/api/users', mutationFetcher);
```

### RTK Query

```ts
createApi({
  endpoints: builder => ({
    getUsers: builder.query({
      query: () => '/api/users',
    }),
  }),
});

useGetUsersQuery();
```

## 보안 및 안정성

- `targetPath`가 비어 있거나 존재하지 않으면 분석하지 않습니다.
- 루트 디렉터리 직접 분석을 차단합니다.
- `..`가 포함된 상위 경로 이동 입력을 차단합니다.
- 파일 하나의 파싱 실패가 전체 분석 실패로 이어지지 않도록 `errors` 배열에 격리합니다.
- Babel parser는 `errorRecovery: true` 옵션을 사용합니다.

## 한계

- 런타임에만 결정되는 URL은 완전한 실제 값으로 복원할 수 없습니다.
- 동적 표현식은 `${identifier}` 형태로 최대한 원형을 보존합니다.
- 복잡한 고차 함수, 조건부 반환, 런타임 라우팅 조합은 일부 누락될 수 있습니다.
- React Query의 `queryKey` fallback은 실제 API가 아니라 키 기반 추정값일 수 있습니다.

## 현재 상태

- 타입체크 통과
- 프로덕션 빌드 통과
- 샘플 Next.js 프로젝트 대상 `/api/analyze` 호출 검증 완료
- 개발 서버 포트: `3006`
