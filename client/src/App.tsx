import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { api } from './services/api';

export default function App() {
  const [auth, setAuth] = useState<{ userId: string; username: string } | null | undefined>(
    undefined
  );

  useEffect(() => {
    api.me()
      .then(user => setAuth(user))
      .catch(() => setAuth(null));
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
        <Route path="/chat" element={auth ? <div>聊天室（待实现）</div> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={auth ? '/chat' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}
