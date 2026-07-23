'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '@/types';
import { fetchProducts } from '@/services/api';
import ProductCard from '@/components/ProductCard';
import CategoryFilter from '@/components/CategoryFilter';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Star } from 'lucide-react';

/**
 * [메인 홈 페이지 - src/app/page.tsx]
 * [시나리오 1 - 1단계] GET /api/products 호출
 * [시나리오 1 - 1단계 후행 액션] 카드 클릭 시 router.push('/products/[id]') 실행으로 상세 B 화면 이동
 * [공통 API 1 호출 위치 1] fetchProducts()
 * [공통 컴포넌트 2 사용 위치 1] Modal (Quick View 모달)
 */
export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Quick View 모달 상태 (공통 컴포넌트 2 사용)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const { addToCart } = useCart();

  // [시나리오 1 - 1단계 API 호출: GET /api/products]
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const data = await fetchProducts({ category: selectedCategory });
        setProducts(data);
      } catch (error) {
        console.error('상품 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [selectedCategory]);

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
      {loading ? (
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
                onClick={() => {
                  addToCart(quickViewProduct, 1);
                  setQuickViewProduct(null);
                }}
                className="checkout-btn"
                style={{ padding: '0.6rem 1.2rem' }}
              >
                <ShoppingBag size={18} />
                <span>장바구니에 담기</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
