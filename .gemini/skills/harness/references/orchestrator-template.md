# Antigravity IDE: 오케스트레이터 템플릿

Claude Code의 Orchestrator 스킬을 Antigravity 시스템의 **Planning Mode(Implementation Plan)** 로 대체하는 방법입니다.

## 1. 하네스 설계 요청 시 템플릿
사용자가 "하네스를 세팅해줘"라고 요청하면, AI는 즉시 `implementation_plan.md`를 다음과 같이 작성해야 합니다.

```markdown
# [프로젝트 도메인] 하네스 파이프라인 기획

## Proposed Changes
### Phase 1: [역할명 A] 페르소나
- 작업 내용 및 생성할 파일 정의
- 예상 산출물

### Phase 2: [역할명 B] 페르소나
- 작업 내용 및 병렬/순차 의존성 명시

### Phase 3: QA 검증 (서브에이전트)
- 검증 명령어 또는 브라우저 접속 경로
```

## 2. 태스크 리스트 (task.md) 템플릿
승인이 완료되면 오케스트레이터(AI)는 아래와 같이 `task.md`를 작성하고 실행에 돌입합니다.

```markdown
# 하네스 워크플로우

- `[ ]` **Phase 1: [역할명 A]**
  - `[ ]` 작업 1
  - `[ ]` 작업 2 (백그라운드 스폰)
- `[ ]` **Phase 2: [역할명 B]**
  - `[ ]` 작업 1
- `[ ]` **Phase 3: QA**
  - `[ ]` 테스트/브라우저 서브에이전트 검증
```

## 3. 에러 핸들링
- 특정 페르소나 단계에서 오류 발생 시, AI는 오류 메시지를 분석하고 `task.md`에 `[Fix] ~버그 수정` 항목을 동적으로 추가하여 자가 치유(Self-healing)를 시도합니다.
