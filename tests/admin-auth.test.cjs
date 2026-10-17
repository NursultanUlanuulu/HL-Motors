const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { NextRequest } = require('next/server');

const root = path.resolve(__dirname, '..');
const password = 'Synthetic-only-Password9!';
const envKeys = ['DATABASE_URL', 'NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'ADMIN_LOCAL_AUTH', 'ADMIN_TRUSTED_IP_HEADER', 'ADMIN_ALLOWED_ORIGINS'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = global.fetch;
const jar = new Map();
let requestHeaders, calls, unavailable, db;
const cookieStore = {
  get: name => jar.has(name) ? { value: jar.get(name).value } : undefined,
  set: (name, value, options) => jar.set(name, { value, options }),
  delete: name => jar.delete(name),
};
function load(relative, cache = new Map()) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'module', code)(name => {
    if (name === 'server-only') return {};
    if (name === 'next/headers') return { cookies: async () => cookieStore, headers: async () => requestHeaders };
    if (name === 'next/navigation') return { redirect: destination => { throw new Error(`REDIRECT:${destination}`); } };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', cache);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name + '.ts')), cache);
    return require(name);
  }, mod.exports, mod);
  return mod.exports;
}
const cache = new Map();
const auth = load('lib/admin-auth.ts', cache);
const actions = load('app/actions/auth.ts', cache);
const vehicles = load('app/api/admin/vehicles/route.ts', cache);
const { withSupabaseDeadline } = load('lib/supabase-server.ts', cache);
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609150003_admin_auth.sql'), 'utf8');

// Real PostgreSQL tables, permissions and RPC; only the HTTP transport and Next
// cookie/redirect context are substituted. No external database is contacted.
async function transport(input, init = {}) {
  calls.push({ url: String(input), method: init.method ?? 'GET' });
  if (unavailable) throw new Error('synthetic database outage');
  assert.equal(new Headers(init.headers).get('apikey'), 'synthetic-service-key');
  const url = new URL(String(input));
  const body = init.body ? JSON.parse(init.body) : undefined;
  try {
    const result = await db.transaction(async tx => {
      await tx.exec('set local role service_role');
      if (url.pathname === '/rest/v1/rpc/reserve_admin_login_attempt') {
        return (await tx.query('select public.reserve_admin_login_attempt($1,$2) as retry', [body.p_source, body.p_admin])).rows[0].retry;
      }
      assert.equal(url.pathname, '/rest/v1/admin_sessions', 'revoked authentication must not reach any vehicle write');
      if (init.method === 'POST') {
        await tx.query('insert into public.admin_sessions(token_hash,credential_version,expires_at) values($1,$2,$3)', [body.token_hash, body.credential_version, body.expires_at]);
        return null;
      }
      const token = url.searchParams.get('token_hash')?.replace(/^eq\./, '');
      if (init.method === 'DELETE') {
        await tx.query('delete from public.admin_sessions where token_hash=$1', [token]);
        return null;
      }
      const result = await tx.query('select token_hash from public.admin_sessions where token_hash=$1 and credential_version=$2 and expires_at>$3', [token, url.searchParams.get('credential_version').replace(/^eq\./, ''), url.searchParams.get('expires_at').replace(/^gt\./, '')]);
      return result.rows[0] ?? null;
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ code: error.code, message: error.message }, { status: 400 });
  }
}
function form(value = password, username = 'admin') {
  const data = new FormData(); data.set('username', username); data.set('password', value); return data;
}
async function login() {
  await assert.rejects(actions.login({ error: '' }, form()), /REDIRECT:\/admin\/vehicles/);
  return jar.get(auth.sessionCookie).value;
}
function mutation() {
  return new NextRequest('http://localhost:3000/api/admin/vehicles', { method: 'POST', headers: { Origin: 'http://localhost:3000', Host: 'localhost:3000', 'Content-Type': 'application/json' }, body: '{}' });
}
before(async () => {
  db = new PGlite(); await db.waitReady;
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec(migration);
});
beforeEach(async () => {
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'production';
  process.env.SUPABASE_URL = 'https://synthetic.example.invalid';
  process.env.SUPABASE_SECRET_KEY = 'synthetic-service-key';
  process.env.ADMIN_SESSION_SECRET = 'synthetic-session-secret-at-least-32-characters';
  process.env.ADMIN_PASSWORD = password;
  delete process.env.ADMIN_LOCAL_AUTH;
  delete process.env.ADMIN_TRUSTED_IP_HEADER;
  delete process.env.ADMIN_ALLOWED_ORIGINS;
  delete global.hlLocalAdminSessions; delete global.hlLocalLoginAttempts;
  requestHeaders = new Headers(); calls = []; unavailable = false; jar.clear();
  global.fetch = transport;
  await db.exec('delete from public.admin_sessions; delete from public.admin_login_attempts;');
});
after(async () => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  delete global.hlLocalAdminSessions; delete global.hlLocalLoginAttempts;
  await db.close();
});

