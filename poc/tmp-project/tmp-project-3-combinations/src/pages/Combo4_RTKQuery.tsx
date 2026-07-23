import React, { useEffect } from 'react';
import axios from 'axios';
import { useGetTest4Query } from '../api/rtkApi';

export default function Combo4_RTKQuery() {
  useEffect(() => {
    fetch('/api/combo4/fetch');
    axios.get('/api/combo4/axios');
  }, []);

  useGetTest4Query();

  return <div>Combo 4</div>;
}
