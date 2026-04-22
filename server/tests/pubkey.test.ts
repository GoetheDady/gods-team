import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import db from '../src/db';

async function registerAndGetAgent(username: string, code: string) {
  db.prepare(
    'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
  ).run(code, Date.now());

  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ username, password: 'pass123', invite_code: code });
  return { agent, userId: res.body.userId as string };
}

const FAKE_PUBKEY = 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NA==';
const FAKE_PUBKEY_2 = 'bmV3LXB1YmxpYy1rZXktdXBkYXRlZA==';

describe('POST /api/users/me/pubkey', () => {
  it('已登录用户上传公钥成功', async () => {
    const { agent } = await registerAndGetAgent('keyuser1', 'KEY00001');

    const res = await agent
      .post('/api/users/me/pubkey')
      .send({ key_data: FAKE_PUBKEY });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('重复上传公钥会更新，不报错', async () => {
    const { agent, userId } = await registerAndGetAgent('keyuser2', 'KEY00002');

    await agent.post('/api/users/me/pubkey').send({ key_data: FAKE_PUBKEY });
    await agent.post('/api/users/me/pubkey').send({ key_data: FAKE_PUBKEY_2 });

    const res = await agent.get(`/api/users/${userId}/pubkey`);
    expect(res.body.key_data).toBe(FAKE_PUBKEY_2);
  });

  it('缺少 key_data 时返回 400', async () => {
    const { agent } = await registerAndGetAgent('keyuser3', 'KEY00003');

    const res = await agent.post('/api/users/me/pubkey').send({});
    expect(res.status).toBe(400);
  });

  it('未登录用户无法上传公钥', async () => {
    const res = await request(app)
      .post('/api/users/me/pubkey')
      .send({ key_data: FAKE_PUBKEY });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/:id/pubkey', () => {
  it('获取已上传公钥成功', async () => {
    const { agent, userId } = await registerAndGetAgent('keyuser4', 'KEY00004');
    await agent.post('/api/users/me/pubkey').send({ key_data: FAKE_PUBKEY });

    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('KEY00005', Date.now());
    const agent2 = request.agent(app);
    await agent2
      .post('/api/auth/register')
      .send({ username: 'keyuser5', password: 'pass123', invite_code: 'KEY00005' });

    const res = await agent2.get(`/api/users/${userId}/pubkey`);

    expect(res.status).toBe(200);
    expect(res.body.key_data).toBe(FAKE_PUBKEY);
  });

  it('用户未上传公钥时返回 404', async () => {
    const { agent, userId } = await registerAndGetAgent('keyuser6', 'KEY00006');

    const res = await agent.get(`/api/users/${userId}/pubkey`);
    expect(res.status).toBe(404);
  });

  it('未登录用户无法获取公钥', async () => {
    const res = await request(app).get('/api/users/some-id/pubkey');
    expect(res.status).toBe(401);
  });
});
