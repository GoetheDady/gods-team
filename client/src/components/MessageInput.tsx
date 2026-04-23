import { useState, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  return (
    <div className={styles.container}>
      <textarea
        ref={textareaRef}
        className={styles.input}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        placeholder={placeholder || '输入消息，Enter 发送，Shift+Enter 换行'}
        disabled={disabled}
        rows={1}
      />
      <button className={styles.send} onClick={submit} disabled={disabled || !text.trim()}>
        发送
      </button>
    </div>
  );
}
