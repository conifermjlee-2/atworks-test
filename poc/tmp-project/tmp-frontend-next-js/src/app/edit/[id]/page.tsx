'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';

export default function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${id}`);
        if (res.ok) {
          const data = await res.json();
          setName(data.name || '');
          setPassword(data.password || '');
        } else {
          setError('사용자를 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setFetching(false);
      }
    };
    
    if (id) {
      fetchUser();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) {
      setError('이름과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || '수정 실패');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>사용자 수정</h1>
        <Link href="/" className="btn btn-outline">
          목록으로 돌아가기
        </Link>
      </div>

      <div className="card">
        {fetching ? (
          <div className="empty-state">데이터를 불러오는 중...</div>
        ) : (
          <>
            {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">이름</label>
                <input
                  id="name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">새 비밀번호</label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="변경할 비밀번호를 입력하세요"
                />
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
