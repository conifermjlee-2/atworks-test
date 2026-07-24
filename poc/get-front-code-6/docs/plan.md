# 🚀 Frontend Code Analyzer & AI 시나리오 제너레이터 기획서

## 1. 프로젝트 개요 (Project Overview)
**프로젝트 명:** Frontend E2E Code Analyzer (코드명: `get-front-code-6`)
**목적:** 특정 React/Next.js 프로젝트의 소스 코드(AST)를 정적 분석하여 라우팅 및 API 호출 트래픽을 추출하고, 이를 LLM(Gemini)과 결합하여 기획자와 개발자 모두가 직관적으로 이해할 수 있는 자연어 비즈니스 시나리오 명세서로 자동 변환하는 시스템을 구축합니다.

---

## 2. 핵심 목표 (Core Objectives)
1. **코드 종속성 탈피:** 실행 중인 서버나 브라우저 런타임 없이, 소스 코드 폴더 자체만으로 로직을 추적하는 정적 분석(Static Analysis) 환경 구축.
2. **다형성 정규화:** Fetch, Axios, React Query, SWR 등 파편화된 프론트엔드 통신 라이브러리를 단일 규격으로 추출 및 정규화.
3. **사용자 시나리오 시각화:** 단일 화면 분석을 넘어, `화면 A ➞ 화면 B ➞ 화면 C`로 이어지는 E2E 경로 상의 API 흐름을 DFS 탐색으로 도출.
4. **AI 기반 비즈니스 언어 번역:** 기계적인 API 흐름(JSON)을 LLM(Gemini 2.5 Flash)을 통해 "상품 조회 후 장바구니에 담습니다" 형태의 기획 친화적 언어로 자동 번역.

---

## 3. 시스템 아키텍처 (Architecture)

### 3-1. Frontend (Next.js App Router)
- **대시보드 UI (`src/app/page.tsx`):** 분석 결과를 4개의 직관적인 탭으로 분리하여 렌더링.
- **주요 기능:** 분석 대상 폴더 경로 입력, 로딩 스피너, 에러 핸들링, AI 요청 15초 무제한 대기(Timeout 해제), Markdown 복사 및 UI 접기/펼치기 아코디언 컴포넌트.

### 3-2. Backend API Layer
- **Core Analyzer (`/api/analyze`):**
  - `Babel` 및 `TypeScript AST` 파서를 통해 파일별 종속성(Dependency Tree) 및 훅(Hook) 추출.
  - `DFS(깊이 우선 탐색)` 알고리즘을 사용해 최대 3단계 깊이의 라우트 간 방향성 그래프(Directed Graph) 생성.
- **AI Integration (`/api/analyze-ai`):**
  - `@google/genai` 최신 SDK 적용.
  - `promptData`를 압축하여 토큰을 절약하고, `apiFlow`(흐름)와 `description`(1줄 요약)을 추출하도록 강제하는 구조화된 프롬프팅 적용.

---

## 4. 주요 기능 명세 (Feature Specifications)

### 탭 1: 📋 컴포넌트 API 리스트
- 프로젝트 전체에서 호출되는 모든 API Endpoint를 Method(GET, POST 등) 색상 뱃지와 함께 리스트업.
- 트리거 타입(Client, ServerComponent, ServerAction) 시각화.

### 탭 2: ⚡ 컴포넌트 API 시나리오 흐름
- 단일 화면(컴포넌트) 내에서 발생하는 API 호출을 `MOUNT`(화면 진입 시)와 `EVENT`(사용자 클릭 등)로 분류하여 인과관계 맵핑.
- `invalidateQueries` 와 같은 꼬리물기(Refetch) 로직 추적.

### 탭 3: 🖥️ 화면별 시나리오 (E2E Scenario)
- 사용자가 페이지를 이동할 때의 연속적인 시나리오.
- 예: `[ / ] ➞ [ /order ]` 경로 이동 시 각각의 화면에서 발생하는 API 호출을 시간순으로 결합하여 렌더링.

### 탭 4: 🤖 AI 추천 비즈니스 시나리오 (핵심 기능)
- **프롬프트 로직:** Tab 3의 E2E JSON 데이터를 Gemini 모델로 전송하여 "화면별 API 흐름"과 "1줄 비즈니스 해설" 추출.
- **UI/UX:** 
  - `[ ✨ AI 번역 생성하기 ]` 수동 트리거 버튼 (불필요한 과금 방지).
  - 로딩 중 실시간 경과 시간(타이머) 및 중지(Cancel) 버튼 제공.
  - `#태그` 우측 정렬(space-between), 뱃지형 API 흐름도(`GET /api/cart ➞ POST /api/orders`) 제공.
  - `[ Markdown 복사 ]` 버튼을 통한 손쉬운 외부 문서화 지원.

---

## 5. 향후 확장 및 과제 (Next Steps)
- `docs/test_plan.md`에 명시된 바와 같이, Next.js Pages Router, 순수 React(Vite/CRA), Monorepo 등 다양한 폴더 구조에서도 100% 동작하도록 AST 탐색 로직(예: `react-router-dom`의 `<Route>` 탐색) 고도화.
- 분석 결과를 로컬 DB나 파일로 캐싱하여 재분석 속도 향상.
