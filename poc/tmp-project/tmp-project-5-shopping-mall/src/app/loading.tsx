import Spinner from '@/components/common/Spinner';

/**
 * [루트 App Router Instant Loading UI: src/app/loading.tsx]
 */
export default function GlobalLoading() {
  return (
    <main className="main-container" style={{ textAlign: 'center', padding: '8rem 0' }}>
      <Spinner size={42} text="페이지를 불러오는 중입니다..." />
    </main>
  );
}
