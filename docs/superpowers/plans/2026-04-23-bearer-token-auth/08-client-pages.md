### Task 8：更新客户端页面 — App、Login、Register、Chat

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/Login.tsx`
- Modify: `client/src/pages/Register.tsx`
- Modify: `client/src/pages/Chat.tsx`

- [ ] **Step 1：修改 `client/src/App.tsx`**

完整替换：

```typescript
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { api } from './services/api';
import { getAccessToken, clearTokens } from './services/api';

export default function App() {
  const [auth, setAuth] = useState<{ userId: string; username: string } | null | undefined>(
    undefined
  );

  useEffect(() => {
    // 启动时检查 localStorage 中是否有有效 token
    const token = getAccessToken();
    if (!token) {
      setAuth(null);
      return;
    }
    // 带 Authorization 头验证 token 是否仍然有效
    api.me()
      .then(user => setAuth(user))
      .catch(() => {
        clearTokens();
        setAuth(null);
      });
  }, []);

  if (auth === undefined) return null;

  function handleLogin(userId: string, username: string) {
    setAuth({ userId, username });
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={auth ? <Navigate to="/chat" /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={auth ? <Navigate to="/chat" /> : <Register onLogin={handleLogin} />} />
        <Route path="/chat" element={auth ? <Chat userId={auth.userId} username={auth.username} onLogout={() => setAuth(null)} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={auth ? <Settings /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={auth ? '/chat' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}
```

变化：`getAccessToken()` 替代 cookie 验证逻辑。

- [ ] **Step 2：修改 `client/src/pages/Login.tsx`**

将 `handleSubmit` 函数中的：

```typescript
const user = await api.login(username, password);
onLogin(user.userId, user.username);
```

改为：

```typescript
const res = await api.login(username, password);
api.setTokens(res.accessToken, res.refreshToken);
onLogin(res.userId, res.username);
```

需要确保文件顶部有 `import { api } from '../services/api';`（已有）。

- [ ] **Step 3：修改 `client/src/pages/Register.tsx`**

将 `handleSubmit` 函数中的：

```typescript
const user = await api.register(username, password, inviteCode.trim().toUpperCase());
onLogin(user.userId, user.username);
```

改为：

```typescript
const res = await api.register(username, password, inviteCode.trim().toUpperCase());
api.setTokens(res.accessToken, res.refreshToken);
onLogin(res.userId, res.username);
```

- [ ] **Step 4：修改 `client/src/pages/Chat.tsx`**

在 `init()` 函数中，将：

```typescript
const { token } = await api.getToken();
wsClient.connect(token);
```

改为：

```typescript
wsClient.connect();
```

同时删除文件中所有对 `getToken` 的引用。

- [ ] **Step 5：更新 `client/src/pages/Chat.tsx` 中的 handleLogout**

将 `handleLogout` 函数改为：

```typescript
async function handleLogout() {
  await api.logout();
  api.clearTokens();
  onLogout();
  navigate('/login');
}
```

确保导入了 `api.clearTokens`（从 `'../services/api'` 已有 `api` 导入，`clearTokens` 是 `api` 对象上的方法还是独立导出？检查 api.ts — `clearTokens` 是独立导出的函数）。

所以需要在 Chat.tsx 顶部添加：

```typescript
import { api, clearTokens } from '../services/api';
```

然后 logout 中调用：

```typescript
async function handleLogout() {
  await api.logout();
  clearTokens();
  onLogout();
  navigate('/login');
}
```

- [ ] **Step 6：类型检查**

```bash
cd client && npx tsc --noEmit
```

Expected: 无输出（零错误）

- [ ] **Step 7：提交**

```bash
git add client/src/App.tsx client/src/pages/Login.tsx client/src/pages/Register.tsx client/src/pages/Chat.tsx
git commit -m "feat(client): pages use localStorage tokens instead of cookies"
```
