import { useState, KeyboardEvent, ChangeEvent, useRef } from 'react';
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

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping();
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <div className={styles.container}>
      <textarea
        className={styles.input}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
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
