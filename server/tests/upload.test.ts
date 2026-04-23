import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import db from '../src/db';

beforeEach(() => {
  db.exec('DELETE FROM public_keys; DELETE FROM invite_codes; DELETE FROM users;');
});

describe('POST /api/upload', () => {
  it('未登录时返回 401', async () => {
    const res = await request(app)
      .post('/api/upload')
      .send(Buffer.from('test'));
    expect(res.status).toBe(401);
  });

  it('登录后上传返回 url', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('UPLOAD01', Date.now());
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'uploaduser', password: 'pass123', invite_code: 'UPLOAD01' });

    const res = await agent
      .post('/api/upload')
      .send(Buffer.from('encrypted-image-data'));

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/files\//);
  });

  it('GET /files/:id 返回上传的文件', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('UPLOAD02', Date.now());
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'getfileuser', password: 'pass123', invite_code: 'UPLOAD02' });

    const data = Buffer.from('encrypted-image-data-2');
    const uploadRes = await agent
      .post('/api/upload')
      .send(data);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(200);
    expect(fileRes.body.toString()).toBe('encrypted-image-data-2');
  });
});
