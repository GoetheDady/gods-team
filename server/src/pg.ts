import postgres from 'postgres';

// 数据库连接单例
// 开发环境默认连接 localhost:5433 的 gods_team_dev 库
// 生产环境通过 DATABASE_URL 环境变量指定（指向 Docker 网络内的 gods-team-db 容器）
const sql = postgres(
  process.env.NODE_ENV === 'test'
    ? 'postgresql://gods:gods123@localhost:5433/gods_team_dev'
    : (process.env.DATABASE_URL ?? 'postgresql://gods:gods123@localhost:5433/gods_team_dev')
);

// 初始化数据库：建表 + 种子数据
// 使用 CREATE TABLE IF NOT EXISTS 保证幂等，每次启动都可以安全调用
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
  // 复合索引：按 chat_id 分区查询消息，按时间倒序取最新 N 条
  // 支持大厅和私聊两种场景的分页加载
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(chat_id, created_at DESC)
  `;
  // 种子邀请码：管理员首次注册用，ON CONFLICT 防止重复插入
  await sql`
    INSERT INTO invite_codes (code, created_by, created_at)
    VALUES ('ADMIN0001', NULL, 0)
    ON CONFLICT DO NOTHING
  `;
}

export default sql;
