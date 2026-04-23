import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import authRouter from './auth';
import inviteRouter from './invite';
import pubkeyRouter from './pubkey';
import uploadRouter from './upload';
import { FILES_DIR } from './upload';
import { setupWebSocket } from './ws';

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/invite', inviteRouter);
app.use('/api/users', pubkeyRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', uploadRouter);
app.use('/files', express.static(FILES_DIR));

// Production: serve client static files + SPA fallback
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
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export { app, server };
