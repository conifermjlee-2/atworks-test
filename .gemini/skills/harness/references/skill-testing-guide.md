# Antigravity IDE: Skill Testing Guide

이 문서는 구축된 하네스 워크플로우의 결과를 테스트하고 사용자 피드백을 수용하는 가이드입니다.

## 1. 드라이런 (Dry-run)
실제 백그라운드 태스크를 실행하기 전에, `implementation_plan.md`를 통해 데이터 전달 경로(포트, 폴더 구조 등)에 끊김이 없는지 검토합니다.

## 2. With-skill vs Without-skill 비교
하네스 적용 전후의 결과물 품질을 평가하기 위해, 프롬프트 엔지니어링 단계에서 제공된 도메인 스킬 지식을 적극적으로 참고했는지 자가 점검합니다.

## 3. 피드백 반영 (Harness 진화)
모든 태스크가 완료된 후, AI는 `walkthrough.md`를 통해 사용자에게 결과를 보고하고 피드백을 수집합니다.
- **오류 발생 시**: `task.md`를 즉시 수정하여 재실행합니다.
- **설계 변경 시**: `implementation_plan.md`를 갱신하고 재승인을 받습니다.
