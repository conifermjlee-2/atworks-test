'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { addToCartApi } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ProductCard from '@/components/ProductCard';
import CategoryFilter from '@/components/CategoryFilter';
import Modal from '@/components/common/Modal';
import { ShoppingBag } from 'lucide-react';

interface HomeClientProps {
  initialProducts: Product[];
}

export default function HomeClient({ initialProducts }: HomeClientProps) {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Client-side filtering instead of fetching again to keep SSG/ISR fast
  const filteredProducts = selectedCategory === 'all' 
    ? initialProducts 
    : initialProducts.filter(p => p.category === selectedCategory);

  // [React Query - useMutation] Axios POST /api/cart
  const addToCartMutation = useMutation({
    mutationFn: ({ product, quantity }: { product: Product; quantity: number }) =>
      addToCartApi(product, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const handleAddToCart = async (product: Product) => {
    await addToCartMutation.mutateAsync({ product, quantity: 1 });
    setQuickViewProduct(null);
  };

  return (
    <>
      {/* 카테고리 필터 */}
      <CategoryFilter
        currentCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 상품 리스트 카드 그리드 */}
      <div className="product-grid">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onQuickView={(p) => setQuickViewProduct(p)}
          />
        ))}
      </div>

      {/* Quick View 팝업 */}
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
    </>
  );
}
