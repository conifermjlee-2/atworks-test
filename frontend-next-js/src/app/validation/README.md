# 값 검증(Value Validation) 로직 아키텍처 및 설명서

이 문서는 `frontend-next-js\src\app\validation` 내에 구현된 API 응답 값 검증(Value Validation) 시스템의 핵심 로직과 구조를 설명합니다.

---

## 1. 개요
API 응답(JSON)의 특정 경로(JSONPath)에 있는 값을 추출하여, 사용자가 지정한 조건(Operator)과 기대값(Expected Value)이 일치하는지 동적으로 검사하는 시스템입니다.

**주요 구성 요소:**
- **프론트엔드 UI (`page.tsx`)**: 사용자로부터 검증 규칙(Rules)을 입력받고, API 응답 스키마(JSON Tree)를 시각화하며, 결과를 테이블 형태로 보여줍니다.
- **백엔드 검증 엔진 (`/api/tester/execute/route.ts`)**: 전달받은 규칙과 API 응답을 대조하여 실제 검증(Evaluate)을 수행하고 채점 결과를 반환합니다.

---

## 2. 프론트엔드 로직 (`page.tsx`)

### 2.1. 검증 규칙 구조 (Rule State)
사용자가 정의하는 각 검증 규칙은 다음과 같은 형태를 가집니다.
```typescript
{
  fieldPath: string;        // 예: "[1].score" (JSONPath 구조)
  operator: string;         // 연산자 (=, !=, >, <, >=, <=, contains)
  expectedValue: string;    // 사용자가 기대하는 값
  valueType: string;        // 값의 원본 타입 (number, string, boolean)
  logicalOperator: string;  // 하위 규칙 연계용 (AND, OR, NONE)
  selected: boolean;        // 검증 실행 시 포함 여부
}
```

### 2.2. 핵심 라이브러리 및 의존성
이 검증 시스템은 외부 무거운 라이브러리에 의존하지 않고 가볍게 구현되었습니다.
- **Next.js & React**: 프론트엔드 UI 및 서버사이드 API Route (`/api/tester/...`) 처리
- **Custom JSON 파서 (`JsonTreeViewer`)**: `react-json-view` 같은 무거운 외부 패키지 대신 커스텀 컴포넌트를 사용하여 직접 DOM 이벤트를 제어(하이라이트, 경로 선택 등)합니다.
- **Custom JSONPath 엔진**: `jsonpath-plus` 같은 라이브러리를 쓰지 않고 정규식과 반복문을 활용한 자체 경량 파서(`evaluatePath`)를 백엔드에 구현했습니다.

### 2.3. 자동 추천 & 스마트 랜덤 상세 원리 (`generateSmartRandom`)
빠른 테스트 작성을 위해 API 응답을 분석하여 자동으로 규칙을 생성하는 기능을 제공합니다. 특히 **풀 랜덤 추천(Smart Random)**은 완전히 무작위인 엉뚱한 값을 넣는 것이 아니라, 원본 응답 데이터를 분석하여 **"현실적이고 그럴싸한 테스트 케이스"**를 자동으로 만들어냅니다.

- **숫자 (Number) 랜덤 원리**:
  단순 0~999가 아니라, 원본 값의 **±20% 범위** 내에서 새로운 랜덤 숫자를 생성합니다.
  (예: 원본이 `95.5`라면, 최솟값 `76.4` ~ 최댓값 `114.6` 사이에서 소수점 1자리까지 맞춰서 `102.3` 같은 값을 생성)
- **문자열 (String) 랜덤 원리**:
  무작위 알파벳(`test_fxsqj`)을 넣지 않습니다. API 응답 전체에서 **모든 문자열 값을 미리 수집(Pool)**해 두고, 그 안에서 랜덤하게 하나를 뽑아옵니다.
  (예: 응답에 `Alice`, `Bob`, `Charlie`가 있다면, `Alice` 자리에 `Bob`을 대입하여 자연스러운 실패 케이스 생성)
- **불리언 (Boolean) 랜덤 원리**:
  동전 던지기가 아니라 원본 값의 **정반대 값(`!value`)**을 대입합니다. (`true` ↔ `false`)

### 2.4. JSON Tree 연동 UI (UX 특화 기능)
- **JSON 노드 하이라이트**: 규칙 좌측의 `⌖` 버튼을 클릭하면, 위쪽의 `Response Body Schema` 트리가 해당 `fieldPath` 위치로 자동 스크롤되며 **노란색**으로 하이라이트 처리됩니다. 하이라이트는 다른 경로를 선택하거나 취소하기 전까지 계속 유지되어 컨텍스트를 잃지 않게 돕습니다.
- **실시간 값 툴팁 (Hover)**: `JSON Path` 입력창에 마우스를 올리면, 툴팁으로 해당 경로에 위치한 현재 API 응답 실제 값을 조회하여 보여줍니다. (`getValueByPath` 헬퍼 함수 사용)

---

## 3. 백엔드 검증 엔진 (`/api/tester/execute/route.ts`)

실제 채점은 프론트엔드가 보낸 `rules` 배열과 `responseBody` 데이터를 이용해 서버(API Route)에서 수행됩니다.

### 3.1. 경로 파싱 및 추출 (Path Evaluation)
사용자가 입력한 `fieldPath` (예: `[1].score`, `$.data.user.name`)를 파싱하여, 파싱된 JSON 객체 내부를 재귀적으로 추적해 실제 값을 찾아냅니다. (`evaluatePath` 함수)
- `$` 표기가 생략되어 있어도 자동으로 보정합니다.
- 배열 인덱스(`[0]`)와 객체 키(`.name`)를 정규식(`/(\.[a-zA-Z_][\w]*|\[\d+\])/g`)으로 분리하여 트리 구조를 타고 내려갑니다.

### 3.2. 채점 방식 및 조건 연산 (Operator Evaluation)
찾아낸 실제 값(Actual)과 사용자가 정의한 기대 값(Expected)의 타입을 맞춘 뒤, `operator`에 따라 엄격하게 비교합니다. (`evaluateCondition` 함수)

| 연산자 | 상세 채점 로직 (Evaluation Logic) |
|--------|-----------------------------------|
| `=` | 두 값이 정확히 일치하는지 비교합니다. 값의 타입이 달라도(예: 숫자 `42` vs 문자열 `"42"`) 문자열로 치환(`String()`)하여 유연하게 채점합니다. |
| `!=` | 두 값이 서로 다른지 확인합니다. |
| `>`, `<`, `>=`, `<=` | **숫자형**일 경우 강제 형변환(`Number()`)하여 수학적 크기를 비교합니다. <br> **문자열**일 경우 자바스크립트 기본 문자열 비교 로직을 통해 **사전순(알파벳순)**으로 크기를 비교합니다. (예: `"Apple" < "Banana"` 👉 `true`) |
| `contains` | 실제 값(문자열) 내부에 기대 값(문자열)이 부분적으로 포함되어 있는지 검사합니다. 자바스크립트의 `.includes()` 메서드를 사용하여 대소문자를 엄격하게 구분하여 채점합니다. |

### 3.3. 최종 결과 (Validation Result)
각 규칙 별로 다음 데이터를 종합하여 프론트엔드로 반환합니다:
- `actualValue`: 엔진이 JSON 경로를 따라가 실제로 찾아낸 값
- `expectedValue`: 사용자가 규칙에 작성한 값
- `passed`: 채점 로직을 통과했는지 여부 (`true` / `false`)

모든 규칙이 개별 채점을 거치며, 단 1개라도 `passed: false`가 나오면 전체 통과 여부(`globalPassed`)는 `false`가 됩니다.
