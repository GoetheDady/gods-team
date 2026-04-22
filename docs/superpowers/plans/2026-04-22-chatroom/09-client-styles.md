# Task 09: 全局样式与设计令牌

**Files:**
- Create: `client/src/styles/tokens.css`
- Create: `client/src/styles/global.css`
- Modify: `client/src/main.tsx`

---

美学方向：「数字墨客」。深墨色背景，暖金色主调，典雅宋体感标题，无边框输入框。

- [ ] **Step 1: 创建 `client/src/styles/tokens.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&family=Noto+Sans+SC:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* 颜色 */
  --bg-base: #16181d;
  --bg-elevated: #1c1f26;
  --bg-message: #1e2535;
  --bg-input: #13151a;
  --bg-sidebar: #141619;

  --gold: #c9a84c;
  --gold-dim: #8a6f2e;
  --gold-glow: rgba(201, 168, 76, 0.15);

  --text-primary: #e8e0cc;
  --text-secondary: #8a8070;
  --text-muted: #4a4540;

  --border-gold: rgba(201, 168, 76, 0.3);
  --border-subtle: rgba(255, 255, 255, 0.05);

  --online-dot: #c9a84c;
  --offline-dot: #3a3830;

  --danger: #c0392b;
  --danger-dim: rgba(192, 57, 43, 0.15);

  /* 字体 */
  --font-display: 'ZCOOL XiaoWei', serif;
  --font-body: 'Noto Sans SC', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* 间距 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* 过渡 */
  --transition: 150ms ease;
}
```

- [ ] **Step 2: 创建 `client/src/styles/global.css`**

```css
@import './tokens.css';

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-body);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;

  /* 细腻噪点纹理 */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font-family: var(--font-body);
  font-size: 14px;
  color: inherit;
}

input, textarea {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
}

a {
  color: var(--gold);
  text-decoration: none;
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border-gold);
  border-radius: 2px;
}

/* 通用动画类 */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.animate-in {
  animation: fadeSlideUp 200ms ease forwards;
}
```

- [ ] **Step 3: 在 `client/src/main.tsx` 中引入全局样式**

将 Vite 模板生成的 `main.tsx` 替换为：

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: 验证样式加载**

启动 client，浏览器打开 `http://localhost:5173`，检查：
- 页面背景为深墨色（`#16181d`）
- 开发者工具 Elements 中 `:root` 有 CSS 变量
- 控制台无字体加载错误

- [ ] **Step 5: 提交**

```bash
git add client/src/styles/ client/src/main.tsx
git commit -m "feat: add design tokens and global styles (数字墨客 theme)"
```
