import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { CartItem, Product } from '@/types';

/**
 * [RTK Query API 슬라이스 - src/store/rtkApi.ts]
 * 적용 위치: src/app/checkout/page.tsx
 * - useGetCartItemsQuery(): GET /api/cart
 * - useGetProductByIdQuery(id): GET /api/products?id={id}
 */
export const shopApi = createApi({
  reducerPath: 'shopApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  tagTypes: ['Cart', 'Products'],
  endpoints: (builder) => ({
    // [RTK Query 1] GET /api/cart - 결제 화면 장바구니 조회
    getCartItems: builder.query<CartItem[], void>({
      query: () => 'api/cart',
      providesTags: ['Cart'],
    }),
    // [RTK Query 2] GET /api/products?id={id} - 상품 단건 조회 (보조)
    getProductById: builder.query<Product[], string>({
      query: (id) => `api/products?id=${id}`,
      providesTags: ['Products'],
    }),
  }),
});

export const { useGetCartItemsQuery, useGetProductByIdQuery } = shopApi;
