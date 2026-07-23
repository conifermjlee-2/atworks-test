import React, { useEffect } from 'react';
import axios from 'axios';

export default function Combo1_Base() {
  useEffect(() => {
    fetch('/api/base/fetch');
    axios.get('/api/base/axios');
  }, []);

  return <div>Combo 1</div>;
}
