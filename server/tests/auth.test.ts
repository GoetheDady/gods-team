import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import db from '../src/db';

describe('POST /api/auth/register', () => {
  it('使用有效邀请码注册成功，返回 userId 和 username', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('TESTCODE', Date.now());
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass123', invite_code: 'TESTCODE' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.userId).toBeTruthy();
  });

  it('注册成功后邀请码不可重复使用', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('ONCEONLY', Date.now());

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'pass123', invite_code: 'ONCEONLY' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'charlie', password: 'pass123', invite_code: 'ONCEONLY' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already used/i);
  });

  it('邀请码不存在时注册失败', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', password: 'pass123', invite_code: 'INVALID0' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('用户名重复时注册失败', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('CODE0001', Date.now());
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('CODE0002', Date.now());

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicate', password: 'pass123', invite_code: 'CODE0001' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicate', password: 'pass456', invite_code: 'CODE0002' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/taken/i);
  });

  it('缺少字段时注册失败', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('LOGINTEST', Date.now());
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'loginuser', password: 'mypassword', invite_code: 'LOGINTEST' });
  });

  it('正确凭据登录成功，返回用户信息并设置 cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'mypassword' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('loginuser');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('密码错误时登录失败', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('用户不存在时登录失败', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'pass123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('携带有效 cookie 时返回当前用户信息', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('METEST01', Date.now());

    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'meuser', password: 'pass123', invite_code: 'METEST01' });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('meuser');
  });

  it('未登录时返回 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('登出后清除 cookie，再访问 /me 返回 401', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('LOGOUT01', Date.now());

    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'logoutuser', password: 'pass123', invite_code: 'LOGOUT01' });

    await agent.post('/api/auth/logout');

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
