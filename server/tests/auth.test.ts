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
    // 每个测试前清理用户数据，保留 ADMIN0001
    const { default: sql } = await import('../src/pg');
    await sql`DELETE FROM users`;
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
  });

  it('should register a new user with valid invite code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass123', invite_code: 'ADMIN0001' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body.userId).toBeDefined();
  });

  it('should reject registration with invalid invite code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass123', invite_code: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('should login with valid credentials', async () => {
    // First register
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'logintest', password: 'testpass123', invite_code: 'ADMIN0001' });

    // Reset ADMIN0001 for reuse
    const { default: sql } = await import('../src/pg');
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'testpass123' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('logintest');
  });

  it('should reject login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });
});
