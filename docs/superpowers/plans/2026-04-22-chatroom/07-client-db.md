# Task 07: 客户端本地 SQLite 存储

**Files:**
- Create: `client/src/services/localDb.ts`

---

SQLite WASM 需要 `SharedArrayBuffer`，Vite dev server 已在 Task 01 中配置了必要响应头。生产环境部署时同样需要在反向代理（nginx/caddy）加这两个头。

- [ ] **Step 1: 创建 `client/src/services/localDb.ts`**

```typescript
import type { Sqlite3Static, Database } from '@sqlite.org/sqlite-wasm';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (db) return db;

  const sqlite3: Sqlite3Static = await new Promise((resolve, reject) => {
    import('@sqlite.org/sqlite-wasm').then(({ default: sqlite3InitModule }) => {
      sqlite3InitModule({ print: console.log, printErr: console.error })
        .then(resolve)
        .catch(reject);
    });
  });

  // 优先使用 OPFS（持久化），降级到内存
  if (sqlite3.capi.sqlite3_vfs_find('opfs')) {
    db = new sqlite3.oo1.OpfsDb('/chatroom.db');
  } else {
    console.warn('OPFS not available, using in-memory storage');
    db = new sqlite3.oo1.DB(':memory:');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, timestamp);
  `);

  return db;
}

export interface LocalMessage {
  id: string;
  chat_id: string;
  from_id: string;
  content: string;
  timestamp: number;
}

export async function saveMessage(msg: LocalMessage): Promise<void> {
  const db = await getDb();
  db.exec({
    sql: 'INSERT OR IGNORE INTO messages (id, chat_id, from_id, content, timestamp) VALUES (?,?,?,?,?)',
    bind: [msg.id, msg.chat_id, msg.from_id, msg.content, msg.timestamp],
  });
}

export async function getMessages(chatId: string, limit = 100): Promise<LocalMessage[]> {
  const db = await getDb();
  const rows: LocalMessage[] = [];
  db.exec({
    sql: `SELECT id, chat_id, from_id, content, timestamp
          FROM messages
          WHERE chat_id = ?
          ORDER BY timestamp ASC
          LIMIT ?`,
    bind: [chatId, limit],
    callback: (row) => {
      rows.push({
        id: row[0] as string,
        chat_id: row[1] as string,
        from_id: row[2] as string,
        content: row[3] as string,
        timestamp: row[4] as number,
      });
    },
  });
  return rows;
}

export async function clearChat(chatId: string): Promise<void> {
  const db = await getDb();
  db.exec({ sql: 'DELETE FROM messages WHERE chat_id = ?', bind: [chatId] });
}
```

- [ ] **Step 2: 在 `client/index.html` 中添加必要的 meta 标签**

确认 `client/index.html` 的 `<head>` 中已有：
```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
这些 Vite 模板默认已有，无需修改。

- [ ] **Step 3: 在浏览器控制台验证 SQLite 可用**

启动 client，打开浏览器控制台：

```javascript
const { saveMessage, getMessages } = await import('/src/services/localDb.ts');

await saveMessage({
  id: 'msg-001',
  chat_id: 'hall',
  from_id: 'user-alice',
  content: 'Hello hall!',
  timestamp: Date.now()
});

const msgs = await getMessages('hall');
console.log(msgs);
// 期望: [{ id: 'msg-001', chat_id: 'hall', ... }]
```

如果 OPFS 可用，刷新页面后 `getMessages('hall')` 仍应返回该消息（持久化验证）。

- [ ] **Step 4: 提交**

```bash
git add client/src/services/localDb.ts
git commit -m "feat: add local SQLite WASM storage for chat history"
```
