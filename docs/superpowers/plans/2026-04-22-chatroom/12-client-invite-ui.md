# Task 12: 邀请码管理页面

**Files:**
- Create: `client/src/pages/Settings.tsx`
- Create: `client/src/pages/Settings.module.css`
- Modify: `client/src/App.tsx`

---

- [ ] **Step 1: 创建 `client/src/pages/Settings.module.css`**

```css
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 48px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.back {
  color: var(--text-secondary);
  font-size: 13px;
  transition: color var(--transition);
}

.back:hover {
  color: var(--gold);
}

.title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold);
}

.content {
  max-width: 560px;
  margin: 40px auto;
  padding: 0 24px;
  width: 100%;
}

.section {
  margin-bottom: 40px;
}

.sectionTitle {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.generateBtn {
  padding: 10px 24px;
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-sm);
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 13px;
  transition: background var(--transition);
}

.generateBtn:hover:not(:disabled) {
  background: var(--gold-glow);
}

.generateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.newCode {
  margin-top: 16px;
  padding: 14px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--gold);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code {
  font-family: var(--font-mono);
  font-size: 20px;
  letter-spacing: 0.2em;
  color: var(--gold);
}

.copyBtn {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  transition: color var(--transition), border-color var(--transition);
}

.copyBtn:hover {
  color: var(--text-primary);
  border-color: var(--border-gold);
}

.codeList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.codeItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.codeValue {
  font-family: var(--font-mono);
  font-size: 15px;
  letter-spacing: 0.15em;
  color: var(--text-primary);
}

.codeStatus {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border-radius: 99px;
}

.codeStatus.unused {
  color: var(--gold);
  background: var(--gold-glow);
}

.codeStatus.used {
  color: var(--text-muted);
  background: var(--border-subtle);
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
  font-family: var(--font-mono);
}

.error {
  color: var(--danger);
  font-size: 12px;
  font-family: var(--font-mono);
  margin-top: 8px;
}
```

- [ ] **Step 2: 创建 `client/src/pages/Settings.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import styles from './Settings.module.css';

interface InviteCode {
  code: string;
  created_at: number;
  used_by: string | null;
  used_at: number | null;
}

export default function Settings() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.myInvites()
      .then(res => setCodes(res.codes))
      .catch(() => setError('加载失败'));
  }, []);

  async function generate() {
    setGenerating(true);
    setError('');
    setNewCode(null);
    try {
      const res = await api.generateInvite();
      setNewCode(res.code);
      setCodes(prev => [
        { code: res.code, created_at: Date.now(), used_by: null, used_at: null },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/chat')}>← 返回大厅</button>
        <span className={styles.title}>邀请码管理</span>
      </header>

      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>生成新邀请码</div>
          <button className={styles.generateBtn} onClick={generate} disabled={generating}>
            {generating ? '生成中...' : '生成邀请码'}
          </button>
          {error && <div className={styles.error}>{error}</div>}
          {newCode && (
            <div className={styles.newCode}>
              <span className={styles.code}>{newCode}</span>
              <button className={styles.copyBtn} onClick={() => copyCode(newCode)}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>我的邀请码 ({codes.length})</div>
          {codes.length === 0 ? (
            <div className={styles.empty}>还没有邀请码</div>
          ) : (
            <div className={styles.codeList}>
              {codes.map(item => (
                <div key={item.code} className={styles.codeItem}>
                  <span className={styles.codeValue}>{item.code}</span>
                  <span className={`${styles.codeStatus} ${item.used_by ? styles.used : styles.unused}`}>
                    {item.used_by ? '已使用' : '未使用'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 注册路由到 `client/src/App.tsx`**

在 `Routes` 中加入（需登录才能访问）：

```typescript
import Settings from './pages/Settings';

// 在 Routes 中添加：
<Route
  path="/settings"
  element={auth ? <Settings /> : <Navigate to="/login" />}
/>
```

- [ ] **Step 4: 验证邀请码页面**

以 alice 登录，点击顶栏"邀请码"按钮跳转到 `/settings`：
- 点击"生成邀请码"，应出现 8 位大写邀请码，带复制按钮
- 点击复制，粘贴验证内容正确
- 列表中显示所有历史邀请码及使用状态
- 点击"返回大厅"跳回 `/chat`

- [ ] **Step 5: 提交**

```bash
git add client/src/pages/Settings.tsx client/src/pages/Settings.module.css client/src/App.tsx
git commit -m "feat: add invite code management settings page"
```
