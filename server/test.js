// Smoke test for the Agbero server using pg-mem (no real Postgres needed).
// Run: npm test
const { newDb } = require('pg-mem');
const { createApp, SCHEMA } = require('./index');

async function main() {
  const db = newDb();
  db.public.registerFunction({
    name: 'now', returns: 'timestamptz', implementation: () => new Date(),
  });
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);

  const app = createApp(pool);
  const srv = app.listen(0);
  await new Promise(r => srv.on('listening', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  let n = 0;
  const check = (name, cond, extra) => {
    n++;
    if (!cond) { console.error('FAIL:', name, extra || ''); srv.close(); process.exit(1); }
    console.log('ok:', name);
  };
  const j = async (m, p, body, tok) => {
    const r = await fetch(base + p, {
      method: m,
      headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  const h = await j('GET', '/api/health');
  check('health ok + db true', h.status === 200 && h.body.ok && h.body.db === true, JSON.stringify(h));

  const bad1 = await j('POST', '/api/auth/register', { email: 'nope', password: '123456' });
  check('register rejects bad email', bad1.status === 400, JSON.stringify(bad1));
  const bad2 = await j('POST', '/api/auth/register', { email: 'a@b.co', password: '123' });
  check('register rejects short password', bad2.status === 400, JSON.stringify(bad2));

  const reg = await j('POST', '/api/auth/register', { email: 'Test@Example.com', password: 'hustle123' });
  check('register ok', reg.status === 200 && reg.body.token && reg.body.email === 'test@example.com', JSON.stringify(reg).slice(0, 200));
  const token = reg.body.token;

  const dup = await j('POST', '/api/auth/register', { email: 'test@example.com', password: 'hustle123' });
  check('duplicate register -> 409', dup.status === 409, JSON.stringify(dup));

  const wrong = await j('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrongpass' });
  check('login wrong password -> 401', wrong.status === 401, JSON.stringify(wrong));
  const login = await j('POST', '/api/auth/login', { email: 'TEST@example.com', password: 'hustle123' });
  check('login ok (case-insensitive email)', login.status === 200 && login.body.token, JSON.stringify(login).slice(0, 120));

  const noAuth = await j('GET', '/api/state');
  check('state without token -> 401', noAuth.status === 401, JSON.stringify(noAuth));
  const badTok = await j('GET', '/api/state', null, 'garbage');
  check('state with bad token -> 401', badTok.status === 401, JSON.stringify(badTok));

  const s0 = await j('GET', '/api/state', null, token);
  check('fresh account state empty', s0.status === 200 && JSON.stringify(s0.body.state) === '{}', JSON.stringify(s0.body));

  const save = { cash: 5200, week: 2, day: 9, quota: 30000, weeklyCollected: 31000 };
  const put = await j('PUT', '/api/state', { state: save }, token);
  check('put state ok', put.status === 200 && put.body.ok, JSON.stringify(put));
  const s1 = await j('GET', '/api/state', null, token);
  check('state round-trips', s1.status === 200 && s1.body.state.cash === 5200 && s1.body.state.week === 2,
    JSON.stringify(s1.body.state));

  const putBad = await j('PUT', '/api/state', { state: [1, 2] }, token);
  check('put rejects non-object state', putBad.status === 400, JSON.stringify(putBad));

  // unknown api path -> json 404, non-api path -> index.html
  const nf = await j('GET', '/api/nope', null, token);
  check('unknown api -> 404 json', nf.status === 404, JSON.stringify(nf));

  console.log(`ALL ${n} SERVER TESTS PASSED`);
  srv.close();
  process.exit(0);
}
main().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
