# Task 10: 登录与注册页面

**Files:**
- Create: `client/src/pages/Login.tsx`
- Create: `client/src/pages/Register.tsx`
- Create: `client/src/pages/Login.module.css`
- Create: `client/src/pages/Register.module.css`
- Modify: `client/src/App.tsx`

---

- [ ] **Step 1: 安装 React Router**

```bash
cd client && npm install react-router-dom
```

- [ ] **Step 2: 创建 `client/src/pages/Login.module.css`**

```css
.page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  position: relative;
  overflow: hidden;
}

/* 背景光晕 */
.page::before {
  content: '';
  position: absolute;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--gold-glow) 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.card {
  position: relative;
  width: 380px;
  padding: 48px 40px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  animation: fadeSlideUp 400ms ease forwards;
}

.logo {
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--gold);
  text-align: center;
  margin-bottom: 8px;
  letter-spacing: 0.05em;
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 36px;
  font-family: var(--font-mono);
}

.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 28px 0;
}

.field {
  margin-bottom: 20px;
}

.label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.input {
  width: 100%;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-gold);
  transition: border-color var(--transition);
  font-size: 14px;
  color: var(--text-primary);
}

.input:focus {
  border-color: var(--gold);
}

.input::placeholder {
  color: var(--text-muted);
}

.btn {
  width: 100%;
  padding: 12px;
  background: var(--gold);
  color: #0f1014;
  font-family: var(--font-display);
  font-size: 16px;
  border-radius: var(--radius-sm);
  transition: opacity var(--transition), transform var(--transition);
  margin-top: 8px;
  letter-spacing: 0.05em;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  font-size: 12px;
  color: var(--danger);
  margin-top: 12px;
  text-align: center;
  font-family: var(--font-mono);
}

.link {
  display: block;
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-secondary);
}

.link a {
  color: var(--gold);
  margin-left: 4px;
}
```

- [ ] **Step 3: 创建 `client/src/pages/Login.tsx`**

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import styles from './Login.module.css';

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
      const user = await api.login(username, password);
      onLogin(user.userId, user.username);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>江湖聊天室</div>
        <div className={styles.subtitle}>行走江湖，言出必行</div>
        <div className={styles.divider} />
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>用户名</label>
            <input
              className={styles.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
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
              placeholder="输入密码"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? '登录中...' : '进入江湖'}
          </button>
        </form>
        <div className={styles.link}>
          还没有帐号？<Link to="/register">使用邀请码注册</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 复制样式文件用于注册页**

```bash
cp client/src/pages/Login.module.css client/src/pages/Register.module.css
```

- [ ] **Step 5: 创建 `client/src/pages/Register.tsx`**

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
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
      const user = await api.register(username, password, inviteCode.trim().toUpperCase());
      onLogin(user.userId, user.username);
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
              placeholder="8位邀请码"
              maxLength={8}
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
```

- [ ] **Step 6: 更新 `client/src/App.tsx` 添加路由**

```typescript
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { api } from './services/api';

export default function App() {
  const [auth, setAuth] = useState<{ userId: string; username: string } | null | undefined>(
    undefined // undefined = loading
  );

  useEffect(() => {
    api.me()
      .then(user => setAuth(user))
      .catch(() => setAuth(null));
  }, []);

  if (auth === undefined) return null; // 加载中

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
```

- [ ] **Step 7: 验证登录注册流程**

访问 `http://localhost:5173`，应跳转到 `/login`，页面显示深色卡片。

使用 alice / pass123 登录，期望跳转到 `/chat`，显示"聊天室（待实现）"。

退出后访问 `/register`，使用 alice 的邀请码注册 charlie，期望成功跳转到 `/chat`。

- [ ] **Step 8: 提交**

```bash
git add client/src/pages/ client/src/App.tsx
git commit -m "feat: add login and register pages with routing"
```
