'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';

/**
 * [CartDrawer - 장바구니 Drawer B 화면]
 * [시나리오 1 후행 액션: POST /api/cart 성공 후 나타나는 Drawer 화면]
 * [시나리오 2 후행 액션: '결제하러 가기' 클릭 시 router.push('/checkout') 이동]
 */
export const CartDrawer: React.FC = () => {
  const router = useRouter();
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, totalAmount } =
    useCart();

  if (!isCartOpen) return null;

  // [시나리오 2 후행 액션: /checkout 화면으로 이동]
  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    router.push('/order');
  };

  return (
    <div className="drawer-backdrop" onClick={() => setIsCartOpen(false)}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-row">
            <ShoppingBag size={20} />
            <h3>장바구니 ({cart.reduce((sum, i) => sum + i.quantity, 0)})</h3>
          </div>
          <button onClick={() => setIsCartOpen(false)} className="drawer-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          {cart.length === 0 ? (
            <div className="empty-cart-state">
              <ShoppingBag size={48} className="empty-icon" />
              <p>장바구니가 비어 있습니다.</p>
            </div>
          ) : (
            <div className="cart-item-list">
              {cart.map(({ product, quantity }) => (
                <div key={product.id} className="cart-item-row">
                  <img src={product.image} alt={product.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <h5 className="cart-item-title">{product.name}</h5>
                    <span className="cart-item-price">{product.price.toLocaleString()}원</span>

                    <div className="quantity-controls">
                      <button onClick={() => updateQuantity(product.id, quantity - 1)}>-</button>
                      <span>{quantity}</span>
                      <button onClick={() => updateQuantity(product.id, quantity + 1)}>+</button>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(product.id)}
                    className="item-remove-btn"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="drawer-footer">
            <div className="total-row">
              <span>총 결제 예상 금액</span>
              <strong className="total-price">{totalAmount.toLocaleString()}원</strong>
            </div>

            {/* [시나리오 2 후행 액션 트리거] */}
            <button onClick={handleProceedToCheckout} className="checkout-btn">
              <span>결제하러 가기</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
