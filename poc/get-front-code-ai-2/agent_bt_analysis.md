# Agent-BT 프론트엔드 프로젝트 분석 리포트

요청하신 `apps/agent-bt` 프로젝트 소스 코드를 바탕으로 **1) 화면별 API 매핑**, **2) API 연계 흐름**, **3) 전역 상태 갱신 흐름**을 분석했습니다. 본 프로젝트는 전역 상태 및 API 통신 관리에 **Redux Toolkit Query (RTK Query)**를 적극적으로 활용하여 캐시(Cache) 기반의 실시간 UI 업데이트 패턴을 채택하고 있습니다.

---

## 1. 🔌 화면별 API 매핑 (View-API Mapping)

| 화면 (경로 또는 UI 컴포넌트) | 호출 API (Swagger 형식) | 목적/설명 |
|---|---|---|
| \`main.page.tsx\` (\`/agents/bt\`) | \`[GET] /tasks?agentCode=BACKEND_TEST\` | BT 태스크 목록 전체 조회 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[GET] /tasks/{taskCode}\` | 단일 태스크 상세 정보 조회 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[GET] /batches/{taskCode}/status\` | 시나리오 배치 실행 상태 실시간 폴링 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[GET] /tasks/{taskCode}/scenario-overviews\`| 시나리오 개요 목록 조회 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[GET] /test-scenarios/preset-info/{taskCode}\` | 태스크 테스트 시나리오 프리셋 정보 조회 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[POST] /batches/{taskCode}\` | 배치 작업 실행 (Retry 등) |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[PATCH] /batches/{taskCode}/ignore-failures\` | 실패 건 무시 처리 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[POST] /tasks/{taskCode}/complete\` | 태스크 배포/완료 처리 |
| \`main.page.tsx\` (\`/agents/bt\`) | \`[DELETE] /tasks/{taskCode}\` | 태스크 삭제 |
| \`bt-task-setup-step-1.tsx\` (모달) | \`[POST] /tasks\` | 신규 태스크 생성 |
| \`bt-task-setup-step-1.tsx\` (모달) | \`[POST] /test-scenarios/connect/json\`| JSON 포맷 테스트 시나리오 연결 |
| \`url-setting-modal.tsx\` (모달) | \`[GET] /common-base-urls\` | 공통 Base URL 목록 조회 |
| \`url-setting-modal.tsx\` (모달) | \`[POST] /common-base-urls\` | 공통 Base URL 생성 |
| \`url-setting-modal.tsx\` (모달) | \`[PATCH] /common-base-urls/{id}\` | 공통 Base URL 수정 |
| \`url-setting-modal.tsx\` (모달) | \`[DELETE] /common-base-urls\` | 공통 Base URL 일괄 삭제 |
| \`bt-task-management-modal.tsx\` | \`[GET] /deployments/all\` | 배포 상세 전체 조회 |
| \`bt-task-management-modal.tsx\` | \`[GET] /deployments/duplicates\`| 중복 배포 상세 조회 |
| \`bt-task-management-modal.tsx\` | \`[GET] /deployments/filters\` | 배포 필터 조회 |
| \`bt-task-management-modal.tsx\` | \`[POST] /deployments/filters\`| 배포 필터 값 저장 |

---

## 2. 🔄 API 연계 흐름 (Cross-Screen Flow)

| 시작 화면 | 트리거 API | 연계 흐름 (Flow) |
|---|---|---|
| \`bt-task-setup-step-1.tsx\` | \`[POST] /tasks\` | **API 실행** ➡️ **상세페이지(\`/agents/bt/{taskCode}\`) 이동** ➡️ **셋업 모달 유지** |
| \`url-setting-modal.tsx\` | \`[POST] /common-base-urls\` | **API 실행** ➡️ **URL 추가 서브 다이얼로그 닫기** (\`setIsAddDialogOpen(false)\`) |
| \`bt-task-management-modal.tsx\`| \`[POST] /deployments/filters\` | **API 실행** ➡️ **필터 추가 모달 닫기** (\`setIsAddFilterModalOpen(false)\`) |
| \`use-modal-actions.ts\` (Add Case) | \`[POST] /tasks/{taskCode}/scenarios\` | **API 실행** ➡️ **새 시나리오 추가 폼 숨기기** (\`setIsAddScenarioFormVisible(false)\`) |
| \`bt-result-detail-modal.tsx\` | \`[PATCH] /.../completion\` | **API 실행** ➡️ **상태 변경 완료 모달 닫기** (\`setIsCompleteModalOpen(false)\`) |
| \`main.page.tsx\` | \`[POST] /tasks/{taskCode}/complete\`| **API 실행** ➡️ **'배포 완료' 알림 모달 노출** (\`modal.info(...)\`) |

---

## 3. 📦 상태 관리 흐름 (State Update Flow)

| 트리거 API (Mutation) | 연계 흐름 (Cache Update Flow) |
|---|---|
| \`[POST] /tasks\` | **API 실행** ➡️ **\`BTTask\` 캐시 무효화** ➡️ **메인화면 태스크 목록 자동 리렌더링** |
| \`[PUT] /test-scenarios/presets\` | **API 실행** ➡️ **\`BTScenario\` 캐시 무효화** ➡️ **프리셋 패널 자동 리렌더링** |
| \`[PUT] /me/tasks/filters\` | **API 실행** ➡️ **\`BTTask\` 캐시 무효화** ➡️ **메인화면 태스크 목록 자동 리렌더링** |
| \`[POST] /scenarios\` | **API 실행** ➡️ **\`Task\` 캐시 무효화** ➡️ **시나리오 뷰 전체 자동 리렌더링** |
| \`[POST] /versions\` | **API 실행** ➡️ **\`ScenarioCaseVersions\` 캐시 무효화** ➡️ **오버뷰 패널 전체 자동 리렌더링** |
| \`[POST] /versions/{id}/test\` | **API 실행** ➡️ **\`Task\` 캐시 무효화** ➡️ **오버뷰 현황 패널 실시간 갱신** |
| \`[DELETE] /cases/{id}\` | **API 실행** ➡️ **\`Scenario\` 캐시 무효화** ➡️ **시나리오 목록에서 즉시 삭제됨** |
| \`[PATCH] /work-classifications\` | **API 실행** ➡️ **\`WorkClassifications\` 캐시 무효화** ➡️ **업무분류 UI 전체 자동 리렌더링** |
