import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // API A 호출: 로그인
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (data.success) {
        // API B 호출: 로그인 성공 후 유저 정보 조회 (A -> B 체이닝)
        const userRes = await fetch(`http://localhost:4000/api/user/${data.userId}`);
        const userData = await userRes.json();
        
        setMessage(`Login successful! Welcome, ${userData.name} (${userData.role})`);
        setTimeout(() => navigate('/'), 1000); // 1초 후 홈페이지로 이동

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
    </div>
  );
}
