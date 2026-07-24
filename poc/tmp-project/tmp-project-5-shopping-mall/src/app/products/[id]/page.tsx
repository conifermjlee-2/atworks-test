import React from 'react';
import { getProductByIdServer, getProductsServer } from '@/services/serverApi';
import ProductDetailClient from '@/components/ProductDetailClient';
import { Product } from '@/types';

export const dynamic = 'force-dynamic'; // SSR: 매 요청마다 서버에서 렌더링

/**
 * [제품 상세 페이지 - src/app/products/[id]/page.tsx]
 * 서버 컴포넌트(Server Component)로 동작
 * fetch를 사용하여 상품 상세 및 연관 상품 데이터를 요청 (SSR)
 */
export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const productId = params.id;

  // SSR: cache: 'no-store' 로 매 요청마다 서버에서 최신 데이터를 가져옴
  const product = await getProductByIdServer(productId);
  
  let relatedProducts: Product[] = [];
  if (product) {
    const allProducts = await getProductsServer();
    relatedProducts = allProducts
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 4);
  }

  return <ProductDetailClient product={product} relatedProducts={relatedProducts} />;
}
