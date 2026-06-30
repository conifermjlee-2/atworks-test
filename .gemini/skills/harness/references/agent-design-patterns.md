# Antigravity IDE: Agent Team Design Patterns

Claude Code의 하네스 설계 철학을 Antigravity의 Planning Mode 워크플로우에 맞게 변환한 가이드입니다.

## 핵심 실행 모드

Antigravity IDE는 단일 강력한 Orchestrator Agent가 **`task.md`를 통해 페르소나를 전환**하며 작업을 수행합니다.

### 1. 파이프라인 (Pipeline)
- **개념**: 순차적인 작업 흐름. 이전 Task의 결과가 다음 Task의 입력이 됨.
- **Antigravity 적용**: `task.md`에 Phase 1, Phase 2로 순차적 리스트를 작성.
- **예시**: 백엔드 구축(Phase 1) → 프론트엔드 구축(Phase 2) → 브라우저 QA 검증(Phase 3).

### 2. 팬아웃/팬인 (Fan-out/Fan-in)
- **개념**: 독립적 작업을 병렬 수행 후 통합.
- **Antigravity 적용**: 백그라운드 터미널 Task를 다수 스폰(`WaitMsBeforeAsync` 활용)하거나, 서로 독립적인 파일 스캐폴딩을 동시에 진행 후 하나의 통합 문서(`walkthrough.md`)로 취합.

### 3. 전문가 풀 (Expert Pool)
- **개념**: 상황별로 알맞은 전문가 호출.
- **Antigravity 적용**: 작업의 성격에 따라 필요한 CLI 도구나 `instructions.md`의 특정 도메인 지식을 참조하여 해당 페르소나에 몰입.

### 4. 생성-검증 (Producer-Reviewer)
- **개념**: 코드 작성 후 별도의 관점에서 검증.
- **Antigravity 적용**: 파일 생성 후, 브라우저 서브에이전트(`browser_subagent`)나 `npm test`, `gradlew test` 등의 검증 툴을 백그라운드로 돌려 교차 검증 수행.

### 5. 감독자 (Supervisor)
- **개념**: 런타임에 동적으로 작업을 분배.
- **Antigravity 적용**: 에이전트 스스로가 지속적으로 `task.md`를 읽고(`TaskUpdate`), 발생한 오류나 추가 작업 소요를 반영하여 동적으로 체크리스트를 수정.

> **원칙**: 모든 아키텍처는 `implementation_plan.md` 단계에서 기획되어야 하며, 실행 중에는 `task.md`를 단일 진실의 원천(SSOT)으로 사용합니다.
