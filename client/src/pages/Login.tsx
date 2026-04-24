import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setTokens } from '../services/api';

interface Props {
  onLogin: (userId: string, username: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(username, password);
      setTokens(res.accessToken, res.refreshToken);
      onLogin(res.userId, res.username);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-jianghu-base before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:h-[600px] before:w-[600px] before:-translate-x-1/2 before:-translate-y-1/2 before:bg-[radial-gradient(circle,rgba(201,168,76,0.15)_0%,transparent_70%)] before:content-['']">
      <div className="relative w-[380px] animate-[fade-slide-up_400ms_ease_forwards] rounded-xl border border-jianghu-border-gold bg-jianghu-elevated px-10 py-12">
        <div className="mb-2 text-center font-display text-[28px] tracking-[0.05em] text-jianghu-gold">江湖聊天室</div>
        <div className="mb-9 text-center font-mono text-xs text-jianghu-secondary">行走江湖，言出必行</div>
        <div className="my-7 h-px bg-jianghu-border-subtle" />
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.08em] text-jianghu-secondary">用户名</label>
            <input
              className="w-full border-b border-jianghu-border-gold py-2.5 text-sm text-jianghu-text transition-colors duration-150 ease-in placeholder:text-jianghu-muted focus:border-jianghu-gold"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
              autoComplete="username"
              required
            />
          </div>
          <div className="mb-5">
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.08em] text-jianghu-secondary">密码</label>
            <input
              className="w-full border-b border-jianghu-border-gold py-2.5 text-sm text-jianghu-text transition-colors duration-150 ease-in placeholder:text-jianghu-muted focus:border-jianghu-gold"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="mt-3 text-center font-mono text-xs text-jianghu-danger">{error}</div>}
          <button className="mt-2 w-full rounded bg-jianghu-gold p-3 font-display text-base tracking-[0.05em] text-[#0f1014] transition duration-150 ease-in hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={loading}>
            {loading ? '登录中...' : '进入江湖'}
          </button>
        </form>
        <div className="mt-6 block text-center text-xs text-jianghu-secondary">
          还没有帐号？<Link className="ml-1 text-jianghu-gold" to="/register">使用邀请码注册</Link>
        </div>
      </div>
    </div>
  );
}
