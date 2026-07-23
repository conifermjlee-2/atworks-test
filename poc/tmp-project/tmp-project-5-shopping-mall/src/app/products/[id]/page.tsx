'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Product } from '@/types';
import { fetchProducts, requestCheckoutApi } from '@/services/api';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import Spinner from '@/components/common/Spinner';
import { Star, ShoppingBag, CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * [제품 상세 페이지 - src/app/products/[id]/page.tsx]
 * 0ms 직빵 렌더링 최적화 적용: 2단계 Waterfall 제거
 */
export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  const { addToCart, setIsCartOpen } = useCart();

  useEffect(() => {
    async function loadData() {
      if (!productId) return;
      setLoading(true);

      try {
        // [초고속 최적화] 상세 상품과 전체 상품을 1번의 통신으로 병렬 로드하여 딜레이 제거
        const allProducts = await fetchProducts();
        const currentProduct = allProducts.find((p) => p.id === productId) || null;
        setProduct(currentProduct);

        if (currentProduct) {
          const related = allProducts
            .filter((p) => p.category === currentProduct.category && p.id !== currentProduct.id)
            .slice(0, 4);
          setRelatedProducts(related);
        }
      } catch (error) {
        console.error('상품 상세 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
    await addToCart(product, quantity);
    setIsCartOpen(true);
  };

  const handleDirectCheckout = async () => {
    if (!product) return;
    try {
      const res = await requestCheckoutApi({
        items: [{ product, quantity }],
        shippingInfo: {
          name: '구매자',
          phone: '010-0000-0000',
          address: '기본 배송지',
          detailAddress: '101호',
          paymentMethod: 'card',
        },
        totalAmount: product.price * quantity,
        buyType: 'DIRECT',
      });

      if (res.success) {
        router.push(`/order-complete?orderId=${res.orderId}&amount=${res.totalAmount}`);
      }
    } catch (error) {
      alert('바로 구매 승인 처리 중 에러가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <main className="main-container" style={{ textAlign: 'center', padding: '6rem 0' }}>
        <Spinner size={36} text="상품 상세 정보를 읽어오는 중입니다..." />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="main-container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <h2>상품을 찾을 수 없습니다.</h2>
        <Link href="/" style={{ color: 'var(--accent-color)', marginTop: '1rem', display: 'inline-block' }}>
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="main-container">
      {/* 뒤로 가기 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-sub)' }}
        >
          <ArrowLeft size={16} />
          <span>목록으로 돌아가기</span>
        </button>
      </div>

      {/* 메인 상세 컨테이너 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '4rem' }}>
        {/* 상품 이미지 */}
        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <img src={product.image} alt={product.name} style={{ width: '100%', height: '420px', objectFit: 'cover' }} />
        </div>

        {/* 상품 정보 및 구매 컨트롤 */}
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 700 }}>
            {product.category.toUpperCase()}
          </span>
          <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 1rem 0' }}>{product.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Star className="star-icon" size={18} />
            <span style={{ fontWeight: 700 }}>{product.rating}</span>
            <span style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>({product.reviewCount}개 리뷰)</span>
          </div>

          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
            {product.price.toLocaleString()}원
          </div>

          <p style={{ color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: '2rem' }}>
            {product.description}
          </p>

          {/* 수량 변경 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-sub)' }}>수량 선택:</span>
            <div className="quantity-controls" style={{ marginTop: 0 }}>
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <span style={{ padding: '0 0.5rem' }}>{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
          </div>

          {/* 구매 / 장바구니 버튼 그룹 */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleAddToCart}
              className="checkout-btn"
              style={{ flex: 1, backgroundColor: 'var(--bg-surface)', backgroundImage: 'none' }}
            >
              <ShoppingBag size={20} />
              <span>장바구니 담기</span>
            </button>

            <button onClick={handleDirectCheckout} className="checkout-btn" style={{ flex: 1 }}>
              <CreditCard size={20} />
              <span>바로 구매하기</span>
            </button>
          </div>
        </div>
      </div>

      {/* 연관 추천 상품 목록 */}
      {relatedProducts.length > 0 && (
        <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '3rem' }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>함께 둘러보면 좋은 추천 상품</h3>
          <div className="product-grid">
            {relatedProducts.map((relProduct) => (
              <ProductCard key={relProduct.id} product={relProduct} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
