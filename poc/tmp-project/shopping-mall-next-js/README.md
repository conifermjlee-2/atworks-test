# Next.js 기반 미니 쇼핑몰 애플리케이션 (POC)

본 프로젝트는 정적 분석 도구(`get-front-code-5`)의 API 추적 및 화면 이동 시나리오 검증을 목적으로 제작된 Next.js 기반의 쇼핑몰 테스트베드입니다.

---

## 🛠 사용된 라이브러리 및 기술 스택

### 핵심 프레임워크
- **Next.js (14.1.0)**: App Router 라우팅, Route Handlers (API 서버 역할)
- **React (18.2.0) / React DOM (18.2.0)**: UI 구축
- **TypeScript (5.3.3)**: 정적 타입 검사

### UI 및 아이콘
- **lucide-react (0.344.0)**: 아이콘 렌더링

### 📡 통신 라이브러리 (실무 표준 단일 체계)
| 패키지 | 역할 | 사용 위치 |
|---|---|---|
| **axios** | HTTP 클라이언트 (모든 API 통신) | `src/services/api.ts` |
| **@tanstack/react-query** | 서버 상태 관리 (캐싱, 로딩, 재요청 자동화) | 전체 페이지 컴포넌트 |

---

## 🎯 화면별 API 시나리오 흐름

### 🛒 시나리오 1: 장바구니 흐름

```
[1단계: 홈 메인 /]
  useQuery(['products', category])
  → Axios GET /api/products
  → 후행 액션: 카드 클릭 시 /products/{id} 화면 이동

[2단계: 상품 상세 /products/[id]]
  useQuery(['product', id])
  → Axios GET /api/products?id={id}

  useMutation: 장바구니 담기 클릭
  → Axios POST /api/cart
  → onSuccess: invalidateQueries(['cart']) → Header 배지 자동 갱신

  useMutation: 바로 구매하기 클릭
  → Axios POST /api/checkout
  → onSuccess: router.push('/order-complete')
```

### 💳 시나리오 2: 결제 흐름

```
[1단계: 결제 화면 /checkout]
  useQuery(['cart'])
  → Axios GET /api/cart (주문 상품 목록)
  → 약관 보기 클릭 시 Modal 공통 컴포넌트 오픈

[2단계: 결제 승인]
  useMutation: 결제하기 클릭
  → Axios POST /api/checkout
  → onSuccess: router.push('/order-complete?orderId=...')
```

---

## 📁 파일별 역할 가이드

| 파일 | 역할 | 통신 도구 |
|---|---|---|
| `src/services/api.ts` | Axios 인스턴스 기반 공통 API 함수 4종 | Axios |
| `src/providers/Providers.tsx` | QueryClientProvider 래퍼 (캐시 초기화) | - |
| `src/app/page.tsx` | 메인 홈 (useQuery + useMutation) | React Query |
| `src/app/products/[id]/page.tsx` | 상품 상세 (useQuery × 2 + useMutation × 2) | React Query |
| `src/components/common/Header.tsx` | 공통 헤더, 장바구니 배지 (useQuery) | React Query |
| `src/app/checkout/page.tsx` | 결제 화면 (useQuery + useMutation) | React Query |
| `src/app/api/*/route.ts` | 백엔드 API Route Handlers (Node.js 서버) | - |
| `src/components/common/Modal.tsx` | 공통 팝업 모달 컴포넌트 | - |
| `src/components/common/Header.tsx` | 공통 GNB 헤더 컴포넌트 | - |

---

## 🚀 실행 방법

```bash
# 프로덕션 빌드 & 실행 (권장 - 실제 속도 확인용)
npm run build
npx next start -p 3004

# 개발 서버 (코드 수정 반영용, 페이지 첫 접속 시 컴파일 딜레이 발생)
npm run dev
```
