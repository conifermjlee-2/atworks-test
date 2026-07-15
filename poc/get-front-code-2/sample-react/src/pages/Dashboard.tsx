import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import useSWR from 'swr';
import Sentry from '@sentry/browser';

const api = axios.create({ baseURL: '/api/v1' });

export function Dashboard({ userId }: { userId: string }) {
  const [data, setData] = useState();

  useEffect(() => {
    // 1. 일반 axios GET 호출 (템플릿 리터럴)
    axios.get(`/users/${userId}/profile`).then(r => setData(r.data));

    // 2. fetch POST 호출
    fetch('/logs/view', { method: 'POST', body: '...' });

    // 3. 커스텀 axios 인스턴스 (api.*) 호출
    api.get('/stats');

    // 4. 노이즈 (False Positive) - 필터링 되어야 함
    Sentry.init();
    console.log('hello');
  }, []);

  // 5. React Query 인라인 호출 패턴
  useQuery({
    queryKey: ['/reports'],
    queryFn: () => axios.get('/reports')
  });

  // 6. SWR 전역 fetcher 패턴 (첫 번째 인자가 URL)
  useSWR(['/notifications', userId]);

  return <div>Dashboard</div>;
}
