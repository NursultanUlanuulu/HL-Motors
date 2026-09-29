const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');

const root = path.resolve(__dirname, '..');
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
    // Auth is tested independently. A 401 here proves the real NextRequest
    // passed the origin check; no SDK/fetch/deadline code is replaced.
    if (name === './admin-auth') return { isAdmin: async () => false };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
    return require(name);
  }, mod.exports, mod);
  return mod.exports;
}
const { requireAdmin, readJson, maxJsonBytes, apiError } = load('lib/api-server.ts');
const { withDeadline } = load('lib/request-deadline.ts');
const { getSupabase, withSupabaseDeadline } = load('lib/supabase-server.ts');
const { apiRequest, connectionErrorMessage } = load('lib/cloud-client.ts');
const envKeys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'ADMIN_SESSION_SECRET', 'ADMIN_ALLOWED_ORIGINS'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
let baseUrl, responder, calls;
const server = http.createServer((req, res) => {
  calls.push({ url: req.url, method: req.method });
  responder(req, res);
});
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  calls = [];
  responder = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('[]'); };
  process.env.SUPABASE_URL = baseUrl;
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_api_resilience_test';
  process.env.ADMIN_SESSION_SECRET = 'api-resilience-test-only-secret-32-characters';
  delete process.env.ADMIN_ALLOWED_ORIGINS;
});
afterEach(() => {
  server.closeAllConnections();
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

function nextRequest(origin, headers = {}) {
  return new NextRequest(`${origin}/api/admin/vehicles`, {
    method: 'POST', headers: { host: new URL(origin).host, origin, ...headers },
  });
}
async function statusOf(request) {
  try { await requireAdmin(request); return 200; }
  catch (error) { return apiError(error).status; }
}

test('F04: real NextRequest accepts its localhost, loopback IP, IPv6 and domain origins', async () => {
  for (const origin of ['http://localhost:3107', 'http://127.0.0.1:3107', 'http://[::1]:3107', 'https://motors.example']) {
    const request = nextRequest(origin);
    if (origin.includes('127.0.0.1') || origin.includes('[::1]')) assert.equal(new URL(request.url).hostname, 'localhost');
    assert.equal(await statusOf(request), 401, origin);
  }
});

test('F04: mismatched origins, ports, Host and forwarded headers do not authorize writes', async () => {
  for (const headers of [
    { origin: 'https://evil.example' },
    { origin: 'http://127.0.0.1:3108' },
    { origin: 'http://localhost:3107' },
    { host: 'evil.example', origin: 'http://evil.example' },
    { origin: 'http://evil.example', 'x-forwarded-host': 'evil.example' },
    { origin: 'https://127.0.0.1:3107', 'x-forwarded-proto': 'https' },
    { origin: 'null' },
    { origin: 'http://127.0.0.1:3107/' },
    { origin: '' },
  ]) assert.equal(await statusOf(nextRequest('http://127.0.0.1:3107', headers)), 403, JSON.stringify(headers));
  assert.equal(await statusOf(nextRequest('https://motors.example', { host: 'evil.example', origin: 'https://evil.example' })), 403);
});

test('explicit external origins work behind proxies and malformed configuration fails closed', async () => {
  process.env.ADMIN_ALLOWED_ORIGINS = 'https://motors.example,https://www.motors.example';
  assert.equal(await statusOf(nextRequest('http://localhost:3000', { origin: 'https://motors.example' })), 401);
  assert.equal(await statusOf(nextRequest('http://localhost:3000')), 403);
  process.env.ADMIN_ALLOWED_ORIGINS += ',https://invalid.example/path';
  assert.equal(await statusOf(nextRequest('http://localhost:3000', { origin: 'https://motors.example' })), 403);
});

function jsonRequest(body, headers = {}, signal) {
  return new Request('http://localhost/api', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body, signal, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}
async function jsonStatus(request, allowedKeys) {
  try { await readJson(request, allowedKeys); return 200; }
  catch (error) { return apiError(error).status; }
}
test('JSON parser rejects null, arrays, primitives, invalid UTF-8, unknown keys and malformed lengths', async () => {
  for (const body of ['null', '[]', '1', '"text"', 'true', '{', '{"allowed":1,"extra":2}', '{"__proto__":{}}']) {
    assert.equal(await jsonStatus(jsonRequest(body), ['allowed']), 400, body);
  }
  assert.equal(await jsonStatus(jsonRequest(new Uint8Array([0xff]))), 400);
  assert.equal(await jsonStatus(jsonRequest('{}', { 'content-length': '-1' })), 400);
  assert.equal(await jsonStatus(jsonRequest('{}', { 'content-type': 'text/plain' })), 400);
  assert.deepEqual(await readJson(jsonRequest('{"allowed":1}', { 'content-type': 'Application/JSON; charset=UTF-8' }), ['allowed']), { allowed: 1 });
});

test('streamed JSON is bounded by UTF-8 bytes even with missing or false Content-Length', async () => {
  const exact = JSON.stringify({ value: 'a'.repeat(maxJsonBytes - 12) });
  assert.equal(Buffer.byteLength(exact), maxJsonBytes);
  assert.equal((await readJson(jsonRequest(exact))).value.length, maxJsonBytes - 12);
  assert.equal(await jsonStatus(jsonRequest(exact + ' ', { 'content-length': '1' })), 413);
  assert.equal(await jsonStatus(jsonRequest('{}', { 'content-length': String(maxJsonBytes + 1) })), 413);
  // Under the old character limit, this multibyte document would be accepted.
  const oversized = new TextEncoder().encode(JSON.stringify({ value: '汽'.repeat(100_000) }));
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(oversized); },
    cancel() { cancelled = true; },
  });
  assert.equal(await jsonStatus(jsonRequest(stream)), 413);
  assert.equal(cancelled, true);
});

