import axios from 'axios';
import { useState } from 'react';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    
    // Fake FormData for mock
    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatus('Uploading...');
      const { data } = await axios.post('http://localhost:4000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setStatus(data.message);
    } catch (err) {
      setStatus('Upload failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '15px' }}>☁️ File Upload (Pure Axios)</h3>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="input-field" style={{ padding: '8px' }} />
        <button onClick={handleUpload} className="btn" style={{ background: '#4f46e5' }}>Upload</button>
      </div>
      {status && <p style={{ fontSize: '13px', color: status.includes('failed') ? 'var(--danger)' : 'var(--success)' }}>{status}</p>}
    </div>
  );
}
