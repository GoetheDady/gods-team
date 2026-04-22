import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import authRouter from './auth';
import inviteRouter from './invite';
import pubkeyRouter from './pubkey';
import { setupWebSocket } from './ws';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/invite', inviteRouter);
app.use('/api/users', pubkeyRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
setupWebSocket(server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

export { app, server };
