// Agbero server: serves the game build, handles user accounts (email+password,
// bcrypt hashes, JWT sessions) and per-user cloud saves in Postgres.
//
// Endpoints:
//   GET  /api/health          -> { ok, db, time }
//   POST /api/auth/register   -> { token, email, state, updated_at }
//   POST /api/auth/login      -> { token, email, state, updated_at }
//   GET  /api/state           -> { state, updated_at }            (Bearer token)
//   PUT  /api/state  {state}  -> { ok, updated_at }                (Bearer token)
//
// Env: PORT (default 3000), DATABASE_URL (postgres), JWT_SECRET.
// Without DATABASE_URL the server still runs, but auth/save endpoints 503
// and the game falls back to guest mode with local saves.
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '30d';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  state_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

function createApp(pool) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  // Dokploy sits behind Traefik; trust it for correct req.ip in the limiter
  app.set('trust proxy', 1);

  // --- tiny in-memory rate limiter for the auth endpoints ---
  const hits = new Map();
  function authLimit(req, res, next) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'x';
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    if (arr.length > 20) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    next();
  }

  const emailOk = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) && e.length <= 120;
  const passOk = p => typeof p === 'string' && p.length >= 6 && p.length <= 100;
  const needDb = (req, res, next) =>
    pool ? next() : res.status(503).json({ error: 'Accounts are not set up on this server yet.' });

  function sign(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  }
  // node-pg parses JSONB to objects; normalize in case a driver returns text
  function asState(v) {
    if (v && typeof v === 'object') return v;
    try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch { return {}; }
  }

  app.get('/api/health', (req, res) => res.json({ ok: true, db: !!pool, time: Date.now() }));

  app.post('/api/auth/register', authLimit, needDb, async (req, res) => {
    const { email, password } = req.body || {};
    if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!passOk(password)) return res.status(400).json({ error: 'Password needs at least 6 characters.' });
    try {
      const hash = await bcrypt.hash(password, 10);
      const r = await pool.query(
        'INSERT INTO users (email, pass_hash) VALUES ($1, $2) RETURNING id, email, state, state_updated_at',
        [email.trim().toLowerCase(), hash]
      );
      const u = r.rows[0];
      res.json({ token: sign(u), email: u.email, state: asState(u.state), updated_at: u.state_updated_at });
    } catch (e) {
      if (e.code === '23505')
        return res.status(409).json({ error: 'That email already has an account. Sign in instead.' });
      console.error('register:', e.message);
      res.status(500).json({ error: 'Something went wrong. Try again.' });
    }
  });

  app.post('/api/auth/login', authLimit, needDb, async (req, res) => {
    const { email, password } = req.body || {};
    if (!emailOk(email) || typeof password !== 'string')
      return res.status(400).json({ error: 'Enter your email and password.' });
    try {
      const r = await pool.query(
        'SELECT id, email, pass_hash, state, state_updated_at FROM users WHERE email=$1',
        [email.trim().toLowerCase()]
      );
      const u = r.rows[0];
      if (!u || !(await bcrypt.compare(password, u.pass_hash)))
        return res.status(401).json({ error: 'Wrong email or password.' });
      res.json({ token: sign(u), email: u.email, state: asState(u.state), updated_at: u.state_updated_at });
    } catch (e) {
      console.error('login:', e.message);
      res.status(500).json({ error: 'Something went wrong. Try again.' });
    }
  });

  function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!tok) return res.status(401).json({ error: 'Sign in to keep your hustle saved.' });
    try {
      req.user = jwt.verify(tok, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: 'Session expired. Sign in again.' });
    }
  }

  app.get('/api/state', auth, needDb, async (req, res) => {
    try {
      const r = await pool.query('SELECT state, state_updated_at FROM users WHERE id=$1', [req.user.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Account not found.' });
      res.json({ state: asState(r.rows[0].state), updated_at: r.rows[0].state_updated_at });
    } catch (e) {
      console.error('get state:', e.message);
      res.status(500).json({ error: 'Could not load your save.' });
    }
  });

  app.put('/api/state', auth, needDb, async (req, res) => {
    const state = req.body && req.body.state;
    if (!state || typeof state !== 'object' || Array.isArray(state))
      return res.status(400).json({ error: 'Bad save data.' });
    try {
      const r = await pool.query(
        'UPDATE users SET state=$1::jsonb, state_updated_at=now() WHERE id=$2 RETURNING state_updated_at',
        [JSON.stringify(state).slice(0, 200000), req.user.id]
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Account not found.' });
      res.json({ ok: true, updated_at: r.rows[0].state_updated_at });
    } catch (e) {
      console.error('put state:', e.message);
      res.status(500).json({ error: 'Could not save.' });
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // the game build (copied to ./public by the Dockerfile)
  const pub = path.join(__dirname, 'public');
  app.use(express.static(pub));
  app.use((req, res) => res.sendFile(path.join(pub, 'index.html')));

  return app;
}

async function boot() {
  let pool = null;
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(SCHEMA);
    console.log('postgres connected, users table ready');
  } else {
    console.warn('DATABASE_URL not set — accounts disabled, game runs in guest mode');
  }
  const app = createApp(pool);
  app.listen(PORT, () => console.log('agbero server listening on :' + PORT));
}

if (require.main === module) boot().catch(e => { console.error(e); process.exit(1); });
module.exports = { createApp, SCHEMA };
