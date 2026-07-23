'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ShoppingCart, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchCartItems } from '@/services/api';
import { CartItem } from '@/types';

interface HeaderProps {
  isCheckoutPage?: boolean;
}

/**
 * [공통 컴포넌트 1: Header - src/components/common/Header.tsx]
 * 사용 위치 1: src/app/layout.tsx (루트 공통 GNB)
 * 사용 위치 2: src/app/checkout/page.tsx (결제 전용 Header)
 * - useQuery(['cart']): Axios GET /api/cart → 장바구니 배지 숫자 실시간 조회
 * - invalidateQueries(['cart']) 수신 시 자동 재요청 및 갱신
 */
export const Header: React.FC<HeaderProps> = ({ isCheckoutPage = false }) => {
  // [React Query] GET /api/cart → 장바구니 개수 표시
  const { data: cartItems = [] } = useQuery<CartItem[]>({
    queryKey: ['cart'],
    queryFn: fetchCartItems,
  });
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="site-header">
      <div className="header-container">
        {/* 로고 */}
        <Link href="/" className="logo">
          <ShoppingBag className="logo-icon" />
          <span className="logo-text">LUXE MALL</span>
        </Link>

        {!isCheckoutPage ? (
          <>
            {/* 검색바 */}
            <div className="header-search">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="어떤 상품을 찾으시나요?"
                className="search-input"
              />
            </div>

            {/* 네비게이션 & 장바구니 */}
            <nav className="header-nav">
              <Link href="/" className="nav-link">홈</Link>
              <Link href="/checkout" className="cart-button" aria-label="장바구니 / 결제">
                <ShoppingCart className="cart-icon" />
                {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
              </Link>
            </nav>
          </>
        ) : (
          <div className="checkout-step-indicator">
            <span className="step active">1. 주문결제</span>
            <span className="step-arrow">›</span>
            <span className="step">2. 결제완료</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
