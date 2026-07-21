import React, { useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import useSWR from 'swr';

export default function Combo5_RQ_SWR() {
  useEffect(() => {
    fetch('/api/combo5/fetch');
    axios.get('/api/combo5/axios');
  }, []);

  useQuery({
    queryKey: ['rq5'],
    queryFn: () => axios.get('/api/combo5/react-query')
  });

  useSWR('/api/combo5/swr', (url: string) => fetch(url).then(r => r.json()));

  return <div>Combo 5</div>;
}
