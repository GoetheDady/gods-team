import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { api } from './services/api';
import { getAccessToken, clearTokens } from './services/api';

export default function App() {
  const [auth, setAuth] = useState<{ userId: string; username: string } | null | undefined>(
    undefined
  );

  useEffect(() => {
    // 启动时检查 localStorage 中是否有有效 token
    const token = getAccessToken();
    if (!token) {
      setAuth(null);
      return;
    }
    // 带 Authorization 头验证 token 是否仍然有效
    api.me()
      .then(user => setAuth(user))
      .catch(() => {
        clearTokens();
        setAuth(null);
      });
  }, []);

  if (auth === undefined) return null;

  function handleLogin(userId: string, username: string) {
    setAuth({ userId, username });
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={auth ? <Navigate to="/chat" /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={auth ? <Navigate to="/chat" /> : <Register onLogin={handleLogin} />} />
        <Route path="/chat" element={auth ? <Chat userId={auth.userId} username={auth.username} onLogout={() => setAuth(null)} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={auth ? <Settings /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={auth ? '/chat' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}
