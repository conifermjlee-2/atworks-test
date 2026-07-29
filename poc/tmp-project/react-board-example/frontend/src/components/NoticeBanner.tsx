import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NoticeBanner() {
  const { data, error, isLoading } = useSWR('http://localhost:4000/api/notices', fetcher);

  if (isLoading) return <div className="notice-banner" style={{ opacity: 0.7 }}>Loading notices...</div>;
  if (error) return <div>Failed to load notices</div>;

  return (
    <div className="notice-banner">
      <h3>📢 Notices (SWR)</h3>
      <ul>
        {data.map((notice: any) => (
          <li key={notice.id}>{notice.title}</li>
        ))}
      </ul>
    </div>
  );
}
