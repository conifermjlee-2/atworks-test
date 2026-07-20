# 🚀 get-front-code-5: 프론트엔드 API 자동 분석기 기술 기획서

본 문서는 `get-front-code-5` 프로젝트의 요구사항, 시스템 아키텍처, 멀티 에이전트 하네스 구조 및 구현 명세를 정의하는 통합 기술 기획서입니다.

---

## 1. 개요 및 구축 목적

- **프로젝트 명**: `get-front-code-5` (프론트엔드 API 정적 분석기 v5)
- **목적**: 외부 인터넷 연결이 불가한 폐쇄망 환경에서 React 및 Next.js 프로젝트의 소스 코드를 정적 분석(Static Analysis)하여 화면(페이지/컴포넌트)별 호출 REST API를 역추적하고 매핑 보고서를 생성.
- **핵심 기술 스택**: Next.js (App Router), TypeScript 5.9.3, Babel 파서 코어 (`@babel/parser`, `@babel/traverse`, `@babel/types`), `enhanced-resolve`, `fast-glob`.

---

## 2. 핵심 아키텍처 및 순서도

```text
[ 분석 대상 프론트엔드 프로젝트 소스 코드 ]
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 프레임워크 어댑터 레이어 (NextAdapter / ReactAdapter)     │
│    - 소스 파일 스캔 및 필터링 (Route Handler 백엔드 라우트 무시)│
│    - 컴포넌트 지시어 탐지 ('use client', 'use server')       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AST 파서 & 순회 레이어                                   │
│    - @babel/parser (오류 복구 모드 기반 AST 노드 생성)       │
│    - ASTTraverser (배타적 소유권 기반 탐색 skip 처리)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 플러그인 리졸버 레이어 (HookResolver 인터페이스)          │
│    - ReactQueryResolver, RTKQueryResolver, SWRResolver 등   │
│    - 파일 간 심볼 역추적 및 경로 해석 (최대 깊이: 3단계)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 프리젠테이션 & API 레이어                                 │
│    - POST /api/analyze (순수 JSON 데이터 반환 API)          │
│    - 모던 아코디언 대시보드 UI (src/app/page.tsx)            │
└───────────────────────────┘
```

---

## 3. 7대 불변 구현 원칙

1. **백엔드/프론트엔드 관심사 완전 분리 (SoC)**
   - API 분석 엔진(`src/app/api/analyze/route.ts`)은 순수 JSON 데이터만을 반환합니다.
   - UI 대시보드(`src/app/page.tsx`)는 전달받은 결과를 시각화(아코디언 UI, HTTP Method별 색상 배지)하는 역할만 전담합니다.
2. **Next.js Route Handler 스캔 배제**
   - 프론트엔드 화면에서 호출하는 API를 추출하는 목적에 맞춰, `**/api/**/route.*` 등 서버 측 라우트 핸들러 파일은 분석 대상에서 제외합니다.
3. **배타적 소유권 메커니즘 (Exclusive Ownership)**
   - React Query, RTK Query 등 고수준 훅 리졸버가 노드 탐색에 성공하면 `path.skip()`을 실행하여 내부에 포함된 저수준 `axios`나 `fetch` 호출의 중복 수집을 원천 차단합니다.
4. **Max Depth 3 심볼 추적 제한**
   - 다른 파일의 유틸리티 함수나 커스텀 훅 참조를 역추적(Cross-file resolution)할 때 최대 재귀 깊이를 3단계로 제한하여 성능을 보호하고 무한 루프를 방지합니다.
5. **컴포넌트 지시어 판별**
   - `'use client'`, `'use server'` 지시어를 탐색하여 컴포넌트 유형(Client Component, Server Component, Server Action)을 자동 식별합니다.
6. **모노레포 및 경로 별칭(Alias) 동적 해석**
   - `tsconfig.json`의 `compilerOptions.paths` 구문을 동적으로 수집하여 `@/api/...` 형태의 심볼 경로를 물리적 실제 파일 경로로 해석합니다.
7. **TypeScript 5.9.3 고정**
   - Next.js 및 Babel AST 노드 인터페이스의 정적 타이핑 호환성 유지를 위해 `package.json`의 `typescript` 버전을 `5.9.3`으로 관리합니다.

---

## 4. 멀티 에이전트 하네스 (Harness) 체계

본 프로젝트는 `.claude` 하네스 및 에이전트 역할을 명확히 분리하여 5-Phase 파이프라인에 따라 구축되었습니다.

- **Phase 1 [아키텍트]**: 기본 뼈대 구축, 프레임워크 어댑터 및 공통 타입 작성
- **Phase 2 [AST 엔지니어]**: AST 파서, ASTTraverser 및 파이프라인 코어 오케스트레이터 구현
- **Phase 3 [플러그인 엔지니어]**: Axios/Fetch, React-Query, RTK-Query, SWR 4종 페칭 리졸버 및 심볼 역추적 구현
- **Phase 4 [UI & API 구축]**: 백엔드 REST API Route 및 모던 아코디언 UI 완성
- **Phase 5 [QA 검증]**: 빌드, 타입 검사 및 픽스처 기반 동작 테스트

---

## 5. 데이터 페칭 지원 리졸버 (Resolvers)

1. **`AxiosFetchResolver`**: `axios.get/post/put/delete`, `axios()`, Native `fetch()` 구문 파싱
2. **`ReactQueryResolver`**: `useQuery`, `useMutation` 훅 호출의 `queryFn` 파싱 및 `queryKey` 기반 Fallback
3. **`RTKQueryResolver`**: Redux Toolkit Query의 `createApi` 엔드포인트 수집(`init()`) 후 `useGet...Query` 훅 자동 매핑
4. **`SWRResolver`**: `useSWR`, `useSWRMutation` 훅의 key 문자열 및 fetcher 파싱

---

## 6. 백엔드 API 및 프론트엔드 UI 명세

- **분석 API**: `POST /api/analyze` (요청: `{ "targetPath": "분석_대상_경로" }`)
- **결과 데이터 구조**: `MappingResult` (총 페이지 수, 총 API 수, 화면별 매핑 목록 등)
- **프론트엔드 UI**: 다크 모드 기반 아코디언 대시보드, HTTP 메소드별 색상 배지(Blue: GET, Green: POST, Amber: PUT, Red: DELETE, Purple: PATCH)

---
*관련 세부 스펙 문서는 [plan-v5.md](file:///C:/Users/lee/Desktop/atworks-test/poc/get-front-code-5/plan/plan-v5.md)를 참고 바랍니다.*
