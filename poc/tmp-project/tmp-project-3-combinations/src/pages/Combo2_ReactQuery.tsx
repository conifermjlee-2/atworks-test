import React, { useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

export default function Combo2_ReactQuery() {
  useEffect(() => {
    fetch('/api/combo2/fetch');
    axios.get('/api/combo2/axios');
  }, []);

  useQuery({
    queryKey: ['rq2'],
    queryFn: () => axios.get('/api/combo2/react-query')
  });

  return <div>Combo 2</div>;
}
