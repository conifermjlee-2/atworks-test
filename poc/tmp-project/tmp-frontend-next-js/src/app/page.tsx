'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type User = {
  id: number;
  name: string;
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    
    try {
      await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user', error);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>사용자 목록</h1>
        <Link href="/create" className="btn btn-primary">
          새 사용자 추가
        </Link>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">불러오는 중...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            등록된 사용자가 없습니다.<br/>새 사용자를 추가해보세요!
          </div>
        ) : (
          <div>
            {users.map(user => (
              <div key={user.id} className="list-item">
                <div className="item-info">
                  <h3>{user.name}</h3>
                  <p>ID: {user.id}</p>
                </div>
                <div className="actions">
                  <Link href={`/edit/${user.id}`} className="btn btn-outline">
                    수정
                  </Link>
                  <button 
                    onClick={() => handleDelete(user.id)} 
                    className="btn btn-danger"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
