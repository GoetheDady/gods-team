import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.join(__dirname, '../../data/chatroom.db');

const db = new Database(dbPath);

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

// Seed the bootstrap invite code if it doesn't exist yet
db.prepare('INSERT OR IGNORE INTO invite_codes (code, created_by, created_at) VALUES (?, ?, ?)').run('ADMIN0001', null, Date.now());

export default db;
