import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setupTestDb, teardownTestDb } from './setup';

describe('Auth API', () => {
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
  });

  it('should register and return accessToken + refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass123', invite_code: 'ADMIN0001' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should reject registration with invalid invite code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass123', invite_code: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('should login and return tokens', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'logintest', password: 'testpass123', invite_code: 'ADMIN0001' });

    const { default: sql } = await import('../src/pg');
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'testpass123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should access /me with Bearer token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'metest', password: 'testpass123', invite_code: 'ADMIN0001' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${regRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('metest');
  });

  it('should reject /me without token', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('should refresh tokens', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'refreshtest', password: 'testpass123', invite_code: 'ADMIN0001' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: regRes.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(regRes.body.refreshToken);
  });

  it('should reject invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
  });
});
