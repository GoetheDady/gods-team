# Task 19: 浏览器功能测试 - 邀请码管理

**工具：** Chrome DevTools MCP  
**前提：** 服务端和前端均已启动，alice 已注册并登录

---

## 测试用例 F-12：生成邀请码

**验证：** 已登录用户可生成 8 位邀请码

**步骤：**
1. alice 登录后点击顶栏"邀请码"按钮
2. 进入设置页，点击"生成邀请码"
3. 验证生成结果

**Chrome DevTools 执行命令：**
```
// alice 已登录，点击邀请码按钮
click(page_id=page_id_alice, selector="[class*='inviteBtn']")
wait_for(page_id=page_id_alice, selector="[class*='generateBtn']", timeout=2000)

// 点击生成
click(page_id=page_id_alice, selector="[class*='generateBtn']")
wait_for(page_id=page_id_alice, selector="[class*='code']", timeout=2000)

// 获取生成的邀请码
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelector('[class*=code]').textContent.trim()"
)
// 期望：8位大写字母+数字，匹配 /^[A-F0-9]{8}$/
```

---

## 测试用例 F-13：复制邀请码到剪贴板

**验证：** 点击"复制"按钮，邀请码复制到剪贴板

**Chrome DevTools 执行命令：**
```
// 已在设置页且已生成邀请码
click(page_id=page_id_alice, selector="[class*='copyBtn']")
wait_for(page_id=page_id_alice, timeout=500)

// 验证按钮文字变为"已复制"
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelector('[class*=copyBtn]').textContent"
)
// 期望: "已复制"

// 等待 1.5 秒后按钮恢复
wait_for(page_id=page_id_alice, timeout=1500)
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelector('[class*=copyBtn]').textContent"
)
// 期望: "复制"
```

---

## 测试用例 F-14：邀请码列表显示使用状态

**验证：** 已使用的邀请码显示"已使用"，未使用的显示"未使用"

**步骤：**
1. alice 生成一个邀请码
2. 用该邀请码注册 charlie
3. alice 查看邀请码列表

**Chrome DevTools 执行命令：**
```
// alice 生成邀请码
navigate_page(page_id=page_id_alice, url="http://localhost:5173/settings")
click(page_id=page_id_alice, selector="[class*='generateBtn']")
wait_for(page_id=page_id_alice, selector="[class*='code']", timeout=2000)

// 获取邀请码
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelector('[class*=code]').textContent.trim()"
)  // → new_code

// 用新邀请码注册 charlie（通过 API 直接调用，不走 UI）
evaluate_script(
  page_id=page_id_alice,
  script=`
    fetch('/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username:'charlie',password:'pass789',invite_code:'${new_code}'})
    }).then(r => r.json())
  `
)
wait_for(page_id=page_id_alice, timeout=500)

// 刷新列表
navigate_page(page_id=page_id_alice, url="http://localhost:5173/settings")
wait_for(page_id=page_id_alice, selector="[class*='codeList']", timeout=2000)

// 验证状态
evaluate_script(
  page_id=page_id_alice,
  script=`
    [...document.querySelectorAll('[class*=codeItem]')]
      .map(el => ({
        code: el.querySelector('[class*=codeValue]').textContent.trim(),
        status: el.querySelector('[class*=codeStatus]').textContent.trim()
      }))
  `
)
// 期望：new_code 对应的 status 为 "已使用"
```

---

## 测试用例 F-15：用生成的邀请码注册新用户

**验证：** 完整端到端流程：alice 生成码 → charlie 用码注册 → 登录成功

**Chrome DevTools 执行命令：**
```
// alice 生成邀请码并记录
navigate_page(page_id=page_id_alice, url="http://localhost:5173/settings")
click(page_id=page_id_alice, selector="[class*='generateBtn']")
wait_for(page_id=page_id_alice, selector="[class*='code']", timeout=2000)
evaluate_script(
  page_id=page_id_alice,
  script="document.querySelector('[class*=newCode] [class*=code]').textContent.trim()"
)  // → fresh_code

// 新页面：charlie 用邀请码注册
new_page()  // → page_id_charlie
navigate_page(page_id=page_id_charlie, url="http://localhost:5173/register")
fill(page_id=page_id_charlie, selector="input[placeholder='8位邀请码']", value=fresh_code)
fill(page_id=page_id_charlie, selector="input[placeholder='起个江湖名号']", value="charlie")
fill(page_id=page_id_charlie, selector="input[type='password']", value="pass789")
click(page_id=page_id_charlie, selector="button[type='submit']")
wait_for(page_id=page_id_charlie, selector="[class*='logo']", timeout=5000)

// 验证注册成功并进入聊天室
evaluate_script(
  page_id=page_id_charlie,
  script="window.location.pathname"
)
// 期望: "/chat"

evaluate_script(
  page_id=page_id_charlie,
  script="document.querySelector('[class*=username] span').textContent"
)
// 期望: "charlie"
```
