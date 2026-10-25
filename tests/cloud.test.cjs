const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
let signedIn = false;
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  cache.set(filename, mod.exports);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', 'module', output)(name => {
    if (name === 'server-only') return {};
    if (name === './admin-auth') return { isAdmin: async () => signedIn };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
    return require(name);
  }, mod.exports, mod);
  return mod.exports;
}
const validation = load('lib/cloud-validation.ts');
const { cars } = load('lib/cars.ts');
const { defaultContacts } = load('lib/site-data.ts');
const vehicles = load('app/api/admin/vehicles/route.ts');
const contacts = load('app/api/admin/contacts/route.ts');
const media = load('app/api/admin/media/route.ts');
const site = load('app/api/site/route.ts');
const repo = load('lib/cloud-repository.ts');
const { getDataMode } = load('lib/supabase-server.ts');
const originalFetch = global.fetch;
const envKeys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'ADMIN_SESSION_SECRET', 'R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'MEDIA_PUBLIC_URL'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
let requests, responder;
beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
  signedIn = true;
  requests = [];
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
  process.env.ADMIN_SESSION_SECRET = 'test-only-session-secret-32-characters';
  responder = () => Response.json([]);
  global.fetch = async (input, init = {}) => {
    const call = { url: new URL(String(input)), ...init };
    requests.push(call);
    return responder(call);
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
function request(body, method = 'POST', origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/admin/vehicles', {
    method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
  });
}

test('all cloud writes require the existing admin session and matching origin', async () => {
  signedIn = false;
  for (const handler of [vehicles.POST, vehicles.DELETE, contacts.POST, media.POST]) {
    assert.equal((await handler(request({}))).status, 401);
  }
  signedIn = true;
  assert.equal((await vehicles.POST(request({}, 'POST', 'https://untrusted.example'))).status, 403);
  assert.equal((await vehicles.POST(request({}, 'POST', ''))).status, 403);
  assert.equal(requests.length, 0);
});

test('cloud validation preserves bilingual fields but rejects browser-only media and invalid records', () => {
  const car = { ...cars[0], version: 5, translations: { ru: { color: 'Белый' }, zh: { color: '白色' } } };
  const result = validation.validateCloudCar(car);
  assert.deepEqual(result.translations, car.translations);
  assert.equal(result.version, undefined);
  for (const image of ['hl-media:file', 'blob:local-file', 'javascript:alert(1)']) assert.throws(() => validation.validateCloudCar({ ...car, image }));
  assert.throws(() => validation.validateCloudCar({ ...car, price: -1 }));
  assert.throws(() => validation.validateCloudCar({ ...car, translations: { zh: { color: 4 } } }));
  assert.throws(() => validation.requireVersion(undefined));
});

test('create persists both languages; update and delete use atomic version predicates', async () => {
  const car = { ...cars[0], translations: { zh: { brand: '极氪', color: '白色' } } };
  responder = call => {
    assert.equal(call.url.pathname, '/rest/v1/vehicles');
    if (call.method === 'POST') return Response.json({ id: car.id, data: car, version: 1 });
    assert.equal(call.url.searchParams.get('id'), `eq.${car.id}`);
    assert.equal(call.url.searchParams.get('version'), 'eq.1');
    return Response.json(call.method === 'DELETE' ? [] : null);
  };
  const created = await vehicles.POST(request({ car }));
  assert.equal(created.status, 200);
  assert.deepEqual((await created.json()).car.translations, car.translations);
  assert.equal((await vehicles.POST(request({ car, previousVersion: 1 }))).status, 409);
  assert.equal((await vehicles.DELETE(request({ id: car.id, version: 1 }, 'DELETE'))).status, 409);
});

test('duplicate inserts never overwrite an existing cloud vehicle', async () => {
  responder = call => {
    assert.equal(call.method, 'POST');
    assert.equal(new Headers(call.headers).get('Prefer')?.includes('merge-duplicates'), false);
    return Response.json({ code: '23505', message: 'duplicate primary key' }, { status: 409 });
  };
  const response = await vehicles.POST(request({ car: cars[0] }));
  assert.equal(response.status, 409);
});

test('contact edits compare the original stored contacts and reject stale updates', async () => {
  responder = call => {
    assert.equal(call.url.searchParams.get('contacts'), `eq.${JSON.stringify(defaultContacts)}`);
    return Response.json(null);
  };
  const response = await contacts.POST(request({ contacts: { ...defaultContacts, email: 'new@example.com' }, previous: defaultContacts }));
  assert.equal(response.status, 409);
});

test('file signing validates format and size before any storage request', async () => {
  for (const file of [{ type: 'text/html', size: 1 }, { type: 'image/heic', size: 1234 }, { type: 'image/jpeg', size: 16 * 1024 * 1024 }, { type: 'image/png', size: 100 * 1024 * 1024 + 1 }, { type: 'video/mp4', size: 51 * 1024 * 1024 }]) {
    assert.equal((await media.POST(request(file))).status, 400);
  }
  assert.equal(requests.length, 0);
  responder = call => {
    assert.match(call.url.pathname, /^\/storage\/v1\/object\/upload\/sign\/vehicle-media\/vehicles\/[\w-]+\.png$/);
    return Response.json({ url: call.url.pathname.replace('/storage/v1', '') + '?token=test-upload-token' });
  };
  const response = await media.POST(request({ type: 'image/png', size: 100 * 1024 * 1024 }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.uploadUrl, /token=test-upload-token/);
  assert.match(result.publicUrl, /\/object\/public\/vehicle-media\/vehicles\//);
  assert.equal(JSON.stringify(result).includes('sb_secret_test_only'), false);
});

test('public catalogue paginates beyond the API row limit and contains no browser fallback', async () => {
  responder = call => {
    if (call.url.searchParams.get('offset') === '0') return Response.json(Array.from({ length: 500 }, (_, i) => ({ id: `V-${i}`, data: { ...cars[0], id: `V-${i}` }, version: 1 })));
    assert.equal(call.url.searchParams.get('offset'), '500');
    return Response.json([{ id: 'LAST', data: { ...cars[0], id: 'LAST' }, version: 2 }]);
  };
  const result = await repo.listCloudCars();
  assert.equal(result.length, 501);
  assert.equal(result[500].version, 2);
  assert.equal(requests.length, 2);
});

test('partial configuration fails closed; API errors never disclose diagnostics or keys', async () => {
  delete process.env.SUPABASE_URL;
  assert.equal(getDataMode(), 'supabase');
  assert.equal((await site.GET()).status, 503);
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  responder = () => Response.json({ code: '42501', message: 'sensitive diagnostic sb_secret_test_only' }, { status: 403 });
  const response = await site.GET();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sensitive|sb_secret_test_only/);
});
