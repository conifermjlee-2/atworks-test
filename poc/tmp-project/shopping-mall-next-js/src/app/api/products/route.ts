import { NextResponse } from 'next/server';
import { MOCK_PRODUCTS } from '@/data/products';

export const dynamic = 'force-dynamic';

/**
 * [공통 API 1 Handler: GET /api/products]
 * 1. 메인 홈 (page.tsx) 전체 상품 조회
 * 2. 제품 상세 (products/[id]/page.tsx) 해당 ID 상품 조회 및 연관 상품 추천 조회
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const id = searchParams.get('id');

  let result = [...MOCK_PRODUCTS];

  // 단일 상품 상세 조회
  if (id) {
    result = result.filter((p) => p.id === id);
    return NextResponse.json(result);
  }

  // 카테고리 필터링
  if (category && category !== 'all') {
    result = result.filter((p) => p.category === category);
  }

  // 검색어 필터링
  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)
    );
  }

  return NextResponse.json(result);
}