test('production login fails closed for missing, empty or weak password; old fallback is rejected', async () => {
  for (const value of [undefined, '', '123456!', 'password-without-digits!', 'LongPassword123456']) {
    if (value === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = value;
    assert.equal(auth.adminAuthConfigured(), false);
    assert.equal(auth.validCredentials('admin', '123456!'), false);
    assert.deepEqual(await actions.login({ error: '' }, form('123456!')), { error: auth.adminConfigurationError });
    assert.equal(jar.size, 0);
  }
  assert.equal(calls.length, 0);
  process.env.ADMIN_PASSWORD = password;
  assert.equal(auth.validCredentials('admin', password), true);
  assert.equal(auth.validCredentials('admin', '123456!'), false);
  assert.equal(auth.validCredentials('Admin', password), false);
  delete process.env.ADMIN_SESSION_SECRET;
  assert.equal(auth.adminAuthConfigured(), false);
});

test('actual login persists an opaque token hash; logout revokes replay before any write', async () => {
  const token = await login();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.deepEqual(jar.get(auth.sessionCookie).options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 43200 });
  const rows = (await db.query('select * from public.admin_sessions')).rows;
  assert.equal(rows.length, 1); assert.notEqual(rows[0].token_hash, token);
  assert.equal(JSON.stringify(rows).includes(password), false);
  assert.equal(await auth.isAdmin(), true);
  assert.equal(await load('lib/admin-auth.ts').isAdmin(), true, 'second process facade shares the database session');
  await assert.rejects(actions.logout(), /REDIRECT:\/login/);
  assert.equal(jar.size, 0);
  jar.set(auth.sessionCookie, { value: token });
  assert.equal(await auth.isAdmin(), false);
  assert.equal((await vehicles.POST(mutation())).status, 401);
  assert.equal((await db.query('select * from public.admin_sessions')).rows.length, 0);
});

test('password rotation, expiry and legacy stateless cookies cannot authenticate', async () => {
  const token = await login();
  process.env.ADMIN_PASSWORD = 'Rotated-only-Password10!';
  assert.equal(auth.validCredentials('admin', password), false);
  assert.equal(await auth.isAdmin(), false);
  assert.equal((await vehicles.POST(mutation())).status, 401);
  process.env.ADMIN_PASSWORD = password;
  await db.exec("update public.admin_sessions set expires_at = now() - interval '1 second'");
  assert.equal(await auth.isAdmin(), false);
  jar.set(auth.sessionCookie, { value: `${token}.${token}` });
  assert.equal(await auth.isAdmin(), false);
});

test('database outage never enables a local fallback and failed logout retains its cookie for retry', async () => {
  const token = await login(); unavailable = true;
  process.env.ADMIN_LOCAL_AUTH = 'true';
  assert.equal(await auth.isAdmin(), false);
  await assert.rejects(actions.logout(), /Не удалось завершить сеанс/);
  assert.equal(jar.get(auth.sessionCookie).value, token);
  jar.clear();
  assert.deepEqual(await actions.login({ error: '' }, form()), { error: auth.adminUnavailableError });
  assert.equal(jar.size, 0);
});

test('the whole login honors its parent deadline even when the database transport never settles', async () => {
  let signal, requests = 0;
  global.fetch = (_input, init) => { signal = init.signal; requests++; return new Promise(() => {}); };
  const started = performance.now();
  await assert.rejects(withSupabaseDeadline(() => actions.login({ error: '' }, form()), { timeoutMs: 30 }), error => error.name === 'TimeoutError');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(performance.now() - started < 500);
  assert.equal(signal.aborted, true);
  assert.equal(requests, 1);
  assert.equal(jar.size, 0);
});

