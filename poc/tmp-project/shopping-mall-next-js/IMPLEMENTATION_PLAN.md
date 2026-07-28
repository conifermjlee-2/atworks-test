# 쇼핑몰 리팩토링 기획서 (v8) — 실무 표준 통신 구조

---

## 📌 핵심 변경 목적

현재 프로젝트는 5가지 통신 라이브러리를 혼용하고 있어 실무 환경과 동떨어져 있습니다.
**실무에서 가장 많이 쓰이는 조합인 Axios + React Query 단일 체계로 통일합니다.**

| 항목 | 현재 (v7, 비실무) | 변경 후 (v8, 실무 표준) |
|---|---|---|
| HTTP 클라이언트 | Fetch + Axios 혼용 | **Axios 단독** |
| 서버 상태 관리 | React Query + SWR + RTK Query 혼용 | **React Query 단독** |
| 전역 상태 저장소 | Redux + QueryClient 이중 Provider | **QueryClient 단독 Provider** |
| 제거 라이브러리 | - | `swr`, `@reduxjs/toolkit`, `react-redux` 제거 |

---

## 🔍 왜 Axios + React Query인가?

### Axios (HTTP 클라이언트)
- npm 주간 다운로드 수 **6,000만+** (브라우저 Fetch API보다 압도적으로 많이 쓰임)
- 자동 JSON 변환, 인터셉터(토큰 갱신 등), 에러 핸들링 등 실무 필수 기능 내장
- 프로젝트 전체에서 **`axios.create()` 인스턴스 하나**로 공통 설정(baseURL, headers) 통일

### React Query (@tanstack/react-query)
- npm 주간 다운로드 수 **1,000만+** (SWR, RTK Query보다 훨씬 많이 쓰임)
- `useQuery`(조회), `useMutation`(수정/등록/삭제) 훅으로 서버 통신의 로딩/에러/캐싱 자동 처리
- `queryClient.invalidateQueries()` 로 특정 데이터만 정밀하게 캐시 무효화 가능

---

## 📐 변경 후 아키텍처

```
[통신 흐름]
  화면 컴포넌트
    ↓ useQuery / useMutation (React Query 훅)
  src/services/api.ts (Axios 기반 API 함수들)
    ↓ axios.get / axios.post
  백엔드 API (/api/products, /api/cart, /api/checkout)
```

---

## 📡 화면별 React Query 훅 매핑

```
┌────────────────────────────────────────────────────────────────────┐
│  화면 / 위치              │  React Query 훅   │  Axios Endpoint    │
├────────────────────────────────────────────────────────────────────┤
│  메인 홈 (page.tsx)       │  useQuery         │  GET /api/products │
├────────────────────────────────────────────────────────────────────┤
│  상품 상세 ([id]/page.tsx) │  useQuery         │  GET /api/products?id= │
├────────────────────────────────────────────────────────────────────┤
│  장바구니 추가 (상세/홈)   │  useMutation      │  POST /api/cart    │
├────────────────────────────────────────────────────────────────────┤
│  결제 화면 (/checkout)    │  useQuery         │  GET /api/cart     │
├────────────────────────────────────────────────────────────────────┤
│  결제 승인 (/checkout)    │  useMutation      │  POST /api/checkout│
└────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 화면별 흐름 상세

### 1️⃣ 메인 홈 (`/`) — useQuery
```
[렌더링]
  └─ useQuery({ queryKey: ['products', category] })
       └─ axios.get('/api/products?category={value}')

[Quick View 장바구니 담기 클릭 후행 액션]
  └─ useMutation → axios.post('/api/cart')
       └─ onSuccess: queryClient.invalidateQueries(['cart'])  → Header 배지 갱신
```

### 2️⃣ 상품 상세 (`/products/[id]`) — useQuery
```
[렌더링]
  └─ useQuery({ queryKey: ['product', id] })
       └─ axios.get('/api/products?id={id}')

[장바구니 담기 클릭 후행 액션]
  └─ useMutation → axios.post('/api/cart')
       └─ onSuccess: queryClient.invalidateQueries(['cart'])

[바로 구매하기 클릭 후행 액션]
  └─ useMutation → axios.post('/api/checkout')
       └─ onSuccess: router.push('/order-complete')
```

### 3️⃣ 공통 Header — useQuery
```
[상시 동작]
  └─ useQuery({ queryKey: ['cart'] })
       └─ axios.get('/api/cart')  →  배지 숫자 표시
       └─ invalidateQueries(['cart']) 수신 시 자동 갱신
```

### 4️⃣ 결제 화면 (`/checkout`) — useQuery + useMutation
```
[렌더링]
  └─ useQuery({ queryKey: ['cart'] })
       └─ axios.get('/api/cart')  →  주문 상품 목록

[약관 보기 클릭 후행 액션]
  └─ Modal 공통 컴포넌트 오픈

[결제하기 클릭 후행 액션]
  └─ useMutation → axios.post('/api/checkout')
       └─ onSuccess: router.push('/order-complete?orderId=...')
```

---

## 📁 파일 변경 범위

### [DELETE]
- `src/store/rtkApi.ts`  ← RTK Query 슬라이스 삭제

### [MODIFY]
| 파일 | 변경 내용 |
|---|---|
| `package.json` | `swr`, `@reduxjs/toolkit`, `react-redux` 언인스톨 |
| `src/providers/Providers.tsx` | Redux Provider 제거 → QueryClientProvider만 유지 |
| `src/services/api.ts` | 전체 함수를 `axios.create()` 인스턴스 기반으로 통일 |
| `src/app/page.tsx` | useQuery 유지 (이미 적용됨) |
| `src/app/products/[id]/page.tsx` | useSWR → useQuery + useMutation으로 교체 |
| `src/components/common/Header.tsx` | useSWR → useQuery로 교체 |
| `src/app/checkout/page.tsx` | RTK Query → useQuery + useMutation으로 교체 |
| `src/components/ProductCard.tsx` | mutate(SWR) → queryClient.invalidateQueries 교체 |

---

## 📊 검출 예상 결과 (정적 분석기 기준)

| 파일 | React Query 훅 | Axios Endpoint | 개수 |
|---|---|---|---|
| `src/services/api.ts` | - | GET /api/products, GET /api/cart, POST /api/cart, POST /api/checkout | 4 |
| `src/app/page.tsx` | useQuery | - | 1 |
| `src/app/products/[id]/page.tsx` | useQuery, useMutation × 2 | - | 3 |
| `src/components/common/Header.tsx` | useQuery | - | 1 |
| `src/app/checkout/page.tsx` | useQuery, useMutation | - | 2 |
| **합계** | | | **11개** |
