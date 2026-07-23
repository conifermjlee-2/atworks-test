import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '@/context/CartContext';
import Header from '@/components/common/Header';
import CartDrawer from '@/components/CartDrawer';

export const metadata: Metadata = {
  title: 'LUXE MALL - 프리미엄 미니 쇼핑몰',
  description: 'Next.js App Router 기반의 미니 쇼핑몰 애플리케이션',
};

/**
 * [루트 레이아웃 - src/app/layout.tsx]
 * [공통 컴포넌트 1: Header] 전체 공유 상단 네비게이션 사용 위치 1
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <CartProvider>
          {/* [공통 컴포넌트 1 사용 위치 1: Header] */}
          <Header />

          {/* 메인 콘텐츠 영역 */}
          {children}

          {/* 장바구니 Drawer 사이드바 B 화면 */}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
