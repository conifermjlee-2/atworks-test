'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Star, ShoppingBag, Eye } from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import Spinner from '@/components/common/Spinner';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isNavigating, setIsNavigating] = React.useState(false);

  // [시나리오 1 후행 액션: 상품 상세 B 화면으로 이동]
  const handleCardClick = () => {
    setIsNavigating(true);
    router.push(`/products/${product.id}`);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await addToCart(product, 1);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickView) onQuickView(product);
  };

  return (
    <div
      className="product-card"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
      onClick={handleCardClick}
    >
      <div className="card-image-container">
        <img src={product.image} alt={product.name} className="product-image" />
        {product.isNew && <span className="badge new">NEW</span>}
        {product.isBest && <span className="badge best">BEST</span>}

        <div className="card-overlay-actions">
          {onQuickView && (
            <button
              onClick={handleQuickViewClick}
              className="quick-view-btn"
              title="빠른 보기"
            >
              <Eye size={18} />
            </button>
          )}
          <button
            onClick={handleAddToCart}
            className="add-cart-btn"
            title="장바구니 담기"
          >
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>

      <div className="card-content">
        <span className="product-category">{product.category.toUpperCase()}</span>
        <h4 className="product-title">{product.name}</h4>

        <div className="product-rating">
          <Star className="star-icon" size={14} />
          <span className="rating-score">{product.rating}</span>
          <span className="review-count">({product.reviewCount})</span>
        </div>

        <div className="product-price-row">
          <span className="current-price">{product.price.toLocaleString()}원</span>
          {product.originalPrice && (
            <span className="original-price">{product.originalPrice.toLocaleString()}원</span>
          )}
        </div>
      </div>

      {isNavigating && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Spinner size={32} text="이동 중..." />
        </div>
      )}
    </div>
  );
};

export default ProductCard;
