'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { fetchProducts, addToCartApi } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProductCard from '@/components/ProductCard';
import CategoryFilter from '@/components/CategoryFilter';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import { ShoppingBag } from 'lucide-react';

/**
 * [메인 홈 페이지 - src/app/page.tsx]
 * [React Query] useQuery → Axios GET /api/products (상품 목록 캐싱 조회)
 * [React Query] useMutation → Axios POST /api/cart (장바구니 추가)
 * [공통 컴포넌트 2 사용 위치 1] Modal (Quick View 모달)
 */
export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // [React Query - useQuery] Axios GET /api/products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => fetchProducts({ category: selectedCategory }),
  });

  // [React Query - useMutation] Axios POST /api/cart
  const addToCartMutation = useMutation({
    mutationFn: ({ product, quantity }: { product: Product; quantity: number }) =>
      addToCartApi(product, quantity),
    onSuccess: () => {
      // 캐시 무효화 → Header의 useQuery(['cart'])가 자동으로 재요청
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const handleAddToCart = async (product: Product) => {
    await addToCartMutation.mutateAsync({ product, quantity: 1 });
    setQuickViewProduct(null);
  };

  return (
    <main className="main-container">
      {/* 베너 섹션 */}
      <section style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          NEW SEASON ARRIVALS
        </h1>
        <p style={{ color: 'var(--text-sub)', fontSize: '1rem' }}>
          당신의 라이프스타일을 완성하는 감각적인 컬렉션
        </p>
      </section>

      {/* 카테고리 필터 */}
      <CategoryFilter
        currentCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 상품 리스트 카드 그리드 */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
          <Spinner size={36} text="상품 데이터를 불러오는 중입니다..." />
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onQuickView={(p) => setQuickViewProduct(p)}
            />
          ))}
        </div>
      )}

      {/* [공통 컴포넌트 2 사용 위치 1: Modal] Quick View 팝업 */}
      <Modal
        isOpen={quickViewProduct !== null}
        onClose={() => setQuickViewProduct(null)}
        title="상품 빠른 보기 (Quick View)"
      >
        {quickViewProduct && (
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <img
              src={quickViewProduct.image}
              alt={quickViewProduct.name}
              style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '12px' }}
            />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 700 }}>
                {quickViewProduct.category.toUpperCase()}
              </span>
              <h4 style={{ fontSize: '1.2rem', margin: '0.3rem 0' }}>{quickViewProduct.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                {quickViewProduct.description}
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                {quickViewProduct.price.toLocaleString()}원
              </div>
              <button
                onClick={() => handleAddToCart(quickViewProduct)}
                disabled={addToCartMutation.isPending}
                className="checkout-btn"
                style={{ padding: '0.6rem 1.2rem' }}
              >
                <ShoppingBag size={18} />
                <span>{addToCartMutation.isPending ? '담는 중...' : '장바구니에 담기'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
