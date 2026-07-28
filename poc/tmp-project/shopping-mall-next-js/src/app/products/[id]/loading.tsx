import Spinner from '@/components/common/Spinner';

/**
 * [Next.js App Router 표준 Instant Loading UI: src/app/products/[id]/loading.tsx]
 * 메인에서 /products/[id] 페이지로 이동하는 즉시 렌더링되는 전용 로딩 스피너 UI
 */
export default function Loading() {
  return (
    <main className="main-container" style={{ textAlign: 'center', padding: '8rem 0' }}>
      <Spinner size={42} text="상품 상세 페이지를 로딩 중입니다..." />
    </main>
  );
}
