import { useState, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { api } from '../services/api';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string, imageUrl?: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const composing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize();
    onTyping();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !composing.current) {
      e.preventDefault();
      submit();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        break;
      }
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadImage(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setPendingImageUrl(null);
    setUploading(true);
    try {
      const { url, fields } = await api.getOssSign();
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);
      const ossRes = await fetch(url, { method: 'POST', body: form });
      if (!ossRes.ok) throw new Error('OSS 上传失败');
      setPendingImageUrl(`${url}/${fields.key}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
      removeImage();
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);
    setPendingImageUrl(null);
    setPreview(null);
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImageUrl) || disabled || uploading) return;
    onSend(trimmed, pendingImageUrl || undefined);
    setText('');
    removeImage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  return (
    <div className={styles.container}>
      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="preview" className={styles.previewImg} />
          {uploading && <div className={styles.uploadingOverlay}>上传中...</div>}
          <button className={styles.removeBtn} onClick={removeImage}><X size={10} strokeWidth={3} /></button>
        </div>
      )}
      <div className={styles.row}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          onChange={handleFileSelect}
        />
        <button
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="发送图片"
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          placeholder={placeholder || '输入消息，Enter 发送，Shift+Enter 换行'}
          disabled={disabled}
          rows={1}
        />
        <button
          className={styles.send}
          onClick={submit}
          disabled={disabled || uploading || (!text.trim() && !pendingImageUrl)}
        >
          发送
        </button>
      </div>
    </div>
  );
}
