import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setupTestDb, teardownTestDb } from './setup';

describe('GET /api/users', () => {
  let token: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    const { default: sql } = await import('../src/pg');
    await sql`DELETE FROM refresh_tokens`;
    await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
    await sql`DELETE FROM users`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234', invite_code: 'ADMIN0001' });
    token = res.body.accessToken;
  });

  it('returns all users without password', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].username).toBe('alice');
    expect(res.body.users[0].password).toBeUndefined();
    expect(res.body.users[0].id).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});
