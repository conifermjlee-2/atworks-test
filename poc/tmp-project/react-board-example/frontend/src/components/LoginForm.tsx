import { useState } from 'react';
import FileUpload from './FileUpload';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Login successful!');
      } else {
        setMessage('Login failed: ' + data.message);
      }
    } catch (err) {
      setMessage('Error connecting to server');
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ marginBottom: '20px' }}>🔐 Login (Pure Fetch)</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input type="text" placeholder="Username (admin)" value={username} onChange={e => setUsername(e.target.value)} className="input-field" />
        <input type="password" placeholder="Password (admin)" value={password} onChange={e => setPassword(e.target.value)} className="input-field" />
        <button type="submit" className="btn" style={{ padding: '12px' }}>Login</button>
      </form>
      {message && <p style={{ marginTop: '16px', color: message.includes('failed') ? 'var(--danger)' : 'var(--success)' }}>{message}</p>}

      <hr style={{ margin: '30px 0', border: 'none', borderBottom: '1px solid var(--border-color)' }} />
      <FileUpload />
    </div>
  );
}
