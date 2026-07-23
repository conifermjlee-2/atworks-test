# 🚀 프론트엔드 프로젝트 자동 분석기 구축 기획서 (v6 - get-front-code-4 통합 및 안정화 버전)

## 1. 개요
본 시스템은 **폐쇄망 환경(인터넷 미연결)**에서 동작하며, 프론트엔드 프로젝트 코드를 정적 분석(Static Analysis)하여 **"화면별 호출 API 매핑 목록"**을 자동으로 역추적하고 추출하는 최적화된 도구입니다.

기존 버전(v2, v3, v4)의 강점들과 합의된 핵심 설계 사상(정확도, 커버리지 등)을 하나로 통합하고, **백엔드(API)와 프론트엔드(UI)의 관심사를 완벽히 분리한 가장 안정적이고 완성된 버전(get-front-code-4)**에 대한 설계 문서입니다.

---

## 2. 분석 대상 및 목표 스펙
시장의 프론트엔드 생태계 점유율과 개발 리소스의 '선택과 집중'을 고려하여, **React 및 Next.js 생태계를 1차 타겟(Phase 1)**으로 확정하였습니다.

### 2.1. 프레임워크 지원 범위
| 프레임워크 | 시장 점유율 | 지원 여부 | 비고 및 대응 계획 |
| :--- | :--- | :--- | :--- |
| **React** (Next.js 포함) | 약 80% | ✅ **Phase 1** | 우선 개발 대상 |
| **Vue 3** | 약 14% | ⏳ Phase 2 | 향후 지원 예정 (현재 Phase 1에서는 미지원) |
| Svelte / Angular 등 | 약 6% | 향후 확장 | |

### 2.2. 스코프 아웃 (기술적으로 명시 제외되는 항목)
| 통신 방식 / 항목 | 사유 | 대응 계획 |
| :--- | :--- | :--- |
| **GraphQL** (Apollo 등) | REST와 AST 패턴이 근본적으로 달라 별도 파서 로직 필요 | Phase 2 이후 재검토. Phase 1은 "REST API만 대상" |

### 2.3. Phase 1 검증 방법론
본 분석기의 신뢰성을 담보하기 위해 다음 3단계 검증 프로세스를 거칩니다.
1. **단위 테스트 픽스처(Fixture) 검증**: React Query, RTK Query, Axios 등 각 라이브러리별로 발생할 수 있는 극단적 엣지 케이스(Edge-case) 코드를 모아둔 `__fixtures__` 폴더를 대상으로 파서를 돌려 자동 검증합니다.
2. **백엔드 명세서(Swagger/OpenAPI) 교차 검증**: 프론트엔드 분석기가 추출한 최종 API 리포트를 백엔드의 실제 Swagger API 엔드포인트 목록과 Diff(비교) 대조하여 누락되거나 잘못 추출된 API를 산출합니다.
3. **블라인드 수동 샘플링**: 사내 프로젝트 중 임의의 화면(Page)을 블라인드 선정하여, 개발자가 직접 눈으로 소스코드를 까서 찾은 API 목록(Manual Ground Truth)과 분석기 리포트를 대조하여 평가합니다.

---

## 3. 도입 예정 오픈소스 및 라이브러리 목록
본 분석기 개발 파이프라인에 사용될 핵심 라이브러리입니다. (모두 폐쇄망 로컬 실행 가능)

| 라이브러리 명 | 분류 | 역할 및 도입 목적 |
| :--- | :--- | :--- |
| **`@babel/parser`** | AST 파서 | JavaScript/TypeScript 코드를 메모리 상의 AST 객체로 파싱 |
| **`@babel/traverse`** | AST 횡단/추적 | 생성된 AST 트리를 순회하며 특정 함수 호출 구문이나 Import 연결 고리 추적 |
| **`@babel/types`** | AST 헬퍼 | AST 노드의 타입을 안전하고 정확하게 판별(`t.isCallExpression()`)하여 구현의 견고함 향상 |
| **`enhanced-resolve`** | 모듈/경로 해석기 | `tsconfig` 등에 설정된 복잡한 절대경로(Alias, 예: `@/api`)를 물리적 파일 경로로 치환 |
| **`fast-glob`** | 파일 스캐너 | 지정된 프레임워크 라우터 규칙(`src/pages/**` 등)에 부합하는 대상 파일을 초고속 스캔 |

