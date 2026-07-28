import { Product } from '@/types';
import { MOCK_PRODUCTS } from '@/data/products';

/**
 * [서버 컴포넌트 전용 API 클라이언트 - src/services/serverApi.ts]
 * Next.js 빌드 시점(SSG/ISR)에 자체 API(localhost)를 fetch하면 에러가 발생하므로,
 * 실무에서는 Server Component에서 DB나 내부 서비스(Service Layer)를 직접 호출하는 패턴을 모방합니다.
 */

// 1. [SSG / ISR] 상품 목록 가져오기
export async function getProductsServer(options?: { category?: string; search?: string; id?: string }): Promise<Product[]> {
  // 실제 환경에서는 DB 쿼리나 별도 백엔드(예: Spring Boot) 서버로 fetch를 보냅니다.
  let result = [...MOCK_PRODUCTS];

  if (options?.id) {
    result = result.filter((p) => p.id === options.id);
  }
  if (options?.category && options.category !== 'all') {
    result = result.filter((p) => p.category === options.category);
  }
  if (options?.search) {
    const term = options.search.toLowerCase();
    result = result.filter(
      (p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)
    );
  }

  // 통신 지연 모방
  await new Promise((resolve) => setTimeout(resolve, 100));

  return result;
}

// 2. [SSR] 특정 상품 상세 가져오기
export async function getProductByIdServer(id: string): Promise<Product | null> {
  const result = MOCK_PRODUCTS.find((p) => p.id === id);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return result || null;
}
