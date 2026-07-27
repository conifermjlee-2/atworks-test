## 하네스: get-front-code-5 (프론트엔드 API 자동 분석기)

**목표:** plan-2.md 기획서 기반으로 Next.js + AST 파싱 엔진을 구현하여 화면별 호출 API 매핑 목록을 자동 추출하는 분석기를 구축한다.

**트리거:** get-front-code-5 프로젝트 구축, 분석기 구현, 파일 생성, 코드 작성 등 관련 작업 요청 시 `get-front-code-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**에이전트 팀:**
- `architect` — 뼈대, 어댑터, UI/API Route 담당
- `ast-engineer` — AST 파서/순회 코어 담당
- `plugin-engineer` — 4개 Resolver 플러그인 담당
- `qa-tester` — 빌드 및 동작 검증 담당

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-20 | 초기 하네스 구성 | 전체 | plan-2.md 기반 get-front-code-5 구축 시작 |
