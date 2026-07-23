# 🚀 프론트엔드 프로젝트 자동 분석기 구축 기획서 (v6 - get-front-code-4 통합 및 안정화 버전)

## 1. 개요
본 시스템은 **폐쇄망 환경(인터넷 미연결)**에서 동작하며, 프론트엔드 프로젝트 코드를 정적 분석(Static Analysis)하여 **"화면별 호출 API 매핑 목록"**을 자동으로 역추적하고 추출하는 최적화된 도구입니다.

기존 버전(v2, v3, v4)의 강점들과 합의된 핵심 설계 사상(정확도, 커버리지 등)을 하나로 통합한 **가장 안정적이고 완성된 버전(get-front-code-4)**에 대한 설계 문서입니다.

---

## 2. 분석 대상 및 목표 스펙
시장의 프론트엔드 생태계 점유율과 개발 리소스의 '선택과 집중'을 고려하여, **React 및 Next.js 생태계를 1차 타겟(Phase 1)**으로 확정하였습니다.

### 2.1. 프레임워크 지원 범위
| 프레임워크 | 시장 점유율 | 지원 여부 | 비고 및 대응 계획 |
| :--- | :--- | :--- | :--- |
| **React** (Next.js 포함) | 약 80% | ✅ **Phase 1** | 우선 개발 대상 |
| **Vue 3** | 약 14% | ⏳ Phase 2 | Phase 1에서는 Vue 프로젝트 감지 시, 명확한 안내 메시지와 함께 프로세스 종료(`exit code`) 처리 및 모노레포 워크스페이스 내 예외 분기 처리 |
| Svelte / Angular 등 | 약 6% | 향후 확장 | |

### 2.2. 스코프 아웃 (기술적으로 명시 제외되는 항목)
| 통신 방식 / 항목 | 사유 | 대응 계획 |
| :--- | :--- | :--- |
| **GraphQL** (Apollo 등) | REST와 AST 패턴이 근본적으로 달라 별도 파서 로직 필요 | Phase 2 이후 재검토. Phase 1은 "REST API만 대상" |

### 2.3. Phase 1 완료 정량 지표 (목표치)
본 분석기의 성능 평가는 타겟 프로젝트(`davis-frontend` 등)를 막론하고 다음의 보편적 정량 지표를 기준으로 삼습니다.
* **커버리지 (Coverage)**: 95% 이상 (대상 소스 코드 중 누락 없이 스캔한 비율)
* **재현율 (Recall)**: 90% 이상 (실제 호출되는 API 중 분석기가 정확하게 찾아낸 비율)
* **오탐률 (False Positive)**: 10% 미만 (API가 아닌데 API로 잘못 추출한 비율)

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

## 4. 핵심 아키텍처: 플러그인 기반 다중 레이어 구조
본 분석기의 핵심은 프레임워크 의존성을 제거하는 **Adapter 레이어**와, 데이터 페칭 라이브러리 의존성을 제거하는 **Plugin(Resolver) 레이어**를 완벽하게 분리한 확장성 높은 아키텍처입니다.

### 아키텍처 구조도 (v6 기준)
```text
[1. 프레임워크 판별 및 Adapter 로드] ── package.json 분석
      │  ├─ Next Adapter (app/**/page.tsx 등)
      │  └─ React Adapter (src/pages/** 등)
      ▼
[2. 오케스트레이터 (Analyzer)] 
      │  package.json의 의존성(dependencies)을 분석하여 최적화된 Resolver 플러그인만 동적 로드
      │  (예: @reduxjs/toolkit이 있으면 RTK Query 로드, 없으면 스킵 + Axios는 기본 로드)
      │  이후 로드된 플러그인들의 초기화(init) 수행 
      │  (※ RTK Query처럼 화면 밖 중앙 파일에 URL이 은닉된 경우, 본 분석 시작 전에 
      │      'api.ts' 등을 스캔하여 '훅 이름 ↔ 진짜 URL' 단어장을 굽는 사전 필수 작업)
      ▼
[3. AST 파싱 및 순회 (Traverser)] 
      │  Adapter가 찾은 UI 컴포넌트들을 하나씩 AST로 변환 후 순회
      ▼
[4. 플러그인 기반 데이터 페칭 추출 (Hook Resolvers)] ── 플러그인 체인 ──┐
      │  Traverser는 함수 호출을 발견하면 '현재 로드된' 플러그인에 매핑을 위임 │
      │  ├─ RTK Query Resolver (해당 라이브러리 사용 시에만 활성화)      │
      │  ├─ React Query Resolver (해당 라이브러리 사용 시에만 활성화)    │
      │  ├─ SWR Resolver (해당 라이브러리 사용 시에만 활성화)            │
      │  └─ Axios/Fetch Resolver (기본 활성화 - 순수 HTTP 클라이언트)    │
      ▼                                                                 ▼
[최종 산출물] 화면 ↔ API 매핑 마크다운 리포트 및 통합 UI 생성
```