---

## 4. 핵심 아키텍처: 플러그인 기반 다중 레이어 구조 및 관심사 분리
본 분석기의 핵심은 프레임워크 의존성을 제거하는 **Adapter 레이어**와, 데이터 페칭 라이브러리 의존성을 제거하는 **Plugin(Resolver) 레이어**를 완벽하게 분리한 확장성 높은 아키텍처입니다.
더불어, 백엔드(API)는 순수 JSON 데이터만 반환하고 렌더링은 프론트엔드(UI)가 전담하는 **관심사 분리(Separation of Concerns)** 원칙을 엄격하게 준수합니다. 
(백엔드 API 역할은 `src/app/api/analyze/route.ts`가 담당하며, 프론트엔드 UI 역할은 `src/app/page.tsx`가 전담합니다.)

### 4.1. 유연한 스캔 범위 및 모노레포(Monorepo) 대응 규칙
단일 레포지토리뿐만 아니라 Nx, Turborepo 등 모노레포 환경에서도 공용 패키지를 완벽하게 추적할 수 있도록 구체적인 스캔 규칙을 적용합니다.

* **초기 스캔 진입점 (앱 레벨)**: 프레임워크 라우팅 규칙에 따른 UI 진입점(예: `apps/web/app/`, `apps/admin/src/pages/`)을 최우선 스캔하여 무의미한 전체 파일 스캔을 막습니다.
* **공용 패키지(Shared Packages) 스캔 규칙**:
  * 모노레포 환경에서 API 통신 로직이 공용 패키지(예: `packages/api-client`, `packages/shared-hooks`)로 분리되어 있을 경우, 단순한 상대 경로(`../`) 추적만으로는 한계가 있습니다.
  * **Workspace 매핑 (Alias)**: `package.json`의 `workspaces` 필드 또는 `tsconfig.json`의 `paths`를 분석기가 파싱하여, `@my-org/api-client` 같은 패키지 임포트를 물리적인 로컬 파일 경로(`../../packages/api-client/src/index.ts`)로 동적 치환(Resolve)하여 쫓아갑니다.
  * **On-demand 추적 파싱**: 앱 레벨 컴포넌트에서 공용 패키지의 함수를 호출한 경우에만 해당 공용 패키지의 파일을 선별적으로 열어서(AST Parsing) 내부의 Axios/Fetch 호출을 추적합니다.

### 아키텍처 구조도 (v6 기준)
```text
[1. 프레임워크 판별 및 Adapter 로드] ── package.json 분석
      │  ├─ Next Adapter (app/**/page.tsx 등)
      │  └─ React Adapter (src/pages/** 등)
      ▼
[2. 오케스트레이터 (Analyzer)] 
      │  package.json의 의존성(dependencies)을 분석하여 최적화된 Resolver 플러그인만 동적 로드
      │  이후 로드된 플러그인들의 초기화(init) 수행 
      ▼
[3. AST 파싱 및 순회 (Traverser)] 
      │  Adapter가 찾은 UI 컴포넌트들을 하나씩 AST로 변환 후 순회
      ▼
[4. 플러그인 기반 데이터 페칭 추출 (Hook Resolvers)] ── 플러그인 체인 ──┐
      │  Traverser는 함수 호출을 발견하면 '현재 로드된' 플러그인에 매핑을 위임 │
      │  ├─ Axios/Fetch Resolver (기본 활성화 - 순수 HTTP 클라이언트)    │
      │  ├─ React Query Resolver (해당 라이브러리 사용 시에만 활성화)    │
      │  ├─ RTK Query Resolver (해당 라이브러리 사용 시에만 활성화)      │
      │  └─ SWR Resolver (해당 라이브러리 사용 시에만 활성화)            │
      ▼                                                                 ▼
[5. API 응답 (Backend)] 순수 JSON 데이터 규격 반환 (`{ targetDir, results }`)
      ▼
[6. 화면 렌더링 (Frontend)] JSON 데이터를 파싱하여 모던 아코디언 UI 및 배지(Badge) 렌더링
```

