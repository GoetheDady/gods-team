import express from 'express';
import cors from 'cors';
import http from 'http';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

export { app, server };
