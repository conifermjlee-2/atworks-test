'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ShoppingBag, ArrowRight, FileText } from 'lucide-react';

/**
 * [주문 완료 영수증 페이지 - src/app/order-complete/page.tsx]
 * [시나리오 2 - 3단계 POST /api/checkout 성공 시 라우팅 이동되는 B 화면]
 */
function OrderCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get('orderId') || 'ORD-2026-MOCK';
  const amount = Number(searchParams.get('amount') || '0');
  const itemsCount = searchParams.get('items') || '1';

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

export default function OrderCompletePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>}>
      <OrderCompleteContent />
    </Suspense>
  );
}
