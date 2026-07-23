'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import { fetchCartItems, requestCheckoutApi } from '@/services/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CartItem, ShippingInfo } from '@/types';
import { CreditCard, Lock } from 'lucide-react';

/**
 * [결제 및 주문 작성 페이지 - src/app/checkout/page.tsx]
 * [React Query - useQuery] Axios GET /api/cart (주문할 상품 목록 조회)
 * [React Query - useMutation] Axios POST /api/checkout (모의 결제 처리)
 * [시나리오 2 - 2단계 후행 액션] 약관 동의 클릭 시 <Modal /> 공통 팝업 모달 오픈
 * [시나리오 2 - 3단계 후행 액션] 결제 승인 완료 후 /order-complete 라우팅 이동
 * [공통 컴포넌트 1 사용 위치 2] Header (isCheckoutPage=true)
 * [공통 컴포넌트 2 사용 위치 2] Modal (구매 약관 모달)
 */
export default function CheckoutPage() {
  const router = useRouter();
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: '홍길동',
    phone: '010-1234-5678',
    address: '서울특별시 강남구 테헤란로 123',
    detailAddress: 'atworks 빌딩 5층',
    paymentMethod: 'card',
  });

  // [React Query - useQuery] Axios GET /api/cart → 주문할 상품 목록
  const { data: checkoutItems = [], isLoading: isCartLoading } = useQuery<CartItem[]>({
    queryKey: ['cart'],
    queryFn: fetchCartItems,
  });
  const totalAmount = checkoutItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity, 0
  );

  // [React Query - useMutation] Axios POST /api/checkout
  const checkoutMutation = useMutation({
    mutationFn: () =>
      requestCheckoutApi({ items: checkoutItems, shippingInfo, totalAmount, buyType: 'CART' }),
    onSuccess: (response) => {
      if (response.success) {
        // ⚡ [시나리오 2 - 3단계 후행 액션]: 주문 완료 화면으로 라우팅 이동
        router.push(
          `/order-complete?orderId=${response.orderId}&amount=${response.totalAmount}&items=${response.itemCount}`
        );
      }
    },
    onError: () => {
      alert('결제 승인 처리 중 에러가 발생했습니다.');
    },
  });

  const handleFinalPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutItems.length === 0) {
      alert('결제할 상품이 없습니다.');
      return;
    }
    checkoutMutation.mutate();
  };

  if (isCartLoading) {
    return (
      <div>
        <Header isCheckoutPage={true} />
        <main className="main-container" style={{ textAlign: 'center', padding: '6rem 0' }}>
          <Spinner size={36} text="장바구니 정보를 불러오는 중입니다..." />
        </main>
      </div>
    );
  }

  return (
    <div>
      {/* [공통 컴포넌트 1 사용 위치 2: Header (결제 헤더)] */}
      <Header isCheckoutPage={true} />

      <main className="main-container">
        <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>주문 및 결제 작성</h2>

        <form onSubmit={handleFinalPayment} className="checkout-grid">
          <div>
            <div className="form-section">
              <h3>배송 정보 입력</h3>
              <div className="form-group">
                <label>받는 분 성함</label>
                <input type="text" required value={shippingInfo.name}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                  className="form-input" />
              </div>
              <div className="form-group">
                <label>연락처</label>
                <input type="text" required value={shippingInfo.phone}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                  className="form-input" />
              </div>
              <div className="form-group">
                <label>배송 주소</label>
                <input type="text" required value={shippingInfo.address}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                  className="form-input" style={{ marginBottom: '0.5rem' }} />
                <input type="text" required value={shippingInfo.detailAddress}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, detailAddress: e.target.value })}
                  className="form-input" />
              </div>
            </div>

            <div className="form-section">
              <h3>결제 수단</h3>
              <div className="payment-options">
                {[
                  { id: 'card', name: '신용/체크카드' },
                  { id: 'kakaopay', name: '카카오페이' },
                  { id: 'tosspay', name: '토스페이' },
                  { id: 'bank', name: '무통장입금' },
                ].map((pm) => (
                  <div key={pm.id}
                    onClick={() => setShippingInfo({ ...shippingInfo, paymentMethod: pm.id as any })}
                    className={`payment-option-card ${shippingInfo.paymentMethod === pm.id ? 'selected' : ''}`}>
                    <CreditCard size={18} />
                    <span>{pm.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="form-section" style={{ position: 'sticky', top: '90px' }}>
              <h3>주문 요약</h3>
              <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '1.25rem' }}>
                {checkoutItems.map(({ product, quantity }) => (
                  <div key={product.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <img src={product.image} alt={product.name}
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600 }}>{product.name}</div>
                      <div style={{ color: 'var(--text-sub)' }}>{quantity}개 / {(product.price * quantity).toLocaleString()}원</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700 }}>
                  <span>총 결제금액</span>
                  <span style={{ color: 'var(--accent-color)' }}>{totalAmount.toLocaleString()}원</span>
                </div>
              </div>

              {/* [시나리오 2 - 2단계 후행 액션: 약관 확인 클릭 시 Modal 오픈] */}
              <div style={{ marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                <span>구매 정보 및 결제 약관을 확인하셨습니까? </span>
                <button type="button" onClick={() => setIsTermsModalOpen(true)}
                  style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                  [약관 보기]
                </button>
              </div>

              <button type="submit" disabled={checkoutMutation.isPending}
                className="checkout-btn" style={{ opacity: checkoutMutation.isPending ? 0.7 : 1 }}>
                {checkoutMutation.isPending ? (
                  <Spinner size={18} text="" />
                ) : (
                  <>
                    <Lock size={18} />
                    <span>{`${totalAmount.toLocaleString()}원 결제하기`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {checkoutMutation.isPending && (
          <Spinner fullScreen={true} size={40} text="안전하게 결제 승인을 진행하고 있습니다..." />
        )}

        {/* [공통 컴포넌트 2 사용 위치 2: Modal (구매 약관 모달)] */}
        <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title="전자상거래 구매 이용 약관">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-sub)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '0.8rem' }}>
              <strong>제 1 조 (목적)</strong><br />
              본 약관은 LUXE MALL 전자상거래 서비스를 이용함에 있어 당사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
            <p style={{ marginBottom: '0.8rem' }}>
              <strong>제 2 조 (모의 결제 안내)</strong><br />
              본 결제 시스템은 모의(Mock) 테스트용으로 동작하며, 실제 금액이 청구되지 않습니다.
            </p>
            <button onClick={() => setIsTermsModalOpen(false)} className="checkout-btn"
              style={{ width: '100%', marginTop: '1rem' }}>
              동의 및 닫기
            </button>
          </div>
        </Modal>
      </main>
    </div>
  );
}
