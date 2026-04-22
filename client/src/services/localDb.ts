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
