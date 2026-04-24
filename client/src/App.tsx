import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { api } from './services/api';
import { getAccessToken, getRefreshToken, refreshTokens, clearTokens } from './services/api';

export default function App() {
  type AuthUser = {
    userId: string;
    username: string;
    nickname: string | null;
    avatar_url: string | null;
  };

  const [auth, setAuth] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // 启动时检查 localStorage 中是否有有效 token
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    if (!accessToken && !refreshToken) {
      // setAuth in an async path below, but this sync branch must also set null
      Promise.resolve().then(() => setAuth(null));
      return;
    }

    async function restoreAuth() {
      try {
        setAuth(await api.me());
      } catch {
        if (!refreshToken || !(await refreshTokens())) {
          clearTokens();
          setAuth(null);
          return;
        }
        try {
          setAuth(await api.me());
        } catch {
          clearTokens();
          setAuth(null);
        }
      }
    }

    restoreAuth();
  }, []);

  if (auth === undefined) return null;

  function handleLogin(userId: string, username: string) {
    api.me()
      .then(user => setAuth(user))
      .catch(() => setAuth({ userId, username, nickname: null, avatar_url: null }));
  }

  function handleProfileUpdated(user: AuthUser) {
    setAuth(user);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={auth ? <Navigate to="/chat" /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={auth ? <Navigate to="/chat" /> : <Register onLogin={handleLogin} />} />
        <Route path="/chat" element={auth ? <Chat userId={auth.userId} username={auth.username} nickname={auth.nickname} avatarUrl={auth.avatar_url} onLogout={() => setAuth(null)} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={auth ? <Settings onProfileUpdated={handleProfileUpdated} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={auth ? '/chat' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}