---

## 5. 프레임워크 분석 어댑터 (Framework Adapters)
프레임워크별 라우팅과 렌더링 방식의 차이를 추상화하여 파서 엔진이 동일한 인터페이스로 분석할 수 있도록 합니다.

### 5.1. Next.js App Router 환경의 '분리 규칙' (리포트 오염 방지)
Next.js App Router 구조에서는 화면(UI)을 담당하는 `page.tsx`와 백엔드 API 역할을 담당하는 `route.ts`가 물리적으로 같은 `app/` 폴더 트리에 섞여 있습니다. 이 구조적 특성 때문에 무차별 스캔을 수행할 경우, **"API를 호출하는 화면"**과 **"API 자체를 제공하는 코드"**가 리포트에 뒤섞여 방향성이 거꾸로 왜곡되는 치명적인 오염 문제가 발생합니다. (예: `route.ts` 화면이 DB나 내부 API를 호출한다고 잘못 리포팅됨)

이를 방지하기 위해 스캔 단계에서 다음과 같은 **엄격한 분리 규칙(필터링 및 라벨링)**을 적용합니다.

1. **Route Handler 완전 배제 (스캔 차단)**
   * **판별**: 파일 경로가 `/api/`를 포함하면서 파일명이 `route.ts`(또는 `.js`)인 경우, 이는 화면이 아니라 **"API 정의부(Backend)"**입니다.
   * **처리 규칙**: 어댑터의 고속 스캔 단계에서 `ignore: ['**/api/**/route.*']` 패턴을 선제적으로 적용하여, 해당 파일 내부의 `fetch()` 통신 코드가 화면의 API 호출로 오진(False Positive)되는 것을 원천 차단합니다.
2. **지시어(Directive) 기반 컴포넌트 분리 표기**
   * **Client Component (`'use client'`)**: 최상단에 이 지시어가 있으면, 브라우저단에서 발생하는 동적 데이터 페칭 컴포넌트로 판별합니다.
   * **Server Component**: 지시어가 없는 `app/` 하위의 컴포넌트는 서버 단에서 렌더링 시 발생하는 API 호출로 분류합니다.
   * **Server Action (`'use server'`)**: 폼 제출 등 서버 함수이므로 일반적인 화면 호출과는 성격이 다름을 인지하고 명확히 분리 표기(Badge)합니다.

---

## 6. 데이터 페칭 라이브러리 지원 (Plugin Resolvers)
엔진(Traverser)은 특정 라이브러리의 문법을 직접 알지 못하며, 4개의 핵심 플러그인이 각각의 사양(Specification)에 맞춰 패턴을 전담 추적합니다.

### 지원 라이브러리 선정 배경 (Phase 1)
현대 프론트엔드 생태계에서 가장 널리 쓰이는 상위 4개 데이터 페칭 도구를 1차 지원 대상으로 선정하여 실무 커버리지를 극대화했습니다.

