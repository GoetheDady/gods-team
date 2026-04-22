# Task 17: 浏览器功能测试 - 注册与登录流程

**工具：** Chrome DevTools MCP（真实浏览器交互）  
**前提：** 服务端已启动（`npm run dev` in server/），前端已启动（`npm run dev` in client/）  
**前提：** 数据库中已有初始邀请码 `ADMIN0001`

---

这组测试通过 Chrome DevTools MCP 在真实浏览器中操作 UI，验证完整用户流程。

## 测试执行方式

每个测试用例按以下步骤执行：
1. 用 `navigate_page` 打开目标页面
2. 用 `fill` / `click` 操作表单
3. 用 `take_screenshot` 或 `evaluate_script` 验证结果

---

## 测试用例 F-01：使用有效邀请码注册

**前置条件：** 数据库中存在未使用的邀请码  
**步骤：**
1. 打开 `http://localhost:5173/register`
2. 在邀请码输入框填入 `ADMIN0001`
3. 在用户名输入框填入 `testuser`
4. 在密码输入框填入 `testpass123`
5. 点击"拜入门下"按钮
6. 等待页面跳转

**期望结果：**
- 页面跳转到 `/chat`
- 顶栏显示用户名 `testuser`
- 无错误提示

**Chrome DevTools 执行命令：**
```
navigate_page(url="http://localhost:5173/register")
fill(selector="input[placeholder='8位邀请码']", value="ADMIN0001")
fill(selector="input[placeholder='起个江湖名号']", value="testuser")
fill(selector="input[type='password']", value="testpass123")
click(selector="button[type='submit']")
wait_for(selector=".logo", timeout=3000)
take_screenshot()
evaluate_script(script="window.location.pathname")
// 期望: "/chat"
```

---

## 测试用例 F-02：使用已用邀请码注册失败

**前置条件：** `ADMIN0001` 已在 F-01 中被使用  
**步骤：**
1. 打开 `http://localhost:5173/register`
2. 填入邀请码 `ADMIN0001`、用户名 `another`、密码 `pass123`
3. 点击提交

**期望结果：**
- 页面不跳转，停留在 `/register`
- 显示错误提示，包含"already used"或类似文字

**Chrome DevTools 执行命令：**
```
navigate_page(url="http://localhost:5173/register")
fill(selector="input[placeholder='8位邀请码']", value="ADMIN0001")
fill(selector="input[placeholder='起个江湖名号']", value="another")
fill(selector="input[type='password']", value="pass123")
click(selector="button[type='submit']")
wait_for(selector="[class*='error']", timeout=2000)
evaluate_script(script="document.querySelector('[class*=error]').textContent")
// 期望: 含 "already used" 或 "已使用"
```

---

## 测试用例 F-03：正常登录

**前置条件：** `testuser` 已在 F-01 中注册  
**步骤：**
1. 打开 `http://localhost:5173/login`
2. 填入用户名 `testuser`，密码 `testpass123`
3. 点击"进入江湖"

**期望结果：**
- 跳转到 `/chat`
- 顶栏显示 `testuser`

**Chrome DevTools 执行命令：**
```
navigate_page(url="http://localhost:5173/login")
fill(selector="input[autocomplete='username']", value="testuser")
fill(selector="input[type='password']", value="testpass123")
click(selector="button[type='submit']")
wait_for(selector="[class*='logo']", timeout=3000)
evaluate_script(script="window.location.pathname")
// 期望: "/chat"
```

---

## 测试用例 F-04：密码错误登录失败

**步骤：**
1. 打开 `http://localhost:5173/login`
2. 填入用户名 `testuser`，密码 `wrongpass`
3. 点击提交

**期望结果：**
- 停留在 `/login`
- 显示错误提示

**Chrome DevTools 执行命令：**
```
navigate_page(url="http://localhost:5173/login")
fill(selector="input[autocomplete='username']", value="testuser")
fill(selector="input[type='password']", value="wrongpass")
click(selector="button[type='submit']")
wait_for(selector="[class*='error']", timeout=2000)
evaluate_script(script="window.location.pathname")
// 期望: "/login"
```

---

## 测试用例 F-05：已登录用户访问 /login 自动跳转到 /chat

**前置条件：** 已登录  
**步骤：**
1. 登录后直接访问 `http://localhost:5173/login`

**期望结果：**
- 自动重定向到 `/chat`

**Chrome DevTools 执行命令：**
```
// 先登录
navigate_page(url="http://localhost:5173/login")
fill(selector="input[autocomplete='username']", value="testuser")
fill(selector="input[type='password']", value="testpass123")
click(selector="button[type='submit']")
wait_for(selector="[class*='logo']", timeout=3000)

// 再访问 login
navigate_page(url="http://localhost:5173/login")
wait_for(timeout=500)
evaluate_script(script="window.location.pathname")
// 期望: "/chat"
```

---

## 测试用例 F-06：登出后无法访问 /chat

**步骤：**
1. 登录后点击"退出"按钮
2. 直接访问 `http://localhost:5173/chat`

**期望结果：**
- 重定向到 `/login`

**Chrome DevTools 执行命令：**
```
// 先登录
navigate_page(url="http://localhost:5173/login")
fill(selector="input[autocomplete='username']", value="testuser")
fill(selector="input[type='password']", value="testpass123")
click(selector="button[type='submit']")
wait_for(selector="[class*='logoutBtn']", timeout=3000)

// 点击退出
click(selector="[class*='logoutBtn']")
wait_for(timeout=500)

// 访问 chat
navigate_page(url="http://localhost:5173/chat")
wait_for(timeout=500)
evaluate_script(script="window.location.pathname")
// 期望: "/login"
```
