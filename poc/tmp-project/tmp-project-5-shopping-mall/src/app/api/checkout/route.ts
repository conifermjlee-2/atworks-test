import { NextResponse } from 'next/server';
import { CheckoutRequest, CheckoutResponse } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * [공통 API 3 Handler: POST /api/checkout]
 * 모의 결제 승인 API
 * 1. 결제 페이지 (src/app/checkout/page.tsx) 최종 승인 시 호출
 * 2. 제품 상세 페이지 (src/app/products/[id]/page.tsx) 바로 구매 시 호출
 */
export async function POST(request: Request) {
  const body = (await request.json()) as CheckoutRequest;

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: '결제할 상품이 존재하지 않습니다.' }, { status: 400 });
  }

  const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const orderDate = new Date().toLocaleString('ko-KR');

  const response: CheckoutResponse = {
    success: true,
    orderId,
    orderDate,
    totalAmount: body.totalAmount || 0,
    itemCount: body.items.reduce((acc, cur) => acc + cur.quantity, 0),
    message: '결제가 성공적으로 승인 처리되었습니다.',
  };

  return NextResponse.json(response);
}
