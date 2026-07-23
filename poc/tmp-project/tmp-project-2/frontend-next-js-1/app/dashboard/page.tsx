'use client';

import React from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { useQuery } from '@tanstack/react-query';
import { useGetRtkNextEndpointQuery } from '../../src/store/api';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NextDashboard() {
  // 1. RTK Query
  useGetRtkNextEndpointQuery();

  // 2. React Query
  useQuery({
    queryKey: ['nextReactQuery'],
    queryFn: () => axios.put('/next/react-query-endpoint')
  });

  // 3. SWR
  useSWR('/next/swr-endpoint', fetcher);

  // 4. 순수 Axios
  const handleClick = () => {
    axios.patch('/next/axios-endpoint');
  };

  return <div onClick={handleClick}>Next.js Client Component (Mixed)</div>;
}
