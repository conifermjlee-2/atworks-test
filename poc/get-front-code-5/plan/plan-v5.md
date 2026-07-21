# 🚀 get-front-code-5: 프론트엔드 API 정적 분석기 (Technical Specification)

> 본 문서는 `get-front-code-5` 프로젝트의 요구사항, 시스템 아키텍처, 멀티 에이전트 하네스 구조 및 구현 명세를 정의하는 **통합 기술 기획서**입니다.

---

## 🎯 1. 개요 및 구축 목적

- **프로젝트 명**: `get-front-code-5` (프론트엔드 API 정적 분석기 v5)
- **목적**: 외부 인터넷 연결이 불가한 **폐쇄망 환경**에서 React 및 Next.js 프로젝트의 소스 코드를 정적 분석(Static Analysis)하여 화면(페이지/컴포넌트)별 호출 REST API를 역추적하고 매핑 보고서를 생성합니다.
- **핵심 기술 스택**: 
  - `Next.js` (App Router)
  - `TypeScript` (5.9.3 고정)
  - `Babel Core` (`@babel/parser`: 트리 생성, `@babel/traverse`: 트리 탐색 및 중복 추출 방지, `@babel/types`: 안전한 노드 타입 판별)
  - `enhanced-resolve`, `fast-glob`

---

## 🏗️ 2. 핵심 아키텍처 파이프라인

분석기는 코드를 4단계 레이어(Layer)로 통과시키며 API 매핑 정보를 역추적합니다.

