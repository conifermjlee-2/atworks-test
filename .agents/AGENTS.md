# 백엔드 패키지 구조 원칙 (Feature-Based Architecture)

이 프로젝트는 전통적인 계층형(Layered - controller, service, dto 등) 패키지 구조를 지양하고, **기능 및 도메인 기반(Feature-Based, Domain-Driven)** 패키지 구조를 준수합니다.

새로운 기능을 추가하거나 코드를 생성할 때, 반드시 아래 구조를 따라야 합니다.

## 패키지 분류 기준
- `validation` : Swagger 기반 값 검증 및 분석 관련 로직
- `registry` : Swagger API 수집, 관리, CRUD 관련 로직 (DB 엔티티 포함)
- `global` : 공통 설정(Config), 예외 처리(ExceptionHandler), 헬스 체크 등
- `sample` : 개발 및 테스트 목적의 임시/샘플 컨트롤러

각 기능 패키지 내부에 Controller, Service, Repository, Entity, Dto가 모두 뭉쳐 있어야 합니다. (예: `com.atworks.backend.validation.SwaggerAnalyzerController`)
절대 `com.atworks.backend.controller.*` 처럼 흩어놓지 마세요.
