import { initDb } from '../src/pg';
import sql from '../src/pg';

export async function setupTestDb() {
  await initDb();
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM refresh_tokens`;
  await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
  await sql`DELETE FROM users`;
}

export async function teardownTestDb() {
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM refresh_tokens`;
  await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
  await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  await sql`DELETE FROM users`;
}
