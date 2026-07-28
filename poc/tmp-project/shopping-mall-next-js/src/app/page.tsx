import React from 'react';
import { getProductsServer } from '@/services/serverApi';
import HomeClient from '@/components/HomeClient';

export const revalidate = 60; // ISR: 60초마다 정적 페이지 재생성

/**
 * [메인 홈 페이지 - src/app/page.tsx]
 * 서버 컴포넌트(Server Component)로 동작
 * fetch를 사용하여 상품 목록을 사전에 로드 (SSG / ISR)
 */
export default async function HomePage() {
  // ISR: 60초마다 서버에서 새로운 데이터를 가져와 정적 페이지 업데이트
  const initialProducts = await getProductsServer();

  return (
    <main className="main-container">
      {/* 베너 섹션 */}
      <section style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          NEW SEASON ARRIVALS
        </h1>
        <p style={{ color: 'var(--text-sub)', fontSize: '1rem' }}>
          당신의 라이프스타일을 완성하는 감각적인 컬렉션
        </p>
      </section>

      {/* 클라이언트 컴포넌트: 카테고리 필터링 및 장바구니 담기 상호작용 */}
      <HomeClient initialProducts={initialProducts} />
    </main>
  );
}
