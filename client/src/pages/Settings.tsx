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

        {/* 邀请码：生成 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>生成新邀请码</div>
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
        </div>

        {/* 邀请码：列表 */}
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
