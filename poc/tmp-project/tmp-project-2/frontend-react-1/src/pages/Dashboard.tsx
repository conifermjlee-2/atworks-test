import React from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { useQuery } from '@tanstack/react-query';
import { useGetRtkEndpointQuery } from '../api/api';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function Dashboard() {
  // 1. RTK Query (URL은 api.ts에 숨어있음)
  useGetRtkEndpointQuery();

  // 2. React Query + Axios 콜백 조합
  useQuery({
    queryKey: ['reactQueryTest'],
    queryFn: () => axios.post('/react/react-query-endpoint', { data: 1 })
  });

  // 3. SWR (첫 번째 인자가 URL)
  useSWR('/react/swr-endpoint', fetcher);

  // 4. 순수 Axios (이벤트 핸들러 내부)
  const handleDelete = () => {
    axios.delete('/react/axios-endpoint');
  };

  return <div onClick={handleDelete}>React Mixed Test Dashboard</div>;
}
