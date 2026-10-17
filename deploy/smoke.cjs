// Run inside the app container before launch. Credentials stay in its environment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const base = 'https://firstseven-auto.com';
const origin = 'https://firstseven-auto.com';
const common = { host: 'firstseven-auto.com', origin, 'x-forwarded-proto': 'https' };
let cookie = '', created, mediaKey;
function hiddenForm(html) {
  const form = new FormData();
  const unescape = value => value.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
  for (const tag of html.matchAll(/<input\b[^>]*>/g)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], unescape(m[2])]));
    if (attributes.type === 'hidden' && attributes.name) form.append(attributes.name, attributes.value || '');
  }
  return form;
}
async function request(path, method = 'GET', payload, authenticated = true) {
  return fetch(base + path, { method, redirect: 'manual', signal: AbortSignal.timeout(30000),
    headers: { ...common, ...(authenticated && cookie ? { cookie } : {}), ...(payload ? { 'content-type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined });
}
async function main() {
  const site = await (await request('/api/site')).json();
  assert.equal(site.cars.length, 0, 'Expected empty launch catalogue');
  assert.ok(JSON.stringify(site.contacts).includes('8615060761179'));
  for (const route of ['/', '/catalog', '/contacts', '/delivery', '/about', '/faq', '/login']) {
    assert.equal((await request(route)).status, 200, route);
  }
  assert.equal((await request('/api/admin/vehicles', 'POST', {}, false)).status, 401);
  const loginHtml = await (await request('/login')).text();
  const form = hiddenForm(loginHtml);
  assert.ok([...form.keys()].some(key => key.startsWith('$ACTION_')));
  form.set('username', 'admin'); form.set('password', process.env.ADMIN_PASSWORD);
  const login = await fetch(base + '/login', { method: 'POST', headers: common, body: form, redirect: 'manual' });
  assert.equal(login.status, 303, 'Login must redirect');
  cookie = login.headers.getSetCookie().find(value => value.startsWith('hl-admin-session='))?.split(';')[0];
  assert.ok(cookie, 'Admin session must be set');
  assert.equal((await request('/admin/vehicles')).status, 200);
  console.log('PASS routes, empty catalogue, contacts, unauthenticated protection, administrator login');
  const bytes = fs.readFileSync('/app/public/motors-logo.png');
  const signature = await request('/api/admin/media', 'POST', { type: 'image/png', size: bytes.length });
  assert.equal(signature.status, 200);
  const signed = await signature.json();
  mediaKey = new URL(signed.publicUrl).pathname.slice(1);
  const preflight = await fetch(signed.uploadUrl, { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,cache-control' } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin, 'R2 CORS');
  const upload = await fetch(signed.uploadUrl, { method: 'PUT', headers: { ...signed.headers, Origin: origin }, body: bytes });
  assert.ok(upload.ok, 'R2 presigned PUT');
  console.log('PASS R2 signed photo upload and production CORS');
  if (process.env.CHECK_PUBLIC_MEDIA === 'true') {
    const publicPhoto = await fetch(signed.publicUrl, { signal: AbortSignal.timeout(20000) });
    assert.equal(publicPhoto.status, 200, 'Public media domain');
    assert.deepEqual(Buffer.from(await publicPhoto.arrayBuffer()), bytes);
    const optimized = await request('/_next/image?url=' + encodeURIComponent(signed.publicUrl) + '&w=320&q=70');
    assert.equal(optimized.status, 200, 'Next image optimization');
    assert.ok(optimized.headers.get('content-type')?.startsWith('image/'));
    console.log('PASS public R2 image and Next image optimization');
  }
  const car = { id: 'LAUNCH-QA-' + Date.now(), brand: 'Toyota', model: 'Camry', trim: 'QA', price: 10000,
    year: 2025, mileage: '0 км', status: 'Под заказ', condition: 'Новый', city: 'Китай', power: '200 л.с.',
    drive: 'Передний', image: signed.publicUrl, gallery: [signed.publicUrl], title: 'Проверка запуска — будет удалена' };
  const save = await request('/api/admin/vehicles', 'POST', { car });
  assert.equal(save.status, 200, 'Create test car'); created = (await save.json()).car;
  assert.equal(created.version, 1);
  const edit = await request('/api/admin/vehicles', 'POST', { car: { ...created, price: 10001 }, previousVersion: 1 });
  assert.equal(edit.status, 200); created = (await edit.json()).car;
  assert.equal(created.version, 2);
  assert.equal((await request('/api/admin/vehicles', 'POST', { car, previousVersion: 1 })).status, 409);
  console.log('PASS PostgreSQL create, edit and stale-version rejection');
}
async function cleanup() {
  if (created) {
    assert.equal((await request('/api/admin/vehicles', 'DELETE', { id: created.id, version: created.version })).status, 200);
    console.log('PASS test car removed');
  }
  if (mediaKey) {
    const s3 = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
    try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: mediaKey })); }
    finally { s3.destroy(); }
    console.log('PASS temporary upload removed');
  }
  if (cookie) {
    const admin = await (await request('/admin/vehicles')).text();
    const logoutForm = [...admin.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].find(m => m[0].includes('$ACTION_ID_'));
    assert.ok(logoutForm, 'Logout action');
    const logout = await fetch(base + '/admin/vehicles', { method: 'POST', headers: { ...common, cookie },
      body: hiddenForm(logoutForm[0]), redirect: 'manual' });
    assert.equal(logout.status, 303);
    assert.equal((await request('/api/admin/vehicles', 'POST', {})).status, 401);
    console.log('PASS logout revoked session');
  }
}
(async () => { try { await main(); } finally { await cleanup(); } })().catch(error => {
  console.error('Smoke check failed:', error.message); process.exitCode = 1;
});
