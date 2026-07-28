import axios from 'axios';
import { Product, CartItem, CheckoutRequest, CheckoutResponse } from '@/types';

/**
 * [공통 API 클라이언트 모듈 - src/services/api.ts]
 * 실무 표준: Axios 단일 인스턴스(axiosClient)로 모든 통신 통일
 * baseURL, headers, 인터셉터 등 공통 설정을 한 곳에서 관리
 */

// Axios 공통 인스턴스 (실무에서는 토큰 인터셉터, 에러 핸들링 등도 여기에 추가)
const axiosClient = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

// 1. [공통 API 1] Axios - GET /api/products (상품 목록 & 상세 & 추천 상품 조회)
export async function fetchProducts(options?: { category?: string; search?: string; id?: string }): Promise<Product[]> {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.search) params.append('search', options.search);
  if (options?.id) params.append('id', options.id);

  const { data } = await axiosClient.get<Product[]>(`api/products?${params.toString()}`);
  return data;
}

// 2. [공통 API 2-A] Axios - GET /api/cart (장바구니 목록 조회)
export async function fetchCartItems(): Promise<CartItem[]> {
  const { data } = await axiosClient.get<CartItem[]>('api/cart');
  return data;
}

// 3. [공통 API 2-B] Axios - POST /api/cart (장바구니 상품 추가)
export async function addToCartApi(product: Product, quantity: number = 1): Promise<{ success: boolean; cart: CartItem[] }> {
  const { data } = await axiosClient.post<{ success: boolean; cart: CartItem[] }>('api/cart', { product, quantity });
  return data;
}

// 4. [공통 API 3] Axios - POST /api/orders (모의 결제 처리)
export async function requestCheckoutApi(data: CheckoutRequest): Promise<CheckoutResponse> {
  const { data: responseData } = await axiosClient.post<CheckoutResponse>('api/orders', data);
  return responseData;
}
