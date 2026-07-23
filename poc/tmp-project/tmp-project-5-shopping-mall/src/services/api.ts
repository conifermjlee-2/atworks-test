import { Product, CartItem, CheckoutRequest, CheckoutResponse } from '@/types';

/**
 * [공통 API 클라이언트 모듈 - src/services/api.ts]
 * 정적 분석기(get-front-code-5)가 호출 관계를 파악하는 대표 서비스 모듈
 */

// 1. [공통 API 1] GET /api/products (상품 목록 & 제품 상세 & 추천 상품 조회)
export async function fetchProducts(options?: { category?: string; search?: string; id?: string }): Promise<Product[]> {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.search) params.append('search', options.search);
  if (options?.id) params.append('id', options.id);

  const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('상품 데이터를 불러오는데 실패했습니다.');
  return res.json();
}

// 2. [공통 API 2-A] GET /api/cart (장바구니 목록 조회 - 결제 페이지 / 드로어 공통)
export async function fetchCartItems(): Promise<CartItem[]> {
  const res = await fetch('/api/cart', { cache: 'no-store' });
  if (!res.ok) throw new Error('장바구니 데이터를 불러오는데 실패했습니다.');
  return res.json();
}

// 3. [공통 API 2-B] POST /api/cart (장바구니 상품 추가)
export async function addToCartApi(product: Product, quantity: number = 1): Promise<{ success: boolean; cart: CartItem[] }> {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, quantity }),
  });
  if (!res.ok) throw new Error('장바구니 담기에 실패했습니다.');
  return res.json();
}

// 4. [공통 API 3] POST /api/checkout (모의 결제 처리 API)
export async function requestCheckoutApi(data: CheckoutRequest): Promise<CheckoutResponse> {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('결제 승인 처리 중 오류가 발생했습니다.');
  return res.json();
}
