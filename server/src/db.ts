import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../data/chatroom.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public_keys (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    key_data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    created_by TEXT REFERENCES users(id),
    used_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );
`);

export default db;
