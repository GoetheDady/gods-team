import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Avatar from '../components/Avatar';

interface InviteCode {
  code: string;
  created_at: number;
  used_by: string | null;
  used_at: number | null;
}

interface Props {
  onProfileUpdated: (user: {
    userId: string;
    username: string;
    nickname: string | null;
    avatar_url: string | null;
  }) => void;
}

export default function Settings({ onProfileUpdated }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    api.me().then(user => {
      setCurrentUsername(user.username);
      setNickname(user.nickname ?? '');
      setAvatarUrl(user.avatar_url ?? null);
    }).catch(() => {});

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
      const user = await api.me();
      onProfileUpdated(user);
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
      const { url: ossUrl, fields } = await api.getOssSign();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const key = `${fields.key}.${ext}`;

      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => form.append(key, value as string));
      form.set('key', key);
      form.append('file', file);

      const ossRes = await fetch(ossUrl, { method: 'POST', body: form });
      if (!ossRes.ok) throw new Error('上传失败');

      const uploadedUrl = `${ossUrl}/${key}`;
      await api.updateProfile({ avatar_url: uploadedUrl });
      const user = await api.me();
      onProfileUpdated(user);
      setAvatarUrl(uploadedUrl);
      setProfileSuccess('头像已更新');
      setTimeout(() => setProfileSuccess(''), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploadingAvatar(false);
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
  const sectionTitle = 'mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-jianghu-muted';

  return (
    <div className="flex h-full flex-col bg-jianghu-base">
      <header className="flex h-12 items-center gap-4 border-b border-jianghu-border-subtle bg-jianghu-elevated px-6">
        <button className="text-[13px] text-jianghu-secondary transition-colors duration-150 ease-in hover:text-jianghu-gold" onClick={() => navigate('/chat')}>← 返回大厅</button>
        <span className="font-display text-lg text-jianghu-gold">设置</span>
      </header>

      <div className="mx-auto my-10 w-full max-w-[560px] px-6">
        <div className="mb-10">
          <div className={sectionTitle}>个人资料</div>

          <div className="mb-5 flex items-center gap-5">
            <div
              className="group relative shrink-0 cursor-pointer"
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              title="点击更换头像"
            >
              <Avatar src={avatarUrl} name={displayName} size={72} />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-[11px] tracking-[0.5px] text-white/85 opacity-0 transition-opacity duration-150 ease-in group-hover:opacity-100">
                {uploadingAvatar ? '上传中...' : '更换'}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[13px] text-jianghu-text">更换头像</div>
              <div className="text-xs leading-[1.8] text-jianghu-secondary">点击上传图片<br />支持 JPG、PNG<br />建议正方形</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="mb-2 text-[11px] tracking-[0.8px] text-jianghu-secondary">昵称</div>
          <div className="flex gap-2.5">
            <input
              className="flex-1 rounded-lg border border-jianghu-border-subtle bg-jianghu-input px-3.5 py-2.5 text-sm text-jianghu-text outline-none transition duration-150 ease-in placeholder:text-jianghu-muted focus:border-jianghu-gold focus:shadow-[0_0_0_3px_rgba(201,168,76,0.15)]"
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={`设置昵称（当前：${currentUsername}）`}
              maxLength={20}
              onKeyDown={e => e.key === 'Enter' && saveNickname()}
            />
            <button
              className="whitespace-nowrap rounded-lg bg-jianghu-gold px-5 py-2.5 text-[13px] font-bold text-black/75 transition-colors duration-150 ease-in hover:bg-[#d4b25c] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={saveNickname}
              disabled={savingNickname}
            >
              {savingNickname ? '保存中' : '保存'}
            </button>
          </div>
          {profileError && <div className="mt-2 font-mono text-xs text-jianghu-danger">{profileError}</div>}
          {profileSuccess && <div className="mt-2 font-mono text-xs text-[#4caf6a]">{profileSuccess}</div>}
        </div>

        <div className="mb-10">
          <div className={sectionTitle}>生成新邀请码</div>
          <button className="rounded border border-jianghu-border-gold px-6 py-2.5 font-mono text-[13px] text-jianghu-gold transition-colors duration-150 ease-in hover:bg-jianghu-gold-glow disabled:cursor-not-allowed disabled:opacity-50" onClick={generate} disabled={generating}>
            {generating ? '生成中...' : '生成邀请码'}
          </button>
          {inviteError && <div className="mt-2 font-mono text-xs text-jianghu-danger">{inviteError}</div>}
          {newCode && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-jianghu-gold bg-jianghu-elevated px-[18px] py-3.5">
              <span className="font-mono text-xl tracking-[0.2em] text-jianghu-gold">{newCode}</span>
              <button className="rounded border border-jianghu-border-subtle px-2.5 py-1 text-xs text-jianghu-secondary transition-colors duration-150 ease-in hover:border-jianghu-border-gold hover:text-jianghu-text" onClick={() => copyCode(newCode)}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          )}
        </div>

        <div className="mb-10">
          <div className={sectionTitle}>我的邀请码 ({codes.length})</div>
          {codes.length === 0 ? (
            <div className="font-mono text-[13px] text-jianghu-muted">还没有邀请码</div>
          ) : (
            <div className="flex flex-col gap-2">
              {codes.map(item => (
                <div key={item.code} className="flex items-center justify-between rounded-lg border border-jianghu-border-subtle bg-jianghu-elevated px-4 py-3">
                  <span className="font-mono text-[15px] tracking-[0.15em] text-jianghu-text">{item.code}</span>
                  <span className={`rounded-full px-2 py-[3px] font-mono text-[11px] ${item.used_by ? 'bg-jianghu-border-subtle text-jianghu-muted' : 'bg-jianghu-gold-glow text-jianghu-gold'}`}>
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
