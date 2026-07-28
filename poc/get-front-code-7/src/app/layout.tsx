import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '프론트엔드 API 시나리오 분석기 v7',
  description: 'React/Next.js 프로젝트를 정적 분석(AST)하고 LLM을 활용하여 비즈니스 시나리오를 자동 생성합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