---

## 5. 프레임워크 분석 어댑터 (Framework Adapters)
프레임워크별 라우팅과 렌더링 방식의 차이를 추상화하여 파서 엔진이 동일한 인터페이스로 분석할 수 있도록 합니다.

### 5.1. Next.js App Router 서버/클라이언트 구분
Next.js App Router 구조는 코드가 실행되는 위치가 철저히 분리되므로, 아키텍처 상 이를 명확히 분리하여 표기해야 실제 분석 결과의 정확도가 보장됩니다.
* **Server Component**: 화면 렌더링 시 서버에서 발생하는 API 호출 추적.
* **Client Component (`'use client'`):** 브라우저단에서 발생하는 동적 데이터 페칭 추적.
* **Route Handler (`api/**/route.ts`) / Server Action:** 프론트 화면이 아닌 중간(BFF) 백엔드 역할이므로 분석 타겟에서 분리 또는 명시적 표기.

---

## 6. 데이터 페칭 라이브러리 지원 (Plugin Resolvers)
엔진(Traverser)은 특정 라이브러리의 문법을 직접 알지 못하며, 4개의 핵심 플러그인이 각각의 사양(Specification)에 맞춰 패턴을 전담 추적합니다.

### 6.1. RTK Query Resolver (Redux Toolkit)
RTK Query의 공식 표준 사용법과 문법 규칙을 완벽하게 추적하여 엔터프라이즈 환경에서의 정확도를 보장합니다.
1. **`baseQuery`의 `baseUrl` 병합**: `fetchBaseQuery({ baseUrl: '/api' })`에 선언된 공통 URL을 하위 엔드포인트와 결합하여 완전한 경로 추출.
2. **`injectEndpoints` 분리 코드 대응**: 대규모 앱의 권장 패턴인 코드 스플리팅(`injectEndpoints`) 구조를 추적하여 여러 파일에 분산된 API 정의를 하나의 사전에 병합.
3. **훅(Hook) 이름 도출 규칙**: RTK Query가 내부적으로 자동 생성하는 네이밍 컨벤션(`use[Endpoint]Query`, `useLazy[Endpoint]Query` 등)을 정확히 역산하여 추론.
4. **Import Specifier Alias 대응 (식별자 치환)**: `import { useGetScenariosQuery as useScenarios } from './api'` 처럼 Import 시점에 식별자 이름이 변경(as)되는 경우를 감지합니다. AST의 `ImportSpecifier`에서 `local.name`과 `imported.name` 간의 역매핑 테이블을 생성하여, 함수 호출부의 `useScenarios()`가 원본 `useGetScenariosQuery`로 정상 매칭되도록 합니다.

### 6.2. React Query Resolver (TanStack Query)
* **최우선 추적 (queryFn 콜백)**: `queryKey`는 캐시 키일 뿐, 실제 URL이 아닌 경우가 실무에서 훨씬 많습니다. 따라서 `queryFn: () => axios.get('/users')` 내부에 존재하는 실제 HTTP 통신(Axios/Fetch)의 인자를 파싱하는 것을 **최우선(Primary)** 로직으로 삼습니다.
* **보조 추론 (queryKey 배열 휴리스틱)**: 콜백 내부 추적이 불가능할 정도로 복잡하거나 실패한 경우에만, Fallback 수단으로 `useQuery(['/users'])`의 첫 번째 인자(배열)를 URL로 유추합니다.

### 6.3. SWR Resolver (Vercel)
* 전역 Fetcher를 사용하는 표준 패턴 대응. `useSWR('/api/users')` 같이 키(Key) 자체가 URL 역할을 수행하는 특성을 반영하여 첫 번째 인자를 엔드포인트로 추출 및 `GET`으로 취급.

### 6.4. Axios & Fetch Resolver
* `axios.get()`, `fetch(url, { method: 'POST' })` 등 기본 HTTP 클라이언트의 메서드와 URL 추출.

---

## 7. 품질 고도화 및 안정성 보장 전략 (get-front-code-4 특화)

