// Server Component 테스트용
export default async function HomePage() {
  // 서버 컴포넌트 내부에서의 fetch 호출
  const res = await fetch('/next/server-fetch-endpoint', { method: 'POST' });
  const data = await res.json();
  
  return <div>Next.js Server Component {data}</div>;
}
