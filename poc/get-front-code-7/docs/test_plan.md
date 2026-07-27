# 🧪 다양한 템플릿 검증 테스트 계획 (Test Plan)

## 🎯 과제 목적
현재 개발된 **Frontend Code Analyzer (정적 분석기)** 가 특정 프로젝트(예: 쇼핑몰 템플릿)에만 종속되지 않고, 다양한 형태의 React/Next.js 템플릿과 보일러플레이트에서도 범용적으로 동작하는지 검증하고 문서화합니다.

---

## 🏗️ 테스트 대상 템플릿 (Test Targets)

테스트의 실효성을 높이기 위해, 프론트엔드 생태계에서 가장 널리 쓰이는 4가지 아키텍처를 기준으로 테스트를 진행합니다.

1. **Next.js 13+ App Router 템플릿**
   - **특징:** 서버 컴포넌트(RSC)와 클라이언트 컴포넌트(`"use client"`) 혼재, App 폴더 라우팅.
   - **중점 확인:** Server Action 처리, `fetch` 캐싱 로직 파싱, 중첩 레이아웃(Layout.tsx) 연계.

2. **Next.js 12 이하 Pages Router 템플릿**
   - **특징:** `pages/` 폴더 기반 라우팅, `getServerSideProps` / `getStaticProps` 데이터 패칭.
   - **중점 확인:** 이전 버전의 데이터 패칭 방식 인식 여부 및 라우트 맵핑.

3. **React + Vite / CRA (Single Page Application)**
   - **특징:** 클라이언트 사이드 렌더링(CSR), `react-router-dom` 사용.
   - **중점 확인:** `BrowserRouter`, `Routes`, `Route` 컴포넌트 기반의 라우팅 구조 파싱 가능 여부.

4. **다양한 API 상태 관리 라이브러리 조합 템플릿**
   - **특징:** React Query, SWR, Redux Toolkit Query(RTK Query) 등을 활용.
   - **중점 확인:** `invalidateQueries` 나 훅 기반의 꼬리물기(Refetch) 흐름 추적 및 EVENT/MOUNT 트리거 정확성.

---

## 🔍 핵심 검증 포인트 (Checklists)

- [ ] **라우팅 인식률:** 해당 템플릿의 라우팅 시스템(App, Pages, React Router)을 정확히 인식하여 트리를 구성하는가?
- [ ] **API 파싱:** 구조화되지 않은 복잡한 폴더 구조나 절대 경로(Alias: `@/api/..`)를 사용할 때도 API 호출을 놓치지 않는가?
- [ ] **무한 루프 방지:** 라우팅이나 컴포넌트 간 순환 참조(Circular Dependency)가 발생할 때 프로그램이 멈추지 않는가?
- [ ] **AI 번역 품질:** 템플릿별로 추출된 JSON 형태가 달라도, Gemini AI가 비즈니스 시나리오를 일관되게 잘 뽑아내는가?

---

## 📊 결과 문서화 양식 (Report Format)

각 템플릿별로 테스트를 수행한 후, 아래 양식에 맞추어 결과를 기록합니다.

| 테스트 템플릿 명 | 라우팅 인식 여부 | API 추출 성공률 | 발생한 문제점 (이슈) | 해결 방안 및 반영 사항 |
| :--- | :--- | :--- | :--- | :--- |
| Next.js App Router | ✅ 성공 | 100% | - | - |
| React + Vite (React Router) | ⚠️ 부분 성공 | 80% | `react-router-dom` 파싱 누락 | AST 파서에 `Route` 태그 탐색 로직 추가 필요 |
| ... | ... | ... | ... | ... |

---

### 🚀 향후 Action Item
1. 오픈소스 템플릿 다운로드 및 로컬 환경 준비
2. 분석기 툴을 각 템플릿 경로에 연결하여 실행 (`npm run dev`)
3. 분석 결과를 본 문서의 결과 표에 지속적으로 업데이트
