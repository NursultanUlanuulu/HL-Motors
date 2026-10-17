const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { bootstrap } = require('../scripts/postgres-bootstrap.cjs');
function modules(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(__dirname, '..', file);
    if (cache.has(file)) return cache.get(file);
    const mod = { exports: {} }; cache.set(file, mod.exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'exports', 'module', js)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
      return require(name);
    }, mod.exports, mod);
    return mod.exports;
  }
  return load;
}

test('PostgreSQL schema, restricted app role, version conflicts, contacts and shared authentication', async () => {
  const db = new PGlite(); await db.waitReady;
  const client = { async query(sql, values) {
    if (!values && sql.includes(';')) { const result = await db.exec(sql); return result.at(-1); }
    return db.query(sql, values);
  } };
  try {
    await bootstrap(client, 'a'.repeat(64)); await bootstrap(client, 'a'.repeat(64));
    const role = (await db.query("select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls from pg_roles where rolname='hl_app'")).rows[0];
    assert.deepEqual(role, { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false });
    await db.exec('set role hl_app;');
    const query = async (sql, values) => { const result = await db.query(sql, values); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; };
    const load = modules({ './postgres': { pgQuery: query }, './supabase-server': { getDataMode: () => 'postgres' } });
    const repo = load('lib/cloud-repository.ts');
    const store = load('lib/admin-auth-store.ts').getAdminAuthStore();
    const car = { ...load('lib/cars.ts').cars[0], id: 'PG-QA', version: undefined };
    delete car.version;
    assert.deepEqual(await repo.listCloudCars(), []);
    const created = await repo.saveCloudCar(car); assert.equal(created.version, 1);
    await assert.rejects(repo.saveCloudCar(car), e => e.status === 409);
    const edited = await repo.saveCloudCar({ ...car, price: car.price + 1 }, 1); assert.equal(edited.version, 2);
    await assert.rejects(repo.saveCloudCar(car, 1), e => e.status === 409);
    await assert.rejects(repo.deleteCloudCar(car.id, 1), e => e.status === 409);
    const original = await repo.cloudContacts();
    const next = { ...original, whatsappName: 'Updated manager' };
    await repo.saveCloudContacts(next, original);
    await assert.rejects(repo.saveCloudContacts(original, original), e => e.status === 409);
    const tokenHash = 'a'.repeat(64), credentialVersion = 'b'.repeat(64);
    await store.createSession({ tokenHash, credentialVersion, expiresAt: Date.now() + 60000 });
    assert.equal(await store.hasSession(tokenHash, credentialVersion), true);
    assert.equal(await store.hasSession(tokenHash, 'c'.repeat(64)), false);
    await store.revokeSession(tokenHash); assert.equal(await store.hasSession(tokenHash, credentialVersion), false);
    for (let i = 0; i < 5; i++) assert.equal(await store.reserveAttempt('d'.repeat(64), true), 0);
    assert.ok(await store.reserveAttempt('d'.repeat(64), true) > 0);
    await assert.rejects(db.query('select * from public.admin_login_attempts'), /permission denied/);
    await repo.deleteCloudCar(car.id, 2); assert.deepEqual(await repo.listCloudCars(), []);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.vehicles'), /permission denied/);
  } finally { await db.close(); }
});

test('R2 signing binds file length and type, hides credentials and uses a five-minute URL', async () => {
  const env = { R2_ENDPOINT: 'https://test-account.r2.cloudflarestorage.com', R2_ACCESS_KEY_ID: 'test-access', R2_SECRET_ACCESS_KEY: 'test-secret', R2_BUCKET: 'test-media', MEDIA_PUBLIC_URL: 'https://media.example.com' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    const { signR2Upload } = modules()('lib/r2-storage.ts');
    const signed = await signR2Upload('vehicles/test.jpg', 'image/jpeg', 1234);
    const url = new URL(signed.uploadUrl);
    assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
    const headers = url.searchParams.get('X-Amz-SignedHeaders');
    for (const name of ['content-length', 'content-type', 'cache-control']) assert.ok(headers.includes(name));
    assert.equal(signed.publicUrl, 'https://media.example.com/vehicles/test.jpg');
    assert.equal(signed.raw, true);
    assert.doesNotMatch(JSON.stringify(signed), /test-secret/);
    delete process.env.R2_BUCKET;
    await assert.rejects(signR2Upload('vehicles/test.jpg', 'image/jpeg', 1234), e => e.status === 503);
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('PostgreSQL abort destroys a busy connection and releases a late connection without running SQL', async () => {
  const previousPool = globalThis.hlPostgresPool;
  let controller = new AbortController();
  const releases = [];
  let started;
  const queryStarted = new Promise(resolve => { started = resolve; });
  globalThis.hlPostgresPool = {
    connect: async () => ({
      query: () => { started(); return new Promise(() => {}); },
      release: destroy => releases.push(destroy),
    }),
  };
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://synthetic/test';
  try {
    const { pgQuery } = modules({ './supabase-server': { currentDataSignal: () => controller.signal } })('lib/postgres.ts');
    const busy = pgQuery('select 1');
    await queryStarted;
    controller.abort(new Error('test cancellation'));
    await assert.rejects(busy, /test cancellation/);
    assert.deepEqual(releases, [true]);

    controller = new AbortController();
    let finishConnection;
    globalThis.hlPostgresPool = { connect: () => new Promise(resolve => { finishConnection = resolve; }) };
    const pending = pgQuery('select 1');
    controller.abort(new Error('cancel while connecting'));
    await assert.rejects(pending, /cancel while connecting/);
    let queryCount = 0;
    finishConnection({ query: () => { queryCount++; }, release: destroy => releases.push(destroy) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queryCount, 0);
    assert.deepEqual(releases, [true, true]);
  } finally {
    if (previousPool === undefined) delete globalThis.hlPostgresPool; else globalThis.hlPostgresPool = previousPool;
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
  }
});
