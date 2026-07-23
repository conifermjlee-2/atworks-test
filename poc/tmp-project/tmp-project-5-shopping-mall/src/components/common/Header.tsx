'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ShoppingCart, Search } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface HeaderProps {
  isCheckoutPage?: boolean;
}

/**
 * [공통 컴포넌트 1: Header - src/components/common/Header.tsx]
 * 사용 위치 1: src/app/layout.tsx (루트 공통 GNB)
 * 사용 위치 2: src/app/checkout/page.tsx (결제 전용 Header)
 */
export const Header: React.FC<HeaderProps> = ({ isCheckoutPage = false }) => {
  const { totalCount, setIsCartOpen } = useCart();

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
              <Link href="/" className="nav-link">
                홈
              </Link>

              <button
                onClick={() => setIsCartOpen(true)}
                className="cart-button"
                aria-label="장바구니 열기"
              >
                <ShoppingCart className="cart-icon" />
                {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
              </button>
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
