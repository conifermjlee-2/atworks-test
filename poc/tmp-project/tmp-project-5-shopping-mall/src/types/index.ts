export interface Product {
  id: string;
  name: string;
  category: 'electronics' | 'fashion' | 'living' | 'beauty';
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  description: string;
  isNew?: boolean;
  isBest?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
  detailAddress: string;
  paymentMethod: 'card' | 'kakaopay' | 'tosspay' | 'bank';
}

export interface CheckoutRequest {
  items: CartItem[];
  shippingInfo: ShippingInfo;
  totalAmount: number;
  buyType?: 'CART' | 'DIRECT';
}

export interface CheckoutResponse {
  success: boolean;
  orderId: string;
  orderDate: string;
  totalAmount: number;
  itemCount: number;
  message: string;
}
