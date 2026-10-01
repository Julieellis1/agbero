// E2E test rig: serves the built game + API backed by pg-mem.
// Run: node e2e-test.js   (listens on 127.0.0.1:8901)
const path = require('path');
const fs = require('fs');
const { newDb } = require('pg-mem');
const { createApp, SCHEMA } = require('./index');

async function main() {
  const pub = path.join(__dirname, 'public');
  if (!fs.existsSync(path.join(pub, 'index.html'))) {
    console.error('E2E needs the game build at server/public — symlink ../game/dist there first.');
    process.exit(1);
  }
  const db = newDb();
  db.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  const app = createApp(pool);
  app.listen(8901, '127.0.0.1', () => console.log('E2E server on http://127.0.0.1:8901'));
}
main().catch(e => { console.error(e); process.exit(1); });
