---
name: infer-scenario
description: "추출된 프론트엔드 IR(JSON) 데이터를 바탕으로 로컬/Gemini LLM에 쿼리하여 누락된 문맥을 추론하고 최종 비즈니스 시나리오 문서를 생성한다."
---

# Infer Scenario Skill

## 목적
AST 파서가 추출한 불완전하거나 파편화된 중간 표현(IR) 데이터를 LLM을 통해 이어붙이고 사람이 읽을 수 있는 유효한 비즈니스 시나리오로 변환한다.

## 원칙
1. **신뢰도 보존과 추론 명시**: 
   - 입력받은 IR 중 `confidence: "detected"`인 데이터는 훼손하지 않는다.
   - LLM이 추가로 추론하여 연결한 호출(예: 상태 관리 스토어와 컴포넌트 간의 간접 호출 연결)은 반드시 `confidence: "inferred"`로 표기하고, 왜 그렇게 판단했는지 `evidence` 필드를 통해 근거를 남긴다.
2. **보안 규칙**: 테스트 중이더라도 상용 LLM에 실제 고객사 코드를 보내지 않는다. (더미 데이터 사용 원칙)
3. **추상화된 Provider 호출**: 특정 SDK 코드를 직접 실행하지 않고, 추상화된 LLM 인터페이스를 가정하여 통신한다.

## 실행 방법
1. `_workspace/ir_output.json` 파일을 읽는다.
2. LLM Provider에 전송할 프롬프트를 구성한다 (예: "다음 IR 데이터를 바탕으로 사용자 로그인부터 구매까지의 시나리오를 구성하고, 끊어진 흐름을 추론하여 inferred로 표기하라.")
3. LLM 응답을 파싱하여, 시각적 뱃지(detected/inferred 구분)가 적용된 `scenario_report.md` 최종 문서를 생성한다.
