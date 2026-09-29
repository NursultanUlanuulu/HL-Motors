// Disposable QA preview. All data, credentials and database transport are local
// and synthetic. It does not certify real Supabase Storage or PostgREST behavior.
// Usage: npm run build, then node tests/security-preview.cjs. Stop with Ctrl+C.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '..');
const origin = 'http://localhost:3107';
const dbOrigin = 'http://127.0.0.1:54329';
const serviceKey = 'security-preview-synthetic-service-key';
const password = 'Synthetic-only-Password9!';
const sessionSecret = 'security-preview-synthetic-session-secret-32-chars';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function synthetic(id, maximum = false) {
  return {
    id, brand: maximum ? 'M'.repeat(80) : 'Preview', model: maximum ? 'М'.repeat(80) : 'Synthetic',
    trim: maximum ? 'Комплектация '.repeat(12) : 'QA', price: maximum ? 100000000 : 12345,
    year: 2026, mileage: '0 км', status: 'В наличии', condition: 'Новый', city: 'QA city',
    power: '100', drive: 'Полный', body: 'Седан', color: 'Белый', transmission: 'Автомат', engine: 'Электро',
    image: `${origin}/motors-logo.png`, gallery: [`${origin}/motors-logo.png`],
  };
}

async function database() {
  const db = new PGlite(); await db.waitReady;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
  for (const name of migrations) await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'));
  await db.query('update public.site_settings set contacts=$1 where id=$2', [{ whatsapp: '10000000000', telegram: 'qa_preview', email: 'qa@example.invalid' }, 'main']);
  for (const car of [synthetic('QA-NORMAL'), synthetic('QA-LONG', true)]) {
    await db.query('insert into public.vehicles(id,data) values($1,$2)', [car.id, car]);
  }
  return db;
}

async function adapter(db) {
  const state = { mode: 'ok', calls: 0, lastPaths: [] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, dbOrigin);
    const send = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1048576) return send(413, { message: 'Preview transport body limit' });
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (url.pathname === '/__qa/control') {
        if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json' || (req.headers.origin && req.headers.origin !== dbOrigin)) return send(403, {});
        const body = JSON.parse(raw);
        if (body.mode && !['ok', 'error', 'timeout'].includes(body.mode)) return send(400, {});
        if (body.mode) state.mode = body.mode;
        if (body.clearAttempts === true) await db.exec('delete from public.admin_login_attempts');
        return send(200, { mode: state.mode });
      }
      if (url.pathname === '/__qa/state' && req.method === 'GET') {
        const vehicles = (await db.query('select id,version,data from public.vehicles order by id')).rows;
        const contacts = (await db.query('select contacts from public.site_settings')).rows[0].contacts;
        const sessions = (await db.query('select count(*)::int as count from public.admin_sessions')).rows[0].count;
        return send(200, { ...state, vehicles, contacts, sessions });
      }
      if (req.headers.apikey !== serviceKey) return send(403, { message: 'Preview key required' });
      state.calls++; state.lastPaths.push(url.pathname); state.lastPaths = state.lastPaths.slice(-20);
      if (state.mode === 'error') return send(500, { message: 'SYNTHETIC_DATABASE_DIAGNOSTIC_MUST_NOT_LEAK' });
      if (state.mode === 'timeout') return;
      const body = raw ? JSON.parse(raw) : undefined;
      const result = await db.transaction(async tx => {
        await tx.exec('set local role service_role');
        if (url.pathname === '/rest/v1/rpc/reserve_admin_login_attempt') {
          return { scalar: true, value: (await tx.query('select public.reserve_admin_login_attempt($1,$2) as retry', [body.p_source, body.p_admin])).rows[0].retry };
        }
        const tables = { '/rest/v1/vehicles': 'vehicles', '/rest/v1/site_settings': 'site_settings', '/rest/v1/admin_sessions': 'admin_sessions' };
        const table = tables[url.pathname];
        if (!table) return { status: 404, value: {} };
        const params = []; const add = value => { params.push(value); return '$' + params.length; };
        const predicates = [];
        for (const key of ['id', 'version', 'contacts', 'token_hash', 'credential_version', 'expires_at']) if (url.searchParams.has(key)) {
          const value = url.searchParams.get(key); const operator = value.slice(0, 3);
          if (!['eq.', 'gt.'].includes(operator)) throw new Error('Unsupported preview filter');
          predicates.push(`"${key}"${operator === 'gt.' ? '>' : '='}${add(key === 'contacts' ? JSON.parse(value.slice(3)) : value.slice(3))}`);
        }
        const where = predicates.length ? ' where ' + predicates.join(' and ') : '';
        let rows;
        if (req.method === 'GET') {
          let sql = `select * from public.${table}${where}`;
          if (table === 'vehicles') sql += ' order by created_at desc,id';
          if (url.searchParams.has('limit')) sql += ' limit ' + add(Number(url.searchParams.get('limit')));
          if (url.searchParams.has('offset')) sql += ' offset ' + add(Number(url.searchParams.get('offset')));
          rows = (await tx.query(sql, params)).rows;
        } else if (req.method === 'POST' && table === 'vehicles') {
          rows = (await tx.query('insert into public.vehicles(id,data) values($1,$2) returning *', [body.id, body.data])).rows;
        } else if (req.method === 'POST' && table === 'admin_sessions') {
          await tx.query('insert into public.admin_sessions(token_hash,credential_version,expires_at) values($1,$2,$3)', [body.token_hash, body.credential_version, body.expires_at]);
          rows = [];
        } else if (req.method === 'PATCH' && table !== 'admin_sessions') {
          const key = table === 'vehicles' ? 'data' : 'contacts';
          const ref = add(body[key]); rows = (await tx.query(`update public.${table} set ${key}=${ref}${where} returning *`, params)).rows;
        } else if (req.method === 'DELETE') {
          rows = (await tx.query(`delete from public.${table}${where} returning *`, params)).rows;
        } else return { status: 405, value: {} };
        return { value: req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows };
      });
      send(result.status ?? 200, result.value);
    } catch (error) {
      send(error.code === '23505' ? 409 : 400, { code: error.code, message: error.message });
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(54329, '127.0.0.1', resolve); });
  return server;
}

