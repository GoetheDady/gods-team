import postgres from 'postgres';

const sql = postgres(
  process.env.NODE_ENV === 'test'
    ? 'postgresql://gods:gods123@localhost:5433/gods_team_dev'
    : (process.env.DATABASE_URL ?? 'postgresql://gods:gods123@localhost:5433/gods_team_dev')
);

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      is_admin    BOOLEAN DEFAULT FALSE,
      created_at  BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code        TEXT PRIMARY KEY,
      created_by  TEXT REFERENCES users(id),
      used_by     TEXT REFERENCES users(id),
      created_at  BIGINT NOT NULL,
      used_at     BIGINT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      chat_id     TEXT NOT NULL,
      sender_id   TEXT REFERENCES users(id),
      sender_name TEXT NOT NULL,
      content     TEXT,
      images      JSONB,
      created_at  BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(chat_id, created_at DESC)
  `;
  await sql`
    INSERT INTO invite_codes (code, created_by, created_at)
    VALUES ('ADMIN0001', NULL, 0)
    ON CONFLICT DO NOTHING
  `;
}

export default sql;
