# Antigravity IDE: Skill Writing Guide

Claude Code의 `.claude/skills/` 디렉토리 하위 스킬 마크다운 문서들은 Antigravity 환경에서 **프로젝트 맞춤형 Instructions(지침)** 또는 **KIs(Knowledge Items)** 로 치환되어 작성됩니다.

## 1. Description 작성 원칙
Antigravity IDE는 툴을 호출하거나 파일 생성 시 지침을 참고해야 합니다.
- **Why를 설명하라**: 강제적인 규칙보다는 이유를 설명하여 AI가 엣지 케이스에서 판단할 수 있게 합니다.
- **일반화하라**: 도메인(예: Next.js, Java Spring)의 보편적인 아키텍처 원칙을 명시합니다.

## 2. Progressive Disclosure (단계적 로딩)
Antigravity 환경에서는 너무 긴 프롬프트를 피하기 위해, 핵심 원칙만 `.gemini/instructions.md` (또는 프로젝트 루트의 `INSTRUCTIONS.md`)에 저장하고, 구체적인 도메인 지식은 별도의 참조 파일로 분리한 후 AI에게 "필요 시 Read 하라"고 유도하는 것이 좋습니다.

## 3. 스킬-에이전트 연결
- **스킬**: "어떻게 하는가" (지침 문서)
- **에이전트**: "누가 하는가" (`task.md` 상의 현재 페르소나)
Antigravity는 `task.md`를 진행하면서 자신에게 부여된 페르소나에 맞춰 스킬(지침 문서)을 읽고 코드를 작성합니다.
