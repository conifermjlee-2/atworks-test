import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ShoppingBag } from 'lucide-react';

export const dynamic = 'force-dynamic'; // SSR: 매 요청마다 서버에서 렌더링

/**
 * [주문 완료 영수증 페이지 - src/app/order-complete/page.tsx]
 * 서버 컴포넌트(Server Component)로 동작 (SSR)
 * 클라이언트 훅(useSearchParams) 대신 page props인 searchParams를 사용하여 SSR 구현
 */
export default async function OrderCompletePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // SSR 환경에서는 await searchParams를 사용해야 하는 경우가 있습니다 (Next.js 15+ 권장 사항)
  const awaitedParams = await searchParams;

  const orderId = (awaitedParams?.orderId as string) || 'ORD-2026-MOCK';
  const amount = Number(awaitedParams?.amount || '0');
  const itemsCount = (awaitedParams?.items as string) || '1';

  return (
    <main className="main-container">
      <div className="order-complete-card">
        <div className="success-icon-badge">
          <CheckCircle2 size={40} />
        </div>

        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>주문 결제가 완료되었습니다!</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
          고객님의 주문이 정상적으로 수신되었습니다. 곧 배송이 시작됩니다.
        </p>

        {/* 영수증 정보 내역 */}
        <div className="receipt-box">
          <div className="receipt-row">
            <span style={{ color: 'var(--text-sub)' }}>주문 번호</span>
            <strong style={{ color: 'var(--accent-color)' }}>{orderId}</strong>
          </div>
          <div className="receipt-row">
            <span style={{ color: 'var(--text-sub)' }}>결제 일시</span>
            {/* SSR에서 하이드레이션 에러를 방지하기 위해 날짜를 하드코딩하거나 클라이언트 컴포넌트 분리가 필요하지만, POC이므로 고정된 포맷 사용 */}
            <span>{new Date().toLocaleDateString('ko-KR')}</span>
          </div>
          <div className="receipt-row">
            <span style={{ color: 'var(--text-sub)' }}>주문 상품 수량</span>
            <span>총 {itemsCount}개</span>
          </div>
          <div className="receipt-row">
            <span style={{ color: 'var(--text-sub)' }}>최종 결제 금액</span>
            <strong style={{ fontSize: '1.1rem' }}>{amount.toLocaleString()}원</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <Link href="/" style={{ flex: 1 }}>
            <button className="checkout-btn" style={{ width: '100%' }}>
              <ShoppingBag size={18} />
              <span>쇼핑 계속하기</span>
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