test('slow request bodies honor their deadline and cancel the underlying reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(readJson(jsonRequest(stream), undefined, { timeoutMs: 30 }), { name: 'TimeoutError' });
  assert.equal(cancelled, true);
});

test('the enclosing operation deadline aborts a request body before its own timer', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const start = performance.now();
  await assert.rejects(withSupabaseDeadline(signal => readJson(jsonRequest(stream), undefined, { signal, timeoutMs: 10_000 }), { timeoutMs: 30 }), { name: 'TimeoutError' });
  assert.ok(performance.now() - start < 1500);
  assert.equal(cancelled, true);
});

test('F09: actual Supabase SDK performs one HTTP attempt on retryable upstream errors', async () => {
  responder = (_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '0' });
    res.end('{"message":"PRIVATE_UPSTREAM_DIAGNOSTIC"}');
  };
  const result = await withSupabaseDeadline(() => getSupabase().from('vehicles').select('id'), { timeoutMs: 2000 });
  assert.equal(result.status, 503);
  assert.equal(calls.length, 1);
  const response = apiError(result.error);
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('PRIVATE_UPSTREAM_DIAGNOSTIC'), false);
});

test('F09: actual SDK response-body hang has one overall deadline and no retries', async () => {
  responder = (_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('['); };
  const start = performance.now();
  await assert.rejects(withSupabaseDeadline(() => getSupabase().from('vehicles').select('id'), { timeoutMs: 100 }), { name: 'TimeoutError' });
  assert.ok(performance.now() - start < 1500);
  assert.equal(calls.length, 1);
});

test('nested auth/database deadlines preserve the earlier parent deadline', async () => {
  let nestedSignal;
  await assert.rejects(withSupabaseDeadline(() => withSupabaseDeadline(signal => {
    nestedSignal = signal;
    return new Promise(() => {});
  }, { timeoutMs: 10_000 }), { timeoutMs: 30 }), { name: 'TimeoutError' });
  assert.equal(nestedSignal.aborted, true);
});

test('caller cancellation propagates through the actual SDK and takes priority over nested timers', async () => {
  const controller = new AbortController();
  const reason = new DOMException('Caller cancelled', 'AbortError');
  responder = () => controller.abort(reason);
  await assert.rejects(withSupabaseDeadline(() => withSupabaseDeadline(() => getSupabase().from('vehicles').select('id')), { signal: controller.signal }), error => error === reason);
  assert.equal(calls.length, 1);
});

test('SDK query abort signals survive the shared fetch wrapper', async () => {
  const controller = new AbortController();
  responder = () => controller.abort(new DOMException('Query cancelled', 'AbortError'));
  const result = await withSupabaseDeadline(() => getSupabase().from('vehicles').select('id').abortSignal(controller.signal));
  assert.equal(result.status, 0);
  assert.match(result.error.message, /Query cancelled/);
  assert.equal(calls.length, 1);
});

test('client deadline includes JSON decoding and preserves explicit cancellation', async () => {
  responder = (_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); };
  await assert.rejects(apiRequest(baseUrl, undefined, 'GET', { timeoutMs: 100 }), { name: 'TimeoutError' });
  const controller = new AbortController();
  const reason = new DOMException('Caller cancelled', 'AbortError');
  controller.abort(reason);
  await assert.rejects(apiRequest(baseUrl, undefined, 'GET', { signal: controller.signal }), error => error === reason);
});

test('client network failure and invalid JSON produce a readable Russian error', async () => {
  responder = req => req.socket.destroy();
  await assert.rejects(apiRequest(baseUrl), { message: connectionErrorMessage });
  responder = (_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>proxy error</html>'); };
  await assert.rejects(apiRequest(baseUrl), { message: connectionErrorMessage });
});

test('client retains actionable API errors and timeout responses have the expected status', async () => {
  const message = 'Контакты изменились. Обновите страницу и повторите.';
  responder = (_req, res) => { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: message })); };
  await assert.rejects(apiRequest(baseUrl), { message });
  assert.equal(apiError(new DOMException('internal detail', 'TimeoutError')).status, 504);
});

test('deadline cannot report success after synchronous cancellation', async () => {
  const controller = new AbortController();
  const reason = new DOMException('Cancelled immediately', 'AbortError');
  await assert.rejects(withDeadline(() => { controller.abort(reason); return Promise.resolve('unsafe success'); }, { signal: controller.signal }), error => error === reason);
});