| 라이브러리 (점유율 순) | 특징 및 선정 사유 (Why?) |
| :--- | :--- |
| **1. Axios / Fetch** | 데이터 통신의 가장 순수한 기본 형태이자 압도적 1위 클라이언트. 다른 고급 라이브러리의 내부 통신용으로도 쓰이므로 분석 필수 대상. |
| **2. React Query** | 캐싱, 상태 관리를 자동화해주는 모던 프론트엔드의 사실상 표준(De facto standard). 신규 프로젝트 도입률 1위. |
| **3. RTK Query** | 거대한 기업형(Enterprise) 대규모 시스템 및 사내 인프라에서 매우 널리 쓰이는 Redux 기반의 강력한 데이터 페칭 도구. |
| **4. SWR** | Next.js 제작사(Vercel)가 만든 도구로, 설정이 직관적이고 가벼워 Next.js 생태계 내에서 확고한 매니아층을 보유함. |

### 6.1. Axios & Fetch Resolver
* `axios.get()`, `fetch(url, { method: 'POST' })` 등 기본 HTTP 클라이언트의 메서드와 URL 추출.

### 6.2. React Query Resolver (TanStack Query)
* **최우선 추적 (queryFn 콜백)**: `queryKey`는 캐시 키일 뿐, 실제 URL이 아닌 경우가 실무에서 훨씬 많습니다. 따라서 `queryFn: () => axios.get('/users')` 내부에 존재하는 실제 HTTP 통신(Axios/Fetch)의 인자를 파싱하는 것을 **최우선(Primary)** 로직으로 삼습니다.
* **보조 추론 (queryKey 배열 휴리스틱)**: 콜백 내부 추적이 불가능할 정도로 복잡하거나 실패한 경우에만, Fallback 수단으로 `useQuery(['/users'])`의 첫 번째 인자(배열)를 URL로 유추합니다.

### 6.3. RTK Query Resolver (Redux Toolkit)

RTK Query의 공식 표준 사용법과 문법 규칙을 완벽하게 추적하여 엔터프라이즈 환경에서의 정확도를 보장합니다.
1. **`baseQuery`의 `baseUrl` 병합**: `fetchBaseQuery({ baseUrl: '/api' })`에 선언된 공통 URL을 하위 엔드포인트와 결합하여 완전한 경로 추출.
2. **`injectEndpoints` 분리 코드 대응**: 대규모 앱의 권장 패턴인 코드 스플리팅(`injectEndpoints`) 구조를 추적하여 여러 파일에 분산된 API 정의를 하나의 사전에 병합.
3. **훅(Hook) 이름 도출 규칙**: RTK Query가 내부적으로 자동 생성하는 네이밍 컨벤션(`use[Endpoint]Query`, `useLazy[Endpoint]Query` 등)을 정확히 역산하여 추론.
4. **Import Specifier Alias 대응 (식별자 치환)**: `import { useGetScenariosQuery as useScenarios } from './api'` 처럼 Import 시점에 식별자 이름이 변경(as)되는 경우를 감지합니다. AST의 `ImportSpecifier`에서 `local.name`과 `imported.name` 간의 역매핑 테이블을 생성하여, 함수 호출부의 `useScenarios()`가 원본 `useGetScenariosQuery`로 정상 매칭되도록 합니다.

### 6.4. SWR Resolver (Vercel)
* 전역 Fetcher를 사용하는 표준 패턴 대응. `useSWR('/api/users')` 같이 키(Key) 자체가 URL 역할을 수행하는 특성을 반영하여 첫 번째 인자를 엔드포인트로 추출 및 `GET`으로 취급.

---

## 7. 품질 고도화 및 안정성 보장 전략 (get-front-code-4 특화)

