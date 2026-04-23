### Task 8：Settings 个人资料卡片（头像上传 + 昵称编辑）

**Files:**
- Modify: `client/src/pages/Settings.tsx`
- Modify: `client/src/pages/Settings.module.css`

---

#### Step 1：修改 `client/src/pages/Settings.tsx` — 添加个人资料卡片

完整替换 `client/src/pages/Settings.tsx`：

```typescript
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Avatar from '../components/Avatar';
import styles from './Settings.module.css';

interface InviteCode {
  code: string;
  created_at: number;
  used_by: string | null;
  used_at: number | null;
}

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 邀请码状态
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  // 个人资料状态
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    // 加载当前用户信息
    api.me().then(user => {
      setCurrentUsername(user.username);
      setNickname(user.nickname ?? '');
      setAvatarUrl(user.avatar_url ?? null);
    }).catch(() => {});

    // 加载邀请码
    api.myInvites()
      .then(res => setCodes(res.codes))
      .catch(() => setInviteError('加载失败'));
  }, []);

  async function saveNickname() {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setProfileError('昵称不能为空');
      return;
    }
    if (trimmed.length > 20) {
      setProfileError('昵称不能超过 20 字');
      return;
    }
    setSavingNickname(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await api.updateProfile({ nickname: trimmed });
      setNickname(trimmed);
      setProfileSuccess('昵称已保存');
      setTimeout(() => setProfileSuccess(''), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingNickname(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      // 获取 OSS 签名
      const { url: ossUrl, fields } = await api.getOssSign();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const key = `${fields.key}.${ext}`;

      // 构建 FormData 直传 OSS
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v as string));
      form.set('key', key);
      form.append('file', file);

      const ossRes = await fetch(ossUrl, { method: 'POST', body: form });
      if (!ossRes.ok) throw new Error('上传失败');

      // OSS 直传后拿到完整 URL
      const uploadedUrl = `${ossUrl}${key}`;
      await api.updateProfile({ avatar_url: uploadedUrl });
      setAvatarUrl(uploadedUrl);
      setProfileSuccess('头像已更新');
      setTimeout(() => setProfileSuccess(''), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploadingAvatar(false);
      // 清空 input 以便同一文件可再次触发
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function generate() {
    setGenerating(true);
    setInviteError('');
    setNewCode(null);
    try {
      const res = await api.generateInvite();
      setNewCode(res.code);
      setCodes(prev => [
        { code: res.code, created_at: Date.now(), used_by: null, used_at: null },
        ...prev,
      ]);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const displayName = nickname.trim() || currentUsername;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/chat')}>← 返回大厅</button>
        <span className={styles.title}>设置</span>
      </header>

      <div className={styles.content}>

        {/* 个人资料卡片 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>个人资料</div>

          {/* 头像上传 */}
          <div className={styles.avatarRow}>
            <div
              className={styles.avatarRing}
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              title="点击更换头像"
            >
              <Avatar src={avatarUrl} name={displayName} size={72} />
              <div className={styles.avatarOverlay}>
                {uploadingAvatar ? '上传中...' : '更换'}
              </div>
            </div>
            <div className={styles.avatarHint}>
              <div className={styles.avatarHintTitle}>更换头像</div>
              <div className={styles.avatarHintText}>点击上传图片<br />支持 JPG、PNG<br />建议正方形</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.hiddenInput}
              onChange={handleAvatarChange}
            />
          </div>

          {/* 昵称编辑 */}
          <div className={styles.fieldLabel}>昵称</div>
          <div className={styles.fieldRow}>
            <input
              className={styles.fieldInput}
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={`设置昵称（当前：${currentUsername}）`}
              maxLength={20}
              onKeyDown={e => e.key === 'Enter' && saveNickname()}
            />
            <button
              className={styles.saveBtn}
              onClick={saveNickname}
              disabled={savingNickname}
            >
              {savingNickname ? '保存中' : '保存'}
            </button>
          </div>
          {profileError && <div className={styles.error}>{profileError}</div>}
          {profileSuccess && <div className={styles.success}>{profileSuccess}</div>}
        </div>

        {/* 邀请码卡片 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>邀请码管理</div>
          <button className={styles.generateBtn} onClick={generate} disabled={generating}>
            {generating ? '生成中...' : '生成邀请码'}
          </button>
          {inviteError && <div className={styles.error}>{inviteError}</div>}
          {newCode && (
            <div className={styles.newCode}>
              <span className={styles.code}>{newCode}</span>
              <button className={styles.copyBtn} onClick={() => copyCode(newCode)}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          )}
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

- [ ] 完成上述修改。

---

#### Step 2：修改 `client/src/pages/Settings.module.css` — 添加个人资料相关样式

在现有 `Settings.module.css` 末尾**追加**以下样式（不修改已有样式）：

```css
/* 个人资料卡片 */
.avatarRow {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.avatarRing {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.avatarOverlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.5px;
  opacity: 0;
  transition: opacity var(--transition);
}

.avatarRing:hover .avatarOverlay {
  opacity: 1;
}

.avatarHint {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.avatarHintTitle {
  font-size: 13px;
  color: var(--text-primary);
}

.avatarHintText {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.hiddenInput {
  display: none;
}

.fieldLabel {
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.8px;
  margin-bottom: 8px;
}

.fieldRow {
  display: flex;
  gap: 10px;
}

.fieldInput {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font-body);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.fieldInput:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-glow);
}

.fieldInput::placeholder {
  color: var(--text-muted);
}

.saveBtn {
  padding: 10px 20px;
  background: var(--gold);
  color: rgba(0, 0, 0, 0.75);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 700;
  transition: background var(--transition);
  white-space: nowrap;
}

.saveBtn:hover:not(:disabled) {
  background: #d4b25c;
}

.saveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success {
  color: #4caf6a;
  font-size: 12px;
  font-family: var(--font-mono);
  margin-top: 8px;
}
```

- [ ] 完成上述修改。

---

#### Step 3：类型检查

```bash
cd client && npx tsc --noEmit
```

Expected: 无错误

- [ ] 完成。

---

#### Step 4：提交

```bash
git add client/src/pages/Settings.tsx client/src/pages/Settings.module.css
git commit -m "feat(client): Settings page adds profile card with avatar upload and nickname edit"
```

- [ ] 完成。
