# 🚀 get-front-code-5: 프론트엔드 API 정적 분석기 (Technical Specification)

> 본 문서는 `get-front-code-5` 프로젝트의 요구사항, 시스템 아키텍처, 그리고 구현 명세를 정의하는 **통합 기술 기획서**입니다.

---

## 🎯 1. 개요 및 구축 목적

- **프로젝트 명**: `get-front-code-5` (프론트엔드 API 정적 분석기 v5)
- **목적**: 외부 인터넷 연결이 불가한 **폐쇄망 환경**에서 React 및 Next.js 프로젝트의 소스 코드를 정적 분석(Static Analysis)하여 화면(페이지/컴포넌트)별 호출 REST API를 역추적하고 매핑 보고서를 생성합니다.

### 🛠️ 핵심 기술 스택
| 스택 | 용도 및 설명 |
|:---|:---|
| **`Next.js`** | App Router 기반의 서버 및 UI 프레임워크 |
| **`TypeScript`** | 안정성을 위해 `5.9.3` 버전으로 고정하여 사용 |
| **`Babel Core`** | `@babel/parser` (트리 생성), `@babel/traverse` (순회), `@babel/types` (노드 검증) |
| **`기타 도구`** | `enhanced-resolve`, `fast-glob` |
| **`지원 대상`** | `Fetch`, `Axios`, `React Query`, `SWR`, `RTK Query` 라이브러리 완벽 파악 |

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
│    - 범용 동적 import 심볼 역추적 (상대경로/별칭 추적, 로컬 서비스 파일 파싱) │
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
   - 고수준 훅 리졸버가 탐색에 성공하면 `path.skip()`을 실행하여 하위 구문의 중복 수집을 원천 차단합니다.
3. **순환 참조 방어 (Circular Reference Tracker)**
   - `visited` Set을 통해 이미 방문한 노드나 파일은 스킵하여 순환 참조로 인한 무한 루프를 방지합니다.
4. **컴포넌트 지시어 판별**
   - `'use client'`, `'use server'` 지시어를 탐색하여 컴포넌트 유형을 자동 식별합니다.
5. **모노레포 및 동적 Import 심볼 역추적 (Symbol Tracing)**
   - `tsconfig.json` 별칭(`@/`) 및 상대 경로(`../../`) import를 동적으로 추적하여, 컴포넌트가 사용하는 로컬 서비스 파일(`*.service.ts` 등) 내부의 API 통신까지 연쇄 해석합니다.
6. **TypeScript 5.9.3 고정**
   - Next.js 및 Babel 파서의 정적 타이핑 호환성 유지를 위해 TS 버전을 강제합니다.

---

## 🧩 4. 데이터 페칭 지원 리졸버 (Resolvers)

각 라이브러리의 특성에 맞춘 전용 리졸버 플러그인을 통해 데이터를 안전하게 추출합니다.

| 리졸버 모듈 | 타겟 라이브러리 | 분석 로직 특징 |
|:---|:---|:---|
| 📡 **`AxiosFetchResolver`** | `Axios`, `Fetch` | 기본 활성화. `axios.get()`, `fetch()`, `*HttpClient`, `*Client` 등 커스텀 인스턴스 및 `.download()` 지원 |
| ⚛️ **`ReactQueryResolver`** | `React Query` | `useQuery` 내부의 `queryFn` 파싱 및 `queryKey` 기반 Fallback |
| 📦 **`RTKQueryResolver`** | `RTK Query` | 특정 파일명 규칙 없이 `src/` 전체 소스 범용 스캔(`init()`) 후 표준/Lazy 훅 매핑 |
| 💧 **`SWRResolver`** | `SWR` | `useSWR` 훅의 key 문자열 및 fetcher 기반 파싱 |

---

## 📊 5. 백엔드 API 및 프론트엔드 UI 명세

### 백엔드 API (`POST /api/analyze`)
- **요청 Body**: `{ "targetPath": "분석_대상_경로" }`
- **응답 구조**: `MappingResult` 배열 (총 페이지 수, API 호출 수, 화면별 매핑 목록 등)

### 프론트엔드 대시보드 (`src/app/page.tsx`)
- **디자인 컨셉**: 다크 모드(Dark Mode) 및 글래스모피즘(Glassmorphism) 기반 아코디언 디자인
- **시각화 규칙**: HTTP 메소드별 색상 배지 (GET: 🔵, POST: 🟢, PUT: 🟠, DELETE: 🔴, PATCH: 🟣)

---

## 🚧 6. 엣지 케이스 및 한계 대응 전략

> [!WARNING]
> **동적 URL 파싱의 한계 (Dynamic Template Literals)**
> - `fetch(BASE_URL + "/api/" + id)`와 같이 런타임에 결정되는 URL은 정적 분석의 한계가 존재합니다.
> - **대응 전략**: 식별자(Identifier) 이름을 최대한 유지하여 `"${BASE_URL}/api/${id}"` 형태의 원형 문자열 패턴으로 안전하게 추출합니다.

> [!WARNING]
> **복잡한 재귀 참조 및 고차 함수**
> - 여러 파일을 걸쳐 반환되는 커스텀 훅의 경우 파싱 흐름 추적이 어렵습니다.
> - **대응 전략**: 원본을 찾을 때까지 끝까지 탐색하되, `visitedFiles` Set을 활용해 순환 참조 루프가 감지될 때만 탐색을 안전하게 차단합니다.

---

## 🛡️ 7. 예외 및 보안 처리

> [!CAUTION]
> **로컬 파일 시스템 접근 격리 (Path Traversal 방어)**
> - 전달받는 `targetPath` 파라미터는 대상 워크스페이스 내부에만 존재해야 합니다. 상위 디렉터리 이동(`../`) 구문을 필터링하여 OS 시스템의 민감한 파일 접근을 차단합니다.

> [!IMPORTANT]
> **오류 복구 및 파싱 실패 격리 (Fault Isolation)**
> - 문법 오류(Syntax Error)가 있는 코드를 만나도 전체 시스템이 멈추지 않도록 `@babel/parser`의 `errorRecovery: true` 모드를 활성화합니다.
> - 특정 파일 스캔 중 에러가 발생하면, 해당 파일만 `Error Log`에 격리하고 다음 분석을 재개합니다.