### 7.1. 리졸버 간 우선순위 및 배타 규칙 (중복 매칭 방지 및 부분 실패 Fallback)
고수준 라이브러리 내부에 기본 통신 코드가 섞여 있는 경우(예: React Query의 `queryFn` 내부에 `axios.get` 사용), 여러 플러그인이 하나의 API를 중복으로 추출하는 문제가 발생할 수 있습니다. 이를 해결하기 위해 **책임 연쇄 패턴(Chain of Responsibility) 내에 배타적 소유권(Exclusive Ownership) 규칙**을 도입합니다.
* **기본 배타 규칙**: 고수준 훅(React Query, RTK Query 등)이 먼저 특정 호출부의 매칭을 낚아채면, 내부의 저수준 호출(Axios, Fetch 등) 리졸버는 중복 처리를 차단(Ignore)합니다.
* **부분 실패 예외 (Fallback)**: 단, 고수준 훅이 매칭을 시도했으나 변수 조립 등의 이유로 최종 URL 추출에 실패한 경우, 즉시 배타적 차단을 해제하고 하위 리졸버(Axios 등)에게 위임(Fallback)하여 데이터 유실을 완벽히 방지합니다.

### 7.2. 단일 화면 내 중복 제거 (Deduplication)
* '하나의 동일한 화면' 안에서 같은 API가 반복 호출되는 경우 중복을 제거하여 1건으로 표기합니다. (단, 서로 다른 화면에서 같은 API를 호출하는 경우는 당연히 정상적으로 각각 표기)

### 7.3. URL 정규화 및 노이즈 필터링 상세
* **템플릿 리터럴 치환**: `axios.get(\`/users/\${userId}\`)` 코드를 `/users/{userId}` 형태의 정규화된 플레이스홀더로 치환.
* **BaseURL 병합**: `axios.create({ baseURL: '...' })` 로 생성된 인스턴스를 역추적하여 하위 호출 경로와 완전한 URL 병합.
* **노이즈 필터링**: `Sentry.init()`, `gtag()` 등 API 통신과 무관한 외부 도메인은 배제.

### 7.4. 크로스 파일(Cross-file) AST 추적 및 모듈 해석 한계 돌파
정적 분석(AST 파싱)의 핵심은 컴포넌트에 직접 작성되지 않고 외부 파일(커스텀 훅 등)로 분리된 API 로직을 쫓아가는 **'Import ↔ Export 연결 고리 추적'**입니다. 라이브러리의 구조적 특성에 따라 두 가지 뚜렷한 추적 전략을 병행합니다.

1. **명시적 선언 추적 (React Query, Axios)**
   * 개발자가 직접 작성한 커스텀 훅(`export const useFetchUsers = ...`)은 상단의 `Import` 문을 따라가 대상 파일의 `Export` 구현체를 직접 열어보고 내부 로직을 스캔합니다.
   * **재귀 깊이 제한 (Max Depth)**: 파일을 타고 넘어가며 추적할 때, 파일 간 순환 참조(`A -> B -> C -> A`)로 인한 무한 루프와 메모리 누수를 막기 위해 **최대 재귀 추적 깊이를 3단계로 강제 제한**합니다. 초과 시 경고 로그(`[WARN] Max depth exceeded`)와 함께 추적을 방어적으로 중단합니다.

2. **사전 학습(Init) 기반 추적 (RTK Query 등)**
   * RTK Query처럼 라이브러리 내부에서 훅 이름(`useGetUsersQuery`)을 자동 생성(마법)하는 경우, 실제 소스코드 상에 함수 구현체 덩어리가 존재하지 않아 위 1번의 Import 추적이 100% 실패합니다.
   * 이를 해결하기 위해 엔진은 UI 분석 전 플러그인 초기화(`init()`) 단계를 거칩니다. 이때 프로젝트 전역의 `*.api.ts` 설정 파일들을 미리 싹 스캔하여 **"자동 생성된 훅 이름 👉 실제 URL" 형태의 이름표 사전(Dictionary)**을 구축하는 강력한 우회 기법을 사용합니다.

