// Isolated PostgreSQL engine + deliberately small PostgREST transport adapter.
// This is NOT Supabase Storage/Auth/PostgREST, and cannot certify those services.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const { PGlite } = require('./runtime/node_modules/@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const origin = 'http://localhost:3107';
const dbOrigin = 'http://127.0.0.1:54329';
const sessionSecret = 'audit-only-session-secret-minimum-32-chars';
const serviceKey = 'audit-only-not-a-real-key';
function load(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} }; cache.set(filename, mod.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'module', code)(name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', overrides, cache);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), overrides, cache);
    return require(name);
  }, mod.exports, mod);
  return mod.exports;
}
function synthetic(id = 'AUDIT-CAR') {
  return { id, brand: 'Audit', model: 'Synthetic', trim: 'QA', price: 12345, year: 2026, mileage: '0 км', status: 'В наличии', condition: 'Новый', city: 'Audit city', power: '100', drive: 'Полный', image: `${origin}/motors-logo.png`, gallery: [`${origin}/motors-logo.png`] };
}
async function database() {
  const db = new PGlite(); await db.waitReady;
  // No network/database URL is consumed. Only memory is used.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create role audit_user_a in role authenticated; create role audit_user_b in role authenticated;
    grant usage on schema public to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202609140001_catalog.sql'), 'utf8'));
  await db.query('update site_settings set contacts=$1 where id=$2', [{ whatsapp: '10000000000', telegram: 'audit_test', email: 'audit@example.invalid' }, 'main']);
  return db;
}
async function adapter(db) {
  const state = { mode: 'ok', calls: [], signedRequests: [] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, dbOrigin);
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    state.calls.push({ method: req.method, path: url.pathname, query: url.search });
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers.apikey !== serviceKey) return send(403, { message: 'isolated adapter: invalid key' });
    if (state.mode === 'error') return send(500, { message: 'AUDIT_DB_DIAGNOSTIC secret=synthetic-only' });
    if (state.mode === 'timeout') return; // The real application must hit its 20 second timeout.
    try {
      if (url.pathname.startsWith('/storage/v1/object/upload/sign/')) {
        state.signedRequests.push({ path: url.pathname, body: raw });
        return send(200, { url: url.pathname.replace('/storage/v1', '') + '?token=synthetic-token' });
      }
      const table = url.pathname === '/rest/v1/vehicles' ? 'vehicles' : url.pathname === '/rest/v1/site_settings' ? 'site_settings' : null;
      if (!table) return send(404, {});
      const params = []; const add = v => { params.push(v); return '$' + params.length; };
      const predicates = [];
      for (const key of ['id', 'version', 'contacts']) if (url.searchParams.has(key)) {
        const value = url.searchParams.get(key); if (!value.startsWith('eq.')) throw new Error('unsupported operator');
        predicates.push(`"${key}"=${add(key === 'contacts' ? JSON.parse(value.slice(3)) : value.slice(3))}`);
      }
      const where = predicates.length ? ' where ' + predicates.join(' and ') : '';
      let result;
      if (req.method === 'GET') {
        let sql = `select * from ${table}${where}`;
        if (table === 'vehicles') sql += ' order by created_at desc,id';
        if (url.searchParams.has('limit')) sql += ' limit ' + add(Number(url.searchParams.get('limit')));
        if (url.searchParams.has('offset')) sql += ' offset ' + add(Number(url.searchParams.get('offset')));
        result = await db.query(sql, params);
      } else if (req.method === 'POST' && table === 'vehicles') {
        const body = JSON.parse(raw);
        result = await db.query('insert into vehicles(id,data) values($1,$2) returning *', [body.id, body.data]);
      } else if (req.method === 'PATCH') {
        const body = JSON.parse(raw); const key = table === 'vehicles' ? 'data' : 'contacts';
        const ref = add(body[key]); result = await db.query(`update ${table} set ${key}=${ref}${where} returning *`, params);
      } else if (req.method === 'DELETE') result = await db.query(`delete from ${table}${where} returning *`, params);
      else return send(405, {});
      const single = req.headers.accept?.includes('vnd.pgrst.object');
      send(200, single ? result.rows[0] ?? null : result.rows);
    } catch (error) { send(error.code === '23505' ? 409 : 400, { code: error.code, message: error.message }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(54329, '127.0.0.1', resolve); });
  return { state, server };
}
module.exports = { root, origin, dbOrigin, sessionSecret, serviceKey, load, synthetic, database, adapter };
