import { NextResponse, NextRequest } from 'next/server';
import { CartItem, Product } from '@/types';
import { withLogging } from '@/utils/apiLogger';

export const dynamic = 'force-dynamic';

// Mock in-memory cart database
let mockCart: CartItem[] = [];

/**
 * [공통 API 2-A Handler: GET /api/cart]
 * 장바구니 리스트 조회 (1. 결제 페이지 / 2. 장바구니 드로어)
 */
const getHandler = async (request: NextRequest) => {
  return NextResponse.json(mockCart);
};

/**
 * [공통 API 2-B Handler: POST /api/cart]
 * 장바구니 상품 추가 (제품 상세 페이지 또는 메인 리스트 카드에서 호출)
 */
const postHandler = async (request: NextRequest) => {
  const body = await request.json();
  const { product, quantity = 1 } = body as { product: Product; quantity: number };

  if (!product || !product.id) {
    return NextResponse.json({ error: '유효하지 않은 상품 데이터입니다.' }, { status: 400 });
  }

  const existingIndex = mockCart.findIndex((item) => item.product.id === product.id);
  if (existingIndex > -1) {
    mockCart[existingIndex].quantity += quantity;
  } else {
    mockCart.push({ product, quantity });
  }

  return NextResponse.json({ success: true, cart: mockCart });
};

export const GET = withLogging(getHandler as any);
export const POST = withLogging(postHandler as any);
