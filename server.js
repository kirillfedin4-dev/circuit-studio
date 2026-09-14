// server.js
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const { Pool } = pg;

const PORT = process.env.PORT || 1234;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан в .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Проверка подключения
pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL подключён'))
  .catch((err) => {
    console.error('❌ PostgreSQL не доступен:', err.message);
    process.exit(1);
  });

// ---------- Express ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Middleware: проверка JWT
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Плохой токен' });
  }
}

// --- AUTH ---

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email и пароль (6+ символов) обязательны' });
    }
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email уже занят' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/me', auth, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
});

// --- CIRCUITS ---

app.get('/api/circuits', auth, async (req, res) => {
  const { data } = await pool.query(
    'SELECT id, name, is_public, created_at, updated_at FROM circuits WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.user.id]
  );
  res.json(data);
});

app.get('/api/circuits/public', async (_req, res) => {
  const { data } = await pool.query(
    'SELECT id, name, created_at, updated_at FROM circuits WHERE is_public = TRUE ORDER BY updated_at DESC LIMIT 50'
  );
  res.json(data);
});

app.get('/api/circuits/:id', async (req, res) => {
  const { data } = await pool.query('SELECT * FROM circuits WHERE id = $1', [req.params.id]);
  if (data.length === 0) return res.status(404).json({ error: 'Не найдено' });
  const c = data[0];
  // Доступ: владелец или публичная
  const isOwner = req.headers.authorization && (() => {
    try {
      const t = req.headers.authorization.slice(7);
      const p = jwt.verify(t, JWT_SECRET);
      return p.id === c.user_id;
    } catch { return false; }
  })();
  if (!c.is_public && !isOwner) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(c);
});

app.post('/api/circuits', auth, async (req, res) => {
  try {
    const { name, data, is_public } = req.body;
    if (!data) return res.status(400).json({ error: 'Нет data' });
    const r = await pool.query(
      'INSERT INTO circuits (user_id, name, data, is_public) VALUES ($1, $2, $3, $4) RETURNING id, name, is_public, created_at',
      [req.user.id, name || 'Без названия', data, !!is_public]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/circuits/:id', auth, async (req, res) => {
  try {
    const { name, data, is_public } = req.body;
    const r = await pool.query(
      `UPDATE circuits SET 
        name = COALESCE($1, name),
        data = COALESCE($2, data),
        is_public = COALESCE($3, is_public),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING id`,
      [name, data, is_public, req.params.id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/circuits/:id', auth, async (req, res) => {
  const r = await pool.query(
    'DELETE FROM circuits WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

app.get('/', (_req, res) => res.send('Circuit Studio API работает ✅'));

// ---------- HTTP + WS ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();
const updates = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.pathname.slice(1) || 'default';

  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
    updates.set(roomName, []);
  }
  const clients = rooms.get(roomName);
  clients.add(ws);
  console.log(`[+] WS: комната "${roomName}". Всего: ${clients.size}`);

  const roomUpdates = updates.get(roomName);
  for (const u of roomUpdates) if (ws.readyState === ws.OPEN) ws.send(u);

  ws.on('message', (data) => {
    for (const c of clients) if (c !== ws && c.readyState === c.OPEN) c.send(data);
    if (data instanceof Buffer) {
      roomUpdates.push(new Uint8Array(data));
      if (roomUpdates.length > 200) roomUpdates.shift();
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[-] WS: комната "${roomName}". Осталось: ${clients.size}`);
    if (clients.size === 0) {
      setTimeout(() => {
        if (rooms.get(roomName)?.size === 0) {
          rooms.delete(roomName); updates.delete(roomName);
        }
      }, 30000);
    }
  });

  ws.on('error', (e) => console.error('WS error:', e));
});

server.listen(PORT, () => {
  console.log(`\n🚀 API + WS сервер: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/<room>\n`);
});