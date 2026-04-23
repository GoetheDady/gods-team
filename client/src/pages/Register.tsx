import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setTokens } from '../services/api';
import styles from './Register.module.css';

interface Props {
  onLogin: (userId: string, username: string) => void;
}

export default function Register({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.register(username, password, inviteCode.trim().toUpperCase());
      setTokens(res.accessToken, res.refreshToken);
      onLogin(res.userId, res.username);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>加入江湖</div>
        <div className={styles.subtitle}>持邀请码方可入门</div>
        <div className={styles.divider} />
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>邀请码</label>
            <input
              className={styles.input}
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="邀请码"
              maxLength={16}
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>用户名</label>
            <input
              className={styles.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="起个江湖名号"
              autoComplete="username"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>密码</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="设置密码"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? '注册中...' : '拜入门下'}
          </button>
        </form>
        <div className={styles.link}>
          已有帐号？<Link to="/login">直接登录</Link>
        </div>
      </div>
    </div>
  );
}
