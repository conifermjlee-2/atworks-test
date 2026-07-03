# Backend Package Structure (Feature-Based Architecture)

이 프로젝트는 **기능 및 도메인 기반(Feature-Based, Domain-Driven)** 패키지 구조를 따르고 있습니다.
새로운 기능을 추가할 때, 전통적인 계층형 구조(Layered - `controller`, `service`, `dto` 등)로 분산시키지 말고 **해당 도메인 패키지 내부**에 모두 모아서 관리해야 합니다.

## 📦 `com.atworks.backend`

### 1. `validation` (값 검증 도메인)
Swagger 문서를 분석하여 자동으로 값 검증 규칙을 추천해주는 핵심 비즈니스 로직을 담당합니다.
- `SwaggerAnalyzerController.java`: 검증 규칙 추천 API 엔드포인트
- `SwaggerAnalyzerService.java`: Swagger 파싱 및 규칙 생성 로직
- `SwaggerAnalyzerRequest.java`: 추천 요청 DTO

### 2. `registry` (API 관리 및 수집 도메인)
분석 대상이 되는 외부 Swagger JSON을 통째로 수집(Pull)하고, DB에 API 리스트를 등록/조회/삭제하는 기능입니다.
- `ApiRegistry.java`: DB에 저장되는 API 엔티티
- `ApiRegistryRepository.java`: DB 접근 리포지토리
- `ApiRegistryController.java` / `ApiRegistryService.java`: CRUD API 및 비즈니스 로직
- `SwaggerPullService.java`: 외부 URL에서 Swagger 데이터를 긁어와 DB에 일괄 저장하는 로직
- `ApiRegistryRequest.java` / `ApiRegistryResponse.java` / `SwaggerPullRequest.java`

### 3. `global` (공통 인프라 도메인)
어플리케이션 전반에 걸쳐 사용되는 공통 설정, 예외 처리, 헬스 체크 등을 담당합니다.
- `WebConfig.java`: CORS 및 웹 전역 설정
- `HealthCheckController.java`: 서버 상태 확인용 API

### 4. `sample` (테스트 도메인)
추천 기능 자체를 테스트하기 위해 생성해 둔 임시/샘플 컨트롤러들의 모음입니다.
- `DeliveryController.java`: 다양한 데이터 타입과 제약조건(Enum, Min/Max 등)을 테스트하기 위한 샘플 API

---
> 💡 **원칙 요약**
> `com.atworks.backend.controller`나 `com.atworks.backend.service` 처럼 역할별로 폴더를 만들지 마세요!
> 무조건 **'어떤 기능인가?'**를 기준으로 패키지를 만들고, 그 안에 관련된 Controller, Service, Dto를 모두 넣어야 합니다.
