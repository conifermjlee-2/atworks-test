import React, { useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useGetTest6Query } from '../api/rtkApi';

export default function Combo6_RQ_RTK() {
  useEffect(() => {
    fetch('/api/combo6/fetch');
    axios.get('/api/combo6/axios');
  }, []);

  useQuery({
    queryKey: ['rq6'],
    queryFn: () => axios.get('/api/combo6/react-query')
  });

  useGetTest6Query();

  return <div>Combo 6</div>;
}
