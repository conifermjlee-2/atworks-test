import React, { useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import useSWR from 'swr';
import { useGetTest8Query } from '../api/rtkApi';

export default function Combo8_All() {
  useEffect(() => {
    fetch('/api/combo8/fetch');
    axios.get('/api/combo8/axios');
  }, []);

  useQuery({
    queryKey: ['rq8'],
    queryFn: () => axios.get('/api/combo8/react-query')
  });

  useSWR('/api/combo8/swr', (url: string) => fetch(url).then(r => r.json()));

  useGetTest8Query();

  return <div>Combo 8</div>;
}
