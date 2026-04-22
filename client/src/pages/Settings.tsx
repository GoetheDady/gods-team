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
