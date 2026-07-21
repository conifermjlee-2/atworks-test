import React, { useEffect } from 'react';
import axios from 'axios';
import useSWR from 'swr';

export default function Combo3_SWR() {
  useEffect(() => {
    fetch('/api/combo3/fetch');
    axios.get('/api/combo3/axios');
  }, []);

  useSWR('/api/combo3/swr', (url: string) => fetch(url).then(r => r.json()));

  return <div>Combo 3</div>;
}
