# Task 18: 浏览器功能测试 - 聊天与 E2EE

**工具：** Chrome DevTools MCP（真实浏览器，两个页面模拟两个用户）  
**前提：** 服务端和前端均已启动，alice 和 bob 均已注册

---

## 测试用例 F-07：大厅消息 E2EE 传输

**验证：** alice 发送的大厅消息，bob 能正确接收并解密显示

**步骤：**
1. 页面 A 以 alice 登录
2. 页面 B 以 bob 登录（新页面，模拟不同用户）
3. alice 在大厅输入框发送消息
4. 验证 bob 页面收到明文消息（非密文）

**Chrome DevTools 执行命令：**
```
// 页面 A：alice 登录
new_page()  // → page_id_alice
navigate_page(page_id=page_id_alice, url="http://localhost:5173/login")
fill(page_id=page_id_alice, selector="input[autocomplete='username']", value="alice")
fill(page_id=page_id_alice, selector="input[type='password']", value="pass123")
click(page_id=page_id_alice, selector="button[type='submit']")
wait_for(page_id=page_id_alice, selector="[class*='main']", timeout=5000)

// 页面 B：bob 登录
new_page()  // → page_id_bob
navigate_page(page_id=page_id_bob, url="http://localhost:5173/login")
fill(page_id=page_id_bob, selector="input[autocomplete='username']", value="bob")
fill(page_id=page_id_bob, selector="input[type='password']", value="pass456")
click(page_id=page_id_bob, selector="button[type='submit']")
wait_for(page_id=page_id_bob, selector="[class*='main']", timeout=5000)

// 等待 E2EE 密钥协商完成（输入框从"建立加密连接"变为可用）
wait_for(page_id=page_id_alice, selector="textarea:not([disabled])", timeout=5000)

// alice 发送消息
fill(page_id=page_id_alice, selector="textarea", value="江湖再见，bob！")
click(page_id=page_id_alice, selector="[class*='send']")

// 等待 bob 收到消息
wait_for(page_id=page_id_bob, selector="[class*='bubble']", timeout=5000)

// 验证 bob 看到的消息内容是明文
evaluate_script(
  page_id=page_id_bob,
  script="[...document.querySelectorAll('[class*=bubble]')].at(-1).textContent"
)
// 期望: "江湖再见，bob！"（明文，非 Base64 密文）
```

---

## 测试用例 F-08：服务端无法看到消息明文

**验证：** WebSocket 中继的消息是密文，服务端日志不含明文

**步骤：**
1. 监听服务端 WebSocket 日志
2. alice 发送消息
3. 检查 WebSocket 请求 payload

**Chrome DevTools 执行命令：**
```
// 在 alice 页面监控网络请求
get_network_request(page_id=page_id_alice, url_filter="ws://")

// alice 发送消息
fill(page_id=page_id_alice, selector="textarea", value="隐秘内容")
click(page_id=page_id_alice, selector="[class*='send']")

// 查看 WebSocket 帧内容
list_network_requests(page_id=page_id_alice)
// 期望：WebSocket 帧中 payload 包含 ciphertext 和 iv 字段
// 期望：payload 中不含明文 "隐秘内容"
```

---

## 测试用例 F-09：私聊消息 E2EE 传输

**验证：** alice 点击 bob 发起私聊，消息 E2EE 加密传输

**步骤：**
1. alice 和 bob 均已登录（复用 F-07 的页面）
2. alice 点击在线用户列表中的 bob
3. alice 在右侧私聊面板发送消息
4. bob 的私聊面板收到消息

**Chrome DevTools 执行命令：**
```
// alice 点击 bob 的用户名
click(page_id=page_id_alice, selector="[class*='user']:not([class*='self'])")

// 等待私聊面板出现 bob 的名字
wait_for(page_id=page_id_alice, selector="[class*='peerName']", timeout=2000)

// alice 在私聊输入框发送消息
fill(page_id=page_id_alice, selector="[class*='private'] textarea", value="私信你，bob")
click(page_id=page_id_alice, selector="[class*='private'] [class*='send']")

// bob 点击 alice 发起私聊，应能看到消息
click(page_id=page_id_bob, selector="[class*='user']:not([class*='self'])")
wait_for(page_id=page_id_bob, selector="[class*='peerName']", timeout=2000)
wait_for(page_id=page_id_bob, selector="[class*='private'] [class*='bubble']", timeout=5000)

evaluate_script(
  page_id=page_id_bob,
  script="[...document.querySelectorAll('[class*=private] [class*=bubble]')].at(-1)?.textContent"
)
// 期望: "私信你，bob"
```

---

## 测试用例 F-10：消息历史本地持久化

**验证：** 刷新页面后，历史消息从本地 SQLite 恢复，无需向服务端请求

**步骤：**
1. alice 登录并发送大厅消息
2. 刷新 alice 的页面
3. 验证历史消息仍然显示

**Chrome DevTools 执行命令：**
```
// alice 发送消息（复用已登录的页面）
fill(page_id=page_id_alice, selector="textarea", value="刷新前的消息")
click(page_id=page_id_alice, selector="[class*='send']")
wait_for(page_id=page_id_alice, selector="[class*='bubble']", timeout=3000)

// 记录消息数量
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelectorAll('[class*=bubble]').length"
)  // → count_before

// 刷新页面
navigate_page(page_id=page_id_alice, url="http://localhost:5173/chat")
wait_for(page_id=page_id_alice, selector="[class*='main']", timeout=5000)
wait_for(page_id=page_id_alice, timeout=1000)  // 等待本地 DB 加载

// 验证历史消息仍存在
evaluate_script(
  page_id=page_id_alice,
  script="[...document.querySelectorAll('[class*=bubble]')].map(b => b.textContent)"
)
// 期望：包含 "刷新前的消息"

// 监控网络请求，确认没有向服务端请求消息历史
list_network_requests(page_id=page_id_alice)
// 期望：无 /api/messages 之类的请求
```

---

## 测试用例 F-11：用户上线下线实时更新

**验证：** 用户加入/离开时，在线用户列表实时更新

**步骤：**
1. alice 已登录，在线列表只有 alice
2. bob 登录，alice 的在线列表更新出现 bob
3. bob 关闭页面，alice 的在线列表 bob 消失

**Chrome DevTools 执行命令：**
```
// alice 已登录，记录当前在线用户数
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelectorAll('[class*=user]').length"
)  // → count_before

// bob 登录（在新页面）
new_page()  // → page_id_bob2
navigate_page(page_id=page_id_bob2, url="http://localhost:5173/login")
fill(page_id=page_id_bob2, selector="input[autocomplete='username']", value="bob")
fill(page_id=page_id_bob2, selector="input[type='password']", value="pass456")
click(page_id=page_id_bob2, selector="button[type='submit']")
wait_for(page_id=page_id_bob2, selector="[class*='main']", timeout=5000)

// 等待 alice 页面更新
wait_for(page_id=page_id_alice, timeout=1000)

// 验证 alice 页面在线用户增加
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelectorAll('[class*=user]').length"
)  // 期望: count_before + 1

// bob 关闭页面
close_page(page_id=page_id_bob2)
wait_for(page_id=page_id_alice, timeout=2000)

// 验证 alice 页面在线用户减少
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelectorAll('[class*=user]').length"
)  // 期望: count_before
```