async function main() {
  // Refuse to attach to or replace another local application.
  await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', reject);
    probe.listen(3107, '127.0.0.1', () => probe.close(resolve));
  });
  const db = await database(); const server = await adapter(db);
  const logPath = path.join(os.tmpdir(), `motors-security-preview-${process.pid}.log`);
  const log = fs.openSync(logPath, 'w');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', '3107', '-H', '127.0.0.1'], {
    cwd: root, windowsHide: true, stdio: ['ignore', log, log],
    env: { ...process.env, NODE_ENV: 'production', SUPABASE_URL: dbOrigin, SUPABASE_SECRET_KEY: serviceKey,
      ADMIN_SESSION_SECRET: sessionSecret, ADMIN_PASSWORD: password, ADMIN_LOCAL_AUTH: 'false',
      ADMIN_ALLOWED_ORIGINS: '', ADMIN_TRUSTED_IP_HEADER: '', NEXT_TELEMETRY_DISABLED: '1' },
  });
  let stopped = false;
  async function stop() {
    if (stopped) return; stopped = true;
    child.kill(); server.closeAllConnections(); server.close(); await db.close(); fs.closeSync(log);
  }
  process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
  child.once('error', error => { console.error(error.message); void stop(); });
  child.once('exit', code => { if (!stopped) { console.error(`Preview Next server exited (${code}); log: ${logPath}`); void stop(); } });
  try {
    for (let n = 0; n < 120; n++) {
      if (stopped) throw new Error('Preview child stopped');
      try {
        const response = await fetch(origin + '/api/site', { signal: AbortSignal.timeout(3000) });
        if (response.ok && (await response.json()).cars?.length === 2) {
          console.log(JSON.stringify({ ready: true, origin, database: dbOrigin, username: 'admin', password, logPath, storageUploads: 'not implemented; no external service contacted' }));
          return;
        }
      } catch {}
      await pause(250);
    }
    throw new Error(`Preview did not become ready; log: ${logPath}`);
  } catch (error) { await stop(); throw error; }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { database, adapter, synthetic, origin, dbOrigin, password };