```text
[ 📁 분석 대상 프론트엔드 프로젝트 소스 코드 ]
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ 프레임워크 어댑터 레이어 [src/adapters/*]                   │
│    - 소스 파일 스캔 및 필터링 (Route Handler 백엔드 라우트 무시)  │
│    - 컴포넌트 지시어 탐지 ('use client', 'use server')         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ AST 파서 & 순회 레이어 [src/core/parser/*]                 │
│    - @babel/parser (소스 코드를 AST 구조로 번역/생성)           │
│    - @babel/traverse (트리 순회 및 중복 추출 방지용 skip)       │
│    - @babel/types (안전한 노드 타입 판별 및 검증)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ 플러그인 리졸버 레이어 [src/resolvers/*]                    │
│    - ReactQueryResolver, RTKQueryResolver, SWRResolver 등    │
│    - 파일 간 심볼 역추적 및 경로 해석 (최대 깊이: 3단계 무한루프 방지) │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ 프리젠테이션 & API 레이어                                  │
│    - POST /api/analyze (순수 JSON 데이터 반환 API)            │
│    - 모던 아코디언 대시보드 UI (src/app/page.tsx)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📌 3. 6대 불변 구현 원칙

시스템의 견고함을 유지하기 위해 다음의 6가지 원칙을 반드시 준수합니다.

1. **백엔드/프론트엔드 관심사 완전 분리 (SoC)**
   - API 분석 엔진(`src/app/api/analyze/route.ts`)은 순수 JSON 데이터만을 반환합니다.
   - UI 대시보드(`src/app/page.tsx`)는 전달받은 결과를 시각화하는 역할만 전담합니다.
2. **중복 카운트 방지 메커니즘**
   - 고수준 훅 리졸버(ex. React Query)가 탐색에 성공하면 `path.skip()`을 실행하여 하위 구문(`axios`, `fetch`)의 중복 수집을 원천 차단합니다.
3. **순환 참조 방어 (Circular Reference Tracker)**
   - 타 파일의 유틸리티 함수/훅을 역추적할 때 찾을 때까지 끝까지 깊이 탐색하되, `visited` Set을 통해 이미 방문한 노드나 파일은 스킵하여 순환 참조로 인한 무한 루프를 방지합니다.
4. **컴포넌트 지시어 판별**
   - `'use client'`, `'use server'` 지시어를 탐색하여 컴포넌트 유형을 자동 식별합니다.
5. **모노레포 및 경로 별칭(Alias) 동적 해석**
   - `tsconfig.json`의 `paths` 구문을 동적으로 수집하여 `@/api/...` 형태의 심볼 경로를 실제 물리적 경로로 해석합니다.
6. **TypeScript 5.9.3 고정**
   - Next.js 및 Babel 파서의 정적 타이핑 호환성 유지를 위해 TS 버전을 `5.9.3`으로 강제합니다.



## 🧩 4. 데이터 페칭 지원 리졸버 (Resolvers)

- 📡 **`AxiosFetchResolver`**: `axios.get/post...`, `axios()`, Native `fetch()` 파싱
- ⚛️ **`ReactQueryResolver`**: `useQuery`, `useMutation` 훅의 `queryFn` 파싱 및 `queryKey` 기반 Fallback
- 📦 **`RTKQueryResolver`**: `createApi` 엔드포인트 사전 수집(`init()`) 후 `useGet...Query` 매핑
- 💧 **`SWRResolver`**: `useSWR`, `useSWRMutation` 훅의 key 문자열 및 fetcher 파싱

---

## 📊 5. 백엔드 API 및 프론트엔드 UI 명세

- **분석 API 엔드포인트**: `POST /api/analyze` 
  - **요청 Body**: `{ "targetPath": "분석_대상_경로" }`
  - **결과 구조**: `MappingResult` (총 페이지 수, API 호출 수, 화면별 매핑 목록 등)
- **프론트엔드 대시보드 UI**:
  - 다크 모드(Dark Mode) 및 글래스모피즘(Glassmorphism) 기반 아코디언 디자인
  - HTTP 메소드별 색상 배지 시각화 (GET: Blue, POST: Green, PUT: Amber, DELETE: Red, PATCH: Purple)

---

## 🚧 6. 분석의 기술적 한계 및 엣지 케이스 대응 전략

본 분석기는 런타임이 아닌 **정적 코드(AST)** 분석을 수행하므로 다음과 같은 방어 로직을 가집니다.

> [!WARNING]
> **동적 URL 파싱의 한계 (Dynamic Template Literals)** (👉 `src/resolvers/*`)
> - `fetch(BASE_URL + "/api/" + id)`와 같이 런타임에 결정되는 템플릿 리터럴은 변수 값을 완벽히 치환하기 어렵습니다.
> - **대응 전략**: AST 분석 시 식별자(Identifier) 이름을 최대한 유지하여 `"${BASE_URL}/api/${id}"` 형태의 원형 문자열 패턴으로 안전하게 추출합니다.

> [!WARNING]
> **복잡한 재귀 참조 및 고차 함수 (Higher-Order Functions)**
> - 여러 파일을 걸쳐 복잡하게 매핑되거나 반환되는 커스텀 훅의 경우 파싱 흐름이 끊길 수 있습니다.
> - **대응 전략**: 추적 깊이에 인위적인 제한(Max Depth)을 두지 않고 원본을 찾을 때까지 끝까지 탐색합니다. 단, 탐색 과정에서 `visitedFiles` Set을 활용해 순환 참조(A->B->A) 루프가 감지될 때만 탐색을 안전하게 차단합니다.

---

## 🛡️ 7. 예외 및 보안 처리 (Security & Error Handling)

> [!CAUTION]
> **로컬 파일 시스템 접근 격리 (Path Traversal 방어)**
> - API 요청 시 전달받는 `targetPath` 파라미터는 분석 대상 워크스페이스(Workspace) 내부에만 존재해야 합니다.
> - 상위 디렉터리 이동(`../`) 구문을 필터링하여 OS 시스템의 민감한 파일에 접근하지 못하도록 경로 유효성 검증(Validation)을 반드시 수행합니다.

> [!IMPORTANT]
> **오류 복구 및 파싱 실패 격리 (Fault Isolation)**
> - 문법 오류(Syntax Error)가 존재하는 프론트엔드 코드를 만나더라도 전체 시스템이 멈추지 않도록 `@babel/parser`의 `errorRecovery: true` 모드를 활성화합니다.
> - 특정 파일 스캔 중 에러가 발생하면, 해당 파일만 `Error Log`에 격리하여 기록하고 다음 파일 분석을 정상적으로 재개합니다.

---
