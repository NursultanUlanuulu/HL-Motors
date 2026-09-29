// HTTP regression checks against only the disposable security-preview.cjs.
// This uses server-rendered forms, not browser automation or a real Supabase DB.
const assert = require('node:assert/strict');
const { origin, dbOrigin, password, synthetic } = require('./security-preview.cjs');
let cookie = '';
const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function formData(form) {
  const data = new FormData();
  for (const input of form.matchAll(/<input\b[^>]*>/g)) {
    if (!/type="hidden"/.test(input[0])) continue;
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    const value = input[0].match(/value="([^"]*)"/)?.[1] ?? '';
    if (name) data.append(decode(name), decode(value));
  }
  return data;
}
async function request(endpoint, body, options = {}) {
  return fetch((options.origin ?? origin) + endpoint, {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'), redirect: 'manual',
    signal: AbortSignal.timeout(26000),
    headers: { Origin: options.origin ?? origin, ...(cookie ? { Cookie: cookie } : {}), ...(body instanceof FormData || body === undefined ? {} : { 'content-type': 'application/json' }), ...options.headers },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}
async function login(value) {
  const html = await (await request('/login')).text();
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0];
  assert.ok(form, 'SSR login form is available');
  const data = formData(form); data.set('username', 'admin'); data.set('password', value);
  return request('/login', data);
}
async function control(value) {
  const response = await fetch(dbOrigin + '/__qa/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal(response.status, 200);
}
async function main() {
  const state = await (await fetch(dbOrigin + '/__qa/state')).json();
  assert.deepEqual(state.vehicles.map(row => row.id), ['QA-LONG', 'QA-NORMAL'], 'refuse to test against anything except untouched synthetic preview');
  await control({ mode: 'ok', clearAttempts: true });
  try {
    assert.equal((await request('/api/admin/vehicles', {})).status, 401);
    assert.equal((await request('/api/admin/vehicles', {}, { origin: 'http://127.0.0.1:3107' })).status, 401, 'same-origin IP requests reach authentication');
    assert.equal((await request('/api/admin/vehicles', {}, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
    const weak = await login('123456!');
    assert.equal(weak.status, 200); assert.match(await weak.text(), /Неверный логин или пароль/);
    const signedIn = await login(password);
    assert.equal(signedIn.status, 303); assert.equal(signedIn.headers.get('location'), '/admin/vehicles');
    const setCookie = signedIn.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /Secure/i); assert.match(setCookie, /SameSite=lax/i);
    cookie = setCookie.split(';')[0];
    assert.equal((await request('/admin/vehicles')).status, 200);
    const car = synthetic('QA-HTTP-CREATED');
    for (const body of [null, { car: { ...car, condition: ['Новый'] } }, { car: { ...car, internal_note: 'private' } }, { car: { ...car, price: 0.0001 } }, { car: { ...car, price: 1e100 } }]) {
      assert.equal((await request('/api/admin/vehicles', body)).status, 400);
    }
    const createdResponse = await request('/api/admin/vehicles', { car });
    assert.equal(createdResponse.status, 200); const created = (await createdResponse.json()).car;
    assert.equal(created.version, 1);
    const updatedResponse = await request('/api/admin/vehicles', { car: { ...created, price: 54321 }, previousVersion: 1 });
    assert.equal(updatedResponse.status, 200); const updated = (await updatedResponse.json()).car;
    assert.equal(updated.version, 2); assert.equal(updated.price, 54321);
    assert.equal((await request('/api/admin/vehicles', { car: { ...created, price: 99999 }, previousVersion: 1 })).status, 409);
    const publicData = await (await request('/api/site')).json();
    assert.equal(publicData.cars.find(row => row.id === car.id).price, 54321);
    const contacts = publicData.contacts;
    const editedContacts = { ...contacts, email: 'updated@example.invalid' };
    assert.equal((await request('/api/admin/contacts', { contacts: editedContacts, previous: contacts })).status, 200);
    assert.equal((await request('/api/admin/contacts', { contacts: { ...contacts, email: 'stale@example.invalid' }, previous: contacts })).status, 409);
    assert.equal((await request('/api/admin/contacts', { contacts, previous: editedContacts })).status, 200);
    assert.equal((await request('/api/admin/vehicles', { id: car.id, version: 1 }, { method: 'DELETE' })).status, 409);
    assert.equal((await request('/api/admin/vehicles', { id: car.id, version: 2 }, { method: 'DELETE' })).status, 200);
    const adminHtml = await (await request('/admin/vehicles')).text();
    const logoutForm = [...adminHtml.matchAll(/<form\b[\s\S]*?<\/form>/g)].map(match => match[0]).find(form => form.includes('Выйти'));
    assert.ok(logoutForm, 'SSR logout form is available');
    const signedOut = await request('/admin/vehicles', formData(logoutForm));
    assert.equal(signedOut.status, 303); assert.equal(signedOut.headers.get('location'), '/login');
    // Deliberately replay the original cookie: the persistent session is gone.
    assert.equal((await request('/api/admin/vehicles', { car })).status, 401);
    const deniedPage = await request('/admin/vehicles');
    assert.equal(deniedPage.status, 307); assert.equal(deniedPage.headers.get('location'), '/login');
    cookie = '';
    for (let n = 0; n < 3; n++) assert.match(await (await login('wrong-password')).text(), /Неверный логин или пароль/);
    assert.match(await (await login(password)).text(), /Слишком много попыток входа/);
    const finalState = await (await fetch(dbOrigin + '/__qa/state')).json();
    assert.deepEqual(finalState.vehicles.map(row => row.id), ['QA-LONG', 'QA-NORMAL']);
    assert.deepEqual(finalState.contacts, state.contacts); assert.equal(finalState.sessions, 0);
    console.log('PASS: production HTTP login, cookie flags, logout/replay, rate limit, IP origin, strict DTO, vehicle CRUD/version conflicts, contact CAS and public readback. Synthetic data restored.');
  } finally { await control({ mode: 'ok', clearAttempts: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
