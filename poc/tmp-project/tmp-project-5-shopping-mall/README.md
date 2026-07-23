# Next.js 기반 미니 쇼핑몰 애플리케이션 (POC)

본 프로젝트는 정적 분석 도구(`get-front-code-5`)의 API 추적 및 화면 이동 시나리오 검증을 목적으로 제작된 Next.js 기반의 쇼핑몰 테스트베드입니다.

## 🛠 사용된 라이브러리 및 기술 스택

### 핵심 프레임워크
- **Next.js (14.1.0)**: App Router 라우팅, 서버 컴포넌트 및 클라이언트 컴포넌트 혼합 활용, Route Handlers (API 서버 대체)
- **React (18.2.0) / React DOM (18.2.0)**: UI 구축 및 상태 관리
- **TypeScript (5.3.3)**: 정적 타입 검사

### UI 및 아이콘
- **lucide-react (0.344.0)**: 아이콘 렌더링 (`ShoppingBag`, `Star`, `CreditCard` 등)

### 상태 관리
- **React Context API (`useContext`)**: 장바구니 전역 상태 관리 (`CartContext.tsx`)

---

## 🎯 화면별 API 시나리오 흐름 (API Call Sequences)

분석 도구가 추적하게 되는 **2가지 핵심 화면별 API 시나리오 흐름**입니다.

### 🛒 시나리오 1: 장바구니 흐름 (Cart Scenario)
```text
[1단계: 홈 메인] ➔ (카드 클릭) ➔ [2단계: 제품 상세] ➔ (장바구니 담기) ➔ [3단계: 헤더 장바구니 Drawer 열림]
```
- **1단계 (`/`)**: 메인 홈 페이지 렌더링. `GET /api/products` 통신 1회. 후행 액션으로 카드 클릭 시 B화면(상세)으로 이동.
- **2단계 (`/products/[id]`)**: 상세 B 화면 렌더링. `GET /api/products?id={id}` 통신 1회. 
- **3단계 (공통 컴포넌트 `Header`)**: 장바구니 버튼 클릭. `POST /api/cart` 통신 후, 전역 Context가 업데이트되며 공통 컴포넌트 장바구니 모달이 열림.

### 💳 시나리오 2: 결제 흐름 (Checkout Scenario)
```text
[1단계: 장바구니/상세] ➔ (결제 클릭) ➔ [2단계: 결제 폼] ➔ (모의 결제 승인) ➔ [3단계: 주문 완료 화면]
```
- **1단계 (`/products/[id]` 또는 장바구니)**: '바로 구매하기' 클릭 시 결제 폼 화면으로 이동.
- **2단계 (`/checkout`)**: 결제 폼 화면. `GET /api/cart` 로 장바구니/상품 재검증. "약관 보기" 클릭 시 공통 `Modal` 팝업.
- **3단계 (`/order-complete`)**: 결제하기 버튼 클릭. `POST /api/checkout` API 승인 완료 시, 최종 주문 완료 C 화면으로 자동 리다이렉션 이동.

---

## 📌 파일별 위치 및 API 분석 가이드

| 화면 (View) | 파일 경로 | 설명 및 호출 API |
|---|---|---|
| **API 서비스 모듈** | `src/services/api.ts` | 공통 통신 모듈. 원본 API 4종 정의 (`GET /api/products`, `GET /api/cart`, `POST /api/cart`, `POST /api/checkout`) |
| **전역 장바구니** | `src/context/CartContext.tsx` | 전역 상태 모듈. `GET /api/cart` (초기화), `POST /api/cart` (추가) |
| **메인 홈 화면** | `src/app/page.tsx` | 메인 페이지. `GET /api/products` 1개 호출 |
| **상품 상세 화면** | `src/app/products/[id]/page.tsx` | 상세 페이지. `GET /api/products`, `POST /api/checkout` (바로구매) 호출 |
| **결제 진행 화면** | `src/app/checkout/page.tsx` | 결제 페이지. `GET /api/cart`, `POST /api/checkout` 호출 |
| **공통 컴포넌트** | `src/components/common/*` | `Modal`(모달 팝업), `Header`(장바구니 드로어 포함), `Spinner`(로딩 UI) |
| **백엔드 API 서버** | `src/app/api/.../route.ts` | Next.js API Routes. 실제 Node.js 환경에서 목업 데이터를 JSON으로 렌더링하는 역할 |
