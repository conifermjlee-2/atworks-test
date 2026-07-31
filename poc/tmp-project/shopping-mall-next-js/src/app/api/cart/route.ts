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

const putHandler = async (request: NextRequest) => {
  const body = await request.json();
  const { productId, quantity } = body;

  if (!productId || typeof quantity !== 'number') {
    return NextResponse.json({ error: '잘못된 요청 파라미터입니다.' }, { status: 400 });
  }

  const existingIndex = mockCart.findIndex((item) => item.product.id === productId);
  if (existingIndex > -1) {
    if (quantity <= 0) {
      mockCart.splice(existingIndex, 1);
    } else {
      mockCart[existingIndex].quantity = quantity;
    }
  }

  return NextResponse.json({ success: true, cart: mockCart });
};

const deleteHandler = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (productId) {
    // 특정 상품 삭제
    mockCart = mockCart.filter(item => item.product.id !== productId);
  } else {
    // 장바구니 전체 비우기
    mockCart = [];
  }

  return NextResponse.json({ success: true, cart: mockCart });
};

export const GET = withLogging(getHandler as any);
export const POST = withLogging(postHandler as any);
export const PUT = withLogging(putHandler as any);
export const DELETE = withLogging(deleteHandler as any);
