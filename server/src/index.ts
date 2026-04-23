import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';

import { initDb } from './pg';
import authRouter from './auth';
import inviteRouter from './invite';
import messagesRouter from './messages';
import ossRouter from './oss';
import usersRouter from './users';
import { setupWebSocket } from './ws';

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/invite', inviteRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/oss', ossRouter);
app.use('/api/users', usersRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === 'production') {
  const clientDist = '/app/client/dist';
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
setupWebSocket(server);

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    await initDb();
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })();
}

export { app, server };
