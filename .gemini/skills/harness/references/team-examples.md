# Antigravity IDE: 실전 하네스 예시

## 사례: Next.js + Spring Boot 풀스택 연동 파이프라인

이 프로젝트(`atworks-test`)에서 성공적으로 적용되었던 Antigravity 하네스 구성 사례입니다.

### 1. Planning Mode 기획 (implementation_plan.md)
```markdown
# 파이프라인 아키텍처 적용
- Phase 1: 백엔드 개발자 (Spring Boot 17, Gradle, CORS 설정)
- Phase 2: 프론트엔드 개발자 (Next.js 15, Tailwind, API Fetch)
- Phase 3: QA (브라우저 검증)
```

### 2. 오케스트레이션 (task.md)
AI는 자신을 오케스트레이터로 선언하고 아래처럼 페르소나를 쪼개어 순차 진행합니다.
- `[x]` 백엔드 `gradlew bootRun`을 백그라운드 태스크로 구동
- `[x]` 프론트엔드 `npm run dev`를 백그라운드 태스크로 구동
- `[x]` `browser_subagent` 도구를 호출하여 결과 캡처 및 정합성 검증

이처럼 Antigravity에서는 다수의 독립된 에이전트 대신, 단일 AI가 **강력한 플래닝 툴과 백그라운드 스폰 시스템**을 활용하여 팀 아키텍처를 시뮬레이션하고 완벽한 결과를 냅니다.
