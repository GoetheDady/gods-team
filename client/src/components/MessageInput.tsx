import { useState, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  onSend: (text: string, imageUrl?: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  // pendingImageUrl: OSS 上传完成后的图片 URL，随消息发送
  // preview: 本地 blob URL，仅用于上传期间显示预览
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // 中文输入法组合状态标记
  // 在组合输入期间（拼音输入中）不响应 Enter 键，避免误发消息
  const composing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文本框自动增高，根据内容调整高度
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

  // Enter 发送，Shift+Enter 换行，中文输入法组合中不触发
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !composing.current) {
      e.preventDefault();
      submit();
    }
  }

  // 剪贴板粘贴图片：检测到图片类型直接触发上传
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
    // 重置 input value，确保选择同一文件也能触发 onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // OSS 直传流程：
  // 1. 先显示本地 blob 预览（用户立即看到图片）
  // 2. 调 /api/oss/sign 获取服务端签名
  // 3. 用签名直接 POST 到 OSS（不经过我们的服务器，省带宽）
  // 4. 上传成功后记录 OSS URL，发送消息时附上
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
      // 拼接完整的 OSS 图片 URL
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
    <div className="flex flex-col">
      {preview && (
        <div className="relative block w-fit px-4 pt-2">
          <img src={preview} alt="preview" className="max-h-[120px] max-w-[200px] rounded object-contain" />
          {uploading && <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-xs text-white">上传中...</div>}
          <button className="absolute right-3 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-jianghu-danger text-xs leading-none text-white" onClick={removeImage}><X size={10} strokeWidth={3} /></button>
        </div>
      )}
      <div className="flex items-end gap-3 border-t border-jianghu-border-subtle bg-jianghu-input px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-jianghu-border-gold text-lg text-jianghu-gold transition-colors duration-150 ease-in hover:bg-jianghu-gold-glow disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="发送图片"
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={textareaRef}
          className="max-h-[120px] min-h-9 flex-1 resize-none border-b border-jianghu-border-gold py-2 leading-normal transition-colors duration-150 ease-in placeholder:text-jianghu-muted focus:border-jianghu-gold"
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
          className="shrink-0 rounded bg-jianghu-gold px-[18px] py-2 font-display text-sm text-[#0f1014] transition duration-150 ease-in hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={submit}
          disabled={disabled || uploading || (!text.trim() && !pendingImageUrl)}
        >
          发送
        </button>
      </div>
    </div>
  );
}