### 7.5. 환경/빌드 레벨의 안정성 확보
* **TypeScript 패키지 버전 고정 (5.9.3)**: `get-front-code` 프로젝트 내에서 Next.js 구동 시, 존재하지 않거나 호환되지 않는 TS 버전(예: 7.0.x)을 명시할 경우 Next.js 자체가 빌드/실행 시 크래시되거나 재설치를 유발하는 인프라 문제가 발생했습니다. 파서 자체의 버그가 아니라 **분석기 환경(Next.js) 자체의 구동 안정성**을 확보하기 위해 검증된 TS 5.9.3 버전으로 고정합니다.
* **JSDoc 주석 구문 분석 충돌 방지**: JSDoc 블록 주석 `/* ... */` 내부에 라우팅 설명 목적으로 `api/**/route.*` 패턴을 삽입할 경우, 파서가 문구 내의 `*/`를 블록 주석의 강제 종료 마커로 오인하여 AST 트리가 붕괴(Unexpected Token 에러)되는 현상이 있었습니다. 이를 원천 차단하기 위해 단순 정규식 회피보다는 파서 호출 시 **에러 복구 모드(`errorRecovery: true`)**를 활성화하고, 파싱 전 안전한 전처리(Pre-processing)를 통해 치명적 오류를 방지하는 방식을 우선 적용합니다.

---

## 8. 파싱 실패 처리 전략 (Fail-safe)
특정 파일 내에 알 수 없는 문법 오류나 분석 불가능한 패턴이 있어 파싱이 실패하더라도 파이프라인이 크래시되지 않습니다. `try-catch`로 **Skip** 처리 후 에러 로그를 남기고 다음 파일 분석을 수행합니다.

---

## 9. 최종 산출물 포맷 및 모던 UI 리포트
가장 최신화된 v6 버전에서는 백엔드가 순수 JSON 데이터를 반환하며, 프론트엔드에서 이를 기반으로 가독성이 극대화된 **모던 아코디언 UI** 리포트를 출력합니다.

### 9.1. API JSON 응답 규격 (Backend)
```json
{
  "targetDir": "C:\\Users\\...\\davis-frontend\\apps\\agent-bt",
  "results": [
    {
      "viewName": "bt-my-task-view-modal",
      "file": "src/features/.../bt-my-task-view-modal.tsx",
      "callType": "Client Component",
      "api": {
        "method": "DELETE",
        "endpoint": "/tasks/{taskCode}/scenarios/{scenarioId}/cases"
      }
    }
  ]
}
```

### 9.2. 시각화 UI 렌더링 특성 (Frontend)
단순 마크다운 표 형태를 벗어나 사용자 경험(UX)을 극대화한 구조로 변경되었습니다.
* **아코디언 뷰 (`<details>`)**: 추출된 컴포넌트별로 그룹핑하여 접고 펼칠 수 있게 제공합니다.
* **항목 번호(Numbering) 부여**: 컴포넌트 목록과 그 내부의 각 API 리스트 좌측에 고정 너비의 순번(1, 2, 3...)을 부여하여 개수를 직관적으로 파악합니다.
* **HTTP Method 배지 (Badge) 시스템**: 메서드 타입에 따라 직관적인 시각적 컬러 피드백을 제공합니다.
  - `GET`: 파란색 (Blue)
  - `POST`: 초록색 (Emerald)
  - `PUT`: 노란색 (Amber)
  - `DELETE`: 빨간색 (Rose)
  - `PATCH`: 보라색 (Fuchsia)

---

## 10. 기대 효과
* **결점 없는 완전성**: 이전 버전들의 모든 에러와 불안정성을 해결하여 POC가 아닌 실무 투입 가능한 수준의 안정성 확보.
* **궁극의 확장성**: '플러그인' 아키텍처와 동적 로드 덕분에 어떠한 라이브러리가 등장해도 즉시 대응 및 최적화된 리소스 사용.
* **최상의 사용자 경험**: 백엔드와 프론트엔드의 관심사 분리를 통해 유연한 데이터 활용이 가능하며, 세련된 아코디언 UI 및 컬러 배지를 통해 실무 개발자의 코드 분석 효율성 극대화.
