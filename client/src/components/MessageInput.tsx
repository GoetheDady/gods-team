import { useState, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string, file?: File) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (typingTimer.current) clearTimeout(typingTimer.current);
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
        if (file) addImage(file);
        break;
      }
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) addImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function addImage(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(null);
    setPreview(null);
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingFile) || disabled) return;
    onSend(trimmed, pendingFile || undefined);
    setText('');
    removeImage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  return (
    <div className={styles.container}>
      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="preview" className={styles.previewImg} />
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
          disabled={disabled}
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
        <button className={styles.send} onClick={submit} disabled={disabled || (!text.trim() && !pendingFile)}>
          发送
        </button>
      </div>
    </div>
  );
}