### 7.1. 리졸버 간 우선순위 및 배타 규칙 (중복 매칭 방지 및 부분 실패 Fallback)
RTK Query 내부에 Axios 코드가 존재하는 경우(예: `queryFn` 내 `axios.get`), 여러 플러그인이 동시에 같은 코드를 분석하려 할 수 있습니다. 이를 해결하기 위해 **책임 연쇄 패턴(Chain of Responsibility) 내에 배타적 소유권(Exclusive Ownership) 규칙**을 도입합니다.
* **기본 배타 규칙**: 고수준 훅(RTK Query 등)이 특정 AST 노드의 매칭을 낚아채면, 내부의 저수준 호출(Axios 등)은 중복 처리를 차단(Ignore)합니다.
* **부분 실패 예외 (Fallback)**: 단, 고수준 훅이 노드를 낚아챘으나 동적 조립 등의 이유로 최종 URL 추출에 실패한 경우, 즉시 배타적 차단을 해제하고 하위 리졸버(Axios 등)에게 위임(Fallback)하여 데이터 유실을 완벽히 방지합니다.

### 7.2. 단일 화면 내 중복 제거 (Deduplication)
* '하나의 동일한 화면' 안에서 같은 API가 반복 호출되는 경우 중복을 제거하여 1건으로 표기합니다. (단, 서로 다른 화면에서 같은 API를 호출하는 경우는 당연히 정상적으로 각각 표기)

### 7.3. URL 정규화 및 노이즈 필터링 상세
* **템플릿 리터럴 치환**: `axios.get(\`/users/\${userId}\`)` 코드를 `/users/{userId}` 형태의 정규화된 플레이스홀더로 치환.
* **BaseURL 병합**: `axios.create({ baseURL: '...' })` 로 생성된 인스턴스를 역추적하여 하위 호출 경로와 완전한 URL 병합.
* **노이즈 필터링**: `Sentry.init()`, `gtag()` 등 API 통신과 무관한 외부 도메인은 배제.

### 7.4. 환경/빌드 레벨의 안정성 확보
* **TypeScript 패키지 버전 고정 (5.9.3)**: `get-front-code` 프로젝트 내에서 Next.js 구동 시, 존재하지 않거나 호환되지 않는 TS 버전(예: 7.0.x)을 명시할 경우 Next.js 자체가 빌드/실행 시 크래시되거나 재설치를 유발하는 인프라 문제가 발생했습니다. 파서 자체의 버그가 아니라 **분석기 환경(Next.js) 자체의 구동 안정성**을 확보하기 위해 검증된 TS 5.9.3 버전으로 고정합니다.
* **JSDoc 주석 구문 분석 충돌 방지**: JSDoc 블록 주석 `/* ... */` 내부에 라우팅 설명 목적으로 `api/**/route.*` 패턴을 삽입할 경우, 파서가 문구 내의 `*/`를 블록 주석의 강제 종료 마커로 오인하여 AST 트리가 붕괴(Unexpected Token 에러)되는 현상이 있었습니다. 이를 원천 차단하기 위해 코드 컨벤션 제어 및 안전한 주석 우회 정규식을 사용합니다.

---

## 8. 파싱 실패 처리 전략 (Fail-safe)
특정 파일 내에 알 수 없는 문법 오류나 분석 불가능한 패턴이 있어 파싱이 실패하더라도 파이프라인이 크래시되지 않습니다. `try-catch`로 **Skip** 처리 후 에러 로그를 남기고 다음 파일 분석을 수행합니다.

---

## 9. 최종 산출물 포맷 예시 (Markdown + UI 리포트)
분석 완료 시 아래와 같이 컴포넌트 단위로 시각화된 매핑 리포트를 출력하며, UI 상에서는 **[모두 펼치기/접기]** 기능을 제공하여 사용자 경험을 극대화합니다.

| 화면 (View) | 컴포넌트 유형 | API Method | API Endpoint |
| :--- | :--- | :--- | :--- |
| **`Dashboard`** | Server Component | [GET] | `/api/notices` |
| 〃 | Client Component | [POST] | `/api/users/{userId}` |
| **`api/users/route.ts`** | Route Handler (자체 엔드포인트) | [GET/POST] | `/api/users` |
| **`actions/userAction`** | Server Action | [POST] | `UserMutation` |

---

## 10. 기대 효과
* **결점 없는 완전성**: 이전 버전들의 모든 에러와 불안정성을 해결하여 POC가 아닌 실무 투입 가능한 수준의 안정성 확보.
* **궁극의 확장성**: '플러그인' 아키텍처와 동적 로드 덕분에 어떠한 라이브러리가 등장해도 즉시 대응 및 최적화된 리소스 사용.
* **높은 품질의 정량적 달성**: 커버리지 95%, 재현율 90% 이상의 고성능 분석기 완성을 통해 기업 내 레거시 분석 비용을 획기적으로 감축.