test('login limits attempts and refuses a correct password while temporarily blocked', async () => {
  for (let n = 0; n < 5; n++) assert.deepEqual(await actions.login({ error: '' }, form('incorrect')), { error: 'Неверный логин или пароль.' });
  assert.deepEqual(await actions.login({ error: '' }, form()), { error: auth.adminRateLimitError });
  assert.equal(jar.size, 0);
  const before = (await db.query('select * from public.admin_login_attempts order by bucket')).rows;
  assert.deepEqual(await actions.login({ error: '' }, form()), { error: auth.adminRateLimitError });
  assert.deepEqual((await db.query('select * from public.admin_login_attempts order by bucket')).rows, before, 'blocked attempts do not extend a lockout');
  await db.exec("update public.admin_login_attempts set resets_at = now() - interval '1 second'");
  await login(); assert.equal(await auth.isAdmin(), true);
});

test('only a configured trusted proxy IP separates source buckets', async () => {
  for (let n = 0; n < 5; n++) assert.equal(await auth.reserveLoginAttempt('admin', new Headers({ 'x-forwarded-for': `192.0.2.${n + 1}` })), 0);
  assert.ok(await auth.reserveLoginAttempt('admin', new Headers({ 'x-forwarded-for': '192.0.2.99' })) > 0);
  await db.exec('delete from public.admin_login_attempts');
  process.env.ADMIN_TRUSTED_IP_HEADER = 'x-real-ip';
  for (let n = 0; n < 5; n++) assert.equal(await auth.reserveLoginAttempt('admin', new Headers({ 'x-real-ip': '192.0.2.1' })), 0);
  assert.ok(await auth.reserveLoginAttempt('admin', new Headers({ 'x-real-ip': '192.0.2.1' })) > 0);
  assert.equal(await auth.reserveLoginAttempt('admin', new Headers({ 'x-real-ip': '192.0.2.2' })), 0);
});

test('SQL reservations are atomic and apply the account ceiling across distinct sources', async () => {
  const source = 'a'.repeat(64);
  const attempts = await Promise.all(Array.from({ length: 12 }, () => db.query('select public.reserve_admin_login_attempt($1,true) as retry', [source])));
  assert.equal(attempts.filter(result => result.rows[0].retry === 0).length, 5);
  await db.exec('delete from public.admin_login_attempts');
  for (let n = 0; n < 30; n++) {
    assert.equal((await db.query('select public.reserve_admin_login_attempt($1,true) as retry', [n.toString(16).padStart(64, '0')])).rows[0].retry, 0);
  }
  assert.ok((await db.query('select public.reserve_admin_login_attempt($1,true) as retry', ['b'.repeat(64)])).rows[0].retry > 0);
  assert.equal((await db.query('select public.reserve_admin_login_attempt($1,false) as retry', ['c'.repeat(64)])).rows[0].retry, 0, 'unknown usernames use only their source bucket');
  await assert.rejects(db.query('select public.reserve_admin_login_attempt($1,true)', ['spoofed']), error => error.code === '22023');
});

test('auth migration is repeatable, preserves sessions, and denies browser roles tables and RPC', async () => {
  await login();
  await db.exec(migration);
  assert.equal(await auth.isAdmin(), true);
  for (const role of ['anon', 'authenticated']) {
    for (const statement of ['select * from public.admin_sessions', 'select * from public.admin_login_attempts', `select public.reserve_admin_login_attempt('${'a'.repeat(64)}',true)`]) {
      await assert.rejects(db.transaction(async tx => { await tx.exec(`set local role ${role}`); return tx.exec(statement); }), error => error.code === '42501');
    }
  }
  assert.deepEqual((await db.query("select relrowsecurity from pg_class where oid in ('public.admin_sessions'::regclass,'public.admin_login_attempts'::regclass)")).rows, [{ relrowsecurity: true }, { relrowsecurity: true }]);
});

test('memory sessions require explicit development opt-in and can never enable production auth', async () => {
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY;
  process.env.ADMIN_LOCAL_AUTH = 'true';
  assert.equal(auth.adminAuthConfigured(), false);
  process.env.NODE_ENV = 'development';
  assert.equal(auth.adminAuthConfigured(), true);
  const token = await login(); assert.equal(await auth.isAdmin(), true);
  await auth.revokeSession(token); assert.equal(await auth.isAdmin(), false);
  assert.equal(calls.length, 0);
});
