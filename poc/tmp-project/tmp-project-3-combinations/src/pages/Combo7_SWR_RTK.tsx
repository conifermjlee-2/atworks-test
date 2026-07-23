import React, { useEffect } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { useGetTest7Query } from '../api/rtkApi';

export default function Combo7_SWR_RTK() {
  useEffect(() => {
    fetch('/api/combo7/fetch');
    axios.get('/api/combo7/axios');
  }, []);

  useSWR('/api/combo7/swr', (url: string) => fetch(url).then(r => r.json()));

  useGetTest7Query();

  return <div>Combo 7</div>;
}
