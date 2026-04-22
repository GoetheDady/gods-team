import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import db from '../src/db';

async function registerAndGetAgent(username: string, code: string) {
  db.prepare(
    'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
  ).run(code, Date.now());

  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({ username, password: 'pass123', invite_code: code });
  return agent;
}

describe('POST /api/invite/generate', () => {
  it('已登录用户可生成邀请码，返回 8 位大写字符串', async () => {
    const agent = await registerAndGetAgent('inviter1', 'INV00001');

    const res = await agent.post('/api/invite/generate');

    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^[A-F0-9]{8}$/);
  });

  it('未登录用户无法生成邀请码', async () => {
    const res = await request(app).post('/api/invite/generate');
    expect(res.status).toBe(401);
  });

  it('同一用户可以生成多个邀请码', async () => {
    const agent = await registerAndGetAgent('inviter2', 'INV00002');

    const res1 = await agent.post('/api/invite/generate');
    const res2 = await agent.post('/api/invite/generate');

    expect(res1.body.code).not.toBe(res2.body.code);
  });
});

describe('GET /api/invite/mine', () => {
  it('返回自己生成的所有邀请码', async () => {
    const agent = await registerAndGetAgent('inviter3', 'INV00003');

    await agent.post('/api/invite/generate');
    await agent.post('/api/invite/generate');

    const res = await agent.get('/api/invite/mine');

    expect(res.status).toBe(200);
    expect(res.body.codes.length).toBe(2);
  });

  it('新生成的邀请码 used_by 为 null', async () => {
    const agent = await registerAndGetAgent('inviter4', 'INV00004');
    await agent.post('/api/invite/generate');

    const res = await agent.get('/api/invite/mine');

    expect(res.body.codes[0].used_by).toBeNull();
    expect(res.body.codes[0].used_at).toBeNull();
  });

  it('邀请码被使用后 used_by 有值', async () => {
    const agent = await registerAndGetAgent('inviter5', 'INV00005');
    const { body: { code } } = await agent.post('/api/invite/generate');

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'newbie', password: 'pass123', invite_code: code });

    const res = await agent.get('/api/invite/mine');
    const usedCode = res.body.codes.find((c: { code: string }) => c.code === code);

    expect(usedCode.used_by).not.toBeNull();
    expect(usedCode.used_at).not.toBeNull();
  });

  it('未登录用户无法查看邀请码列表', async () => {
    const res = await request(app).get('/api/invite/mine');
    expect(res.status).toBe(401);
  });
});
