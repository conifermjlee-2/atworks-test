---
name: parse-ast
description: "React 및 Next.js 프론트엔드 코드를 ts-morph 기반 정적 분석(AST)으로 파싱하여 API 호출 정보를 느슨하게 추출하고 IR JSON 파일로 출력한다."
---

# Parse AST Skill

## 목적
이 스킬은 주어진 프론트엔드 프로젝트 경로를 스캔하여, React 및 Next.js 애플리케이션의 코드에서 API 호출(fetch, axios, useQuery 등)과 그 문맥을 추출하기 위해 사용한다.

## 원칙
1. **느슨한 추출 (Loose Extraction)**: 파편화된 코드 베이스에서 정적 분석이 완벽할 수 없음을 인지한다. 감지하기 모호한 함수나 래퍼라도 API 호출로 의심되면 주변 변수명, 주석과 함께 추출한다.
2. **신뢰도 부여**: 
   - `fetch`, `axios` 처럼 명백하게 확인된 호출은 `confidence: "detected"`로 설정한다.
3. **포맷팅**: 결과물은 기획서에 정의된 공통 IR(JSON) 스키마를 반드시 준수해야 한다.

## 실행 방법
1. 대상 프로젝트의 `src` 또는 루트 디렉토리를 탐색한다.
2. AST 트리를 순회하면서 `CallExpression` 중 비동기 네트워크 요청으로 추정되는 노드를 수집한다.
3. 추출된 데이터를 바탕으로 `ir_output.json` 구조를 조립하여 지정된 `_workspace/` 경로에 저장한다.
