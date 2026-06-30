# Antigravity IDE Harness 가이드라인

본 문서는 `atworks-test` 프로젝트 내에서 Antigravity IDE 에이전트가 여러 전문 에이전트들의 역할을 오케스트레이션하여 작업을 수행하기 위한 지침서입니다.
Claude Code용 Harness 워크플로우를 Antigravity IDE의 Planning Mode(Artifacts 기반)에 맞게 최적화하였습니다.

## 기본 원칙
1. **단일 오케스트레이터, 다중 페르소나**: Antigravity 에이전트는 본인이 오케스트레이터가 되어 `implementation_plan.md`로 아키텍처를 설계하고, `task.md`를 통해 순차적으로 페르소나(역할)를 전환해가며 작업을 수행합니다.
2. **Artifacts 중심의 상태 공유**: 각 페르소나 간의 데이터 전달은 메모리뿐만 아니라 `_workspace/` 폴더의 중간 산출물을 통해 영속성을 보장합니다.
3. **점진적 검수(Incremental QA)**: 모든 큰 작업 후에는 QA 페르소나로 전환하여 생성된 코드를 교차 검증합니다.

## 워크플로우

사용자가 "하네스를 구성해줘" 혹은 복잡한 도메인 작업을 지시할 때 다음 순서를 따릅니다.

### Phase 1: 도메인 분석 및 계획 (Implementation Plan)
1. 사용자 요구사항 파악 후, 적절한 아키텍처 패턴을 선택합니다.
2. `implementation_plan.md`를 생성하여 작업 흐름을 명시하고 사용자 승인을 받습니다.

### Phase 2: 아키텍처 패턴 선택 (Task Templates)
작업 특성에 따라 다음 `.harness/templates/` 템플릿 중 하나를 골라 `task.md`에 반영합니다.
- **파이프라인 (Pipeline)**: 순차적 의존 작업 (예: 기획 → 백엔드 → 프론트 → QA)
- **팬아웃/팬인 (Fan-out/Fan-in)**: 독립적 병렬 작업 후 취합 (예: 모듈 A, B, C 각각 개발 후 통합)
- **생성-검증 (Producer-Reviewer)**: 초안 생성 후 엄격한 리뷰 (예: 코드 작성 → 정적 분석 및 버그 수정)

### Phase 3: 페르소나별 Task 수행 (Execution)
1. `task.md`에 명시된 순서에 따라 작업을 진행합니다.
2. **"이제 [프론트엔드 전문가] 페르소나로 전환하여..."**와 같이 역할을 자각하고 해당 전문성에 맞게 코드를 작성합니다.
3. 중간 데이터는 `.harness/workspace/` 에 저장하여 다음 페르소나가 참고하게 합니다.

### Phase 4: 최종 검증 (Walkthrough)
작업이 완료되면 `walkthrough.md`를 생성하여 실행 결과, 테스트 내역, 그리고 최종 산출물의 동작 방식을 사용자에게 보고합니다.

---
**트리거**: "하네스 설계해줘", "아키텍처 패턴으로 개발해줘" 혹은 대규모 시스템 개발 요청 시 이 문서를 먼저 읽고 진행하십시오.
