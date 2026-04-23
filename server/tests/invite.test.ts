import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setupTestDb, teardownTestDb } from './setup';

describe('Invite API', () => {
  let authCookie: string;

  beforeAll(async () => {
    await setupTestDb();

    // Register and login to get auth cookie
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'invitetest', password: 'testpass123', invite_code: 'ADMIN0001' });

    const cookies = registerRes.headers['set-cookie'];
    authCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Clean up generated invite codes between tests
    const { default: sql } = await import('../src/pg');
    await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  });

  it('should generate an invite code when authenticated', async () => {
    const res = await request(app)
      .post('/api/invite/generate')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.code).toBeDefined();
    expect(typeof res.body.code).toBe('string');
  });

  it('should reject invite generation without auth', async () => {
    const res = await request(app)
      .post('/api/invite/generate');

    expect(res.status).toBe(401);
  });

  it('should list my invite codes', async () => {
    // Generate one first
    await request(app)
      .post('/api/invite/generate')
      .set('Cookie', authCookie);

    const res = await request(app)
      .get('/api/invite/mine')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.codes)).toBe(true);
    expect(res.body.codes.length).toBeGreaterThan(0);
  });
});
