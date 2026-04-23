import { initDb } from '../src/pg';
import sql from '../src/pg';

export async function setupTestDb() {
  await initDb();
  // Clean up test data
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  await sql`DELETE FROM users`;
}

export async function teardownTestDb() {
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  await sql`DELETE FROM users`;
  await sql.end();
}
