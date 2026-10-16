const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '..');
function modules(overrides = {}) {
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
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
      return require(name);
    }, mod.exports, mod);
    return mod.exports;
  }
  return load;
}

const load = modules();
const data = load('lib/site-data.ts');
const { cars, formatPrice, carPriceMax } = load('lib/cars.ts');
const { validateCloudCar } = load('lib/cloud-validation.ts');
const fixture = (id = 'TEST-DATA') => ({ ...cars[1], id, image: 'https://example.invalid/car.png' });

test('strict car input rejects enum coercion, null, extra keys and malformed translated fields', () => {
  assert.ok(cars.every(data.isCar));
  for (const value of [null, [], {},
    { ...fixture(), condition: ['Новый'] }, { ...fixture(), status: ['В наличии'] },
    { ...fixture(), color: ['Белый'] }, { ...fixture(), engine: null },
    { ...fixture(), internal_note: 'PRIVATE' }, { ...fixture(), role: 'admin' },
    { ...fixture(), translations: { zh: { color: ['白色'] } } },
    { ...fixture(), translations: { zh: { internal_note: 'PRIVATE' } } },
    { ...fixture(), translations: { de: { color: 'White' } } },
  ]) {
    assert.equal(data.isCar(value), false);
    assert.throws(() => validateCloudCar(value));
  }
});

test('public read projection excludes private keys without discarding valid legacy content', () => {
  const stored = { ...fixture(), owner_id: 'PRIVATE', internal_note: 'PRIVATE',
    translations: { ru: { color: 'Белый', internal_note: 'PRIVATE' }, zh: { brand: '品牌' }, en: { role: 'PRIVATE' } } };
  const car = data.publicCar(stored);
  assert.equal(car.id, stored.id);
  assert.deepEqual(car.translations, { ru: { color: 'Белый' }, zh: { brand: '品牌' }, en: {} });
  assert.doesNotMatch(JSON.stringify(car), /PRIVATE|owner_id|internal_note/);
  assert.equal(data.publicCar({ ...stored, condition: ['Новый'] }), null);
  assert.equal(data.publicCar({ ...stored, translations: { zh: { brand: 123 } } }), null);
});

test('USD values have an exact integer representation and consistent display limits', () => {
  for (const price of [1, 12345, carPriceMax]) {
    const car = validateCloudCar({ ...fixture(), price });
    assert.equal(JSON.parse(JSON.stringify(car)).price, price);
    assert.equal(Number(formatPrice(price).replaceAll(',', '')), price);
  }
  for (const price of [0, -1, 0.0001, 0.1 + 0.2, 1.5, carPriceMax + 1, 1e100, NaN, Infinity]) {
    assert.throws(() => validateCloudCar({ ...fixture(), price }));
    assert.equal(formatPrice(price), '—');
  }
});

test('bilingual and legacy cars retain optional characteristics within Unicode text limits', () => {
  const car = { ...fixture(), brand: '品牌', model: '车型', color: '😀'.repeat(80),
    translations: { ru: { brand: 'Марка', model: 'Модель' }, zh: { trim: '中文'.repeat(80) } } };
  assert.deepEqual(validateCloudCar(car), car);
  assert.throws(() => validateCloudCar({ ...car, color: '😀'.repeat(81) }));
  assert.equal(data.isCar({ ...car, version: Number.MAX_SAFE_INTEGER }), true);
  assert.equal(data.isCar({ ...car, version: Number.MAX_SAFE_INTEGER + 1 }), false);
});

test('media URL spelling accepted by the API agrees with the database boundary', () => {
  assert.equal(validateCloudCar({ ...fixture(), image: 'HTTPS://example.invalid/car.png' }).image, 'HTTPS://example.invalid/car.png');
  for (const image of ['https:photo', ' https://example.invalid/car.png', 'https://example.invalid/car.png ', 'https://', 'https://[invalid]']) {
    assert.throws(() => validateCloudCar({ ...fixture(), image }));
  }
});

test('stale local contacts cannot undo another editor and damaged local data is retained', () => {
  const memory = new Map();
  const original = global.localStorage;
  global.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  try {
    const first = data.readContacts();
    const second = structuredClone(first);
    data.writeContacts({ ...first, email: 'first@example.invalid' }, first);
    assert.throws(() => data.writeContacts({ ...second, telegram: 'second_editor' }, second), /Контакты изменились/);
    assert.equal(data.readContacts().email, 'first@example.invalid');
    assert.equal(data.readContacts().telegram, first.telegram);
    const damaged = JSON.stringify([{ ...fixture(), condition: ['Новый'] }]);
    memory.set(data.carsKey, damaged);
    assert.throws(() => data.writeCar(fixture('ANOTHER')));
    assert.equal(memory.get(data.carsKey), damaged);
    memory.set(data.carsKey, JSON.stringify([fixture(), fixture()]));
    assert.throws(() => data.readCars());
  } finally {
    if (original === undefined) delete global.localStorage;
    else global.localStorage = original;
  }
});

test('invalid API documents return 400 before any database request', async () => {
  let writes = 0;
  const isolated = modules({
    './admin-auth': { isAdmin: async () => true },
    './supabase-server': { getSupabase: () => { writes++; throw new Error('Unexpected database access'); } },
    '@/lib/supabase-server': { withSupabaseDeadline: async operation => operation() },
  });
  const { POST } = isolated('app/api/admin/vehicles/route.ts');
  const oldOrigins = process.env.ADMIN_ALLOWED_ORIGINS;
  delete process.env.ADMIN_ALLOWED_ORIGINS;
  try {
    for (const body of [null, [], { car: null }, { car: { ...fixture(), condition: ['Новый'] } },
      { car: { ...fixture(), internal_note: 'PRIVATE' } }, { car: { ...fixture(), price: 0.0001 } },
      { car: fixture(), role: 'admin' }]) {
      const response = await POST(new Request('http://localhost:3000/api/admin/vehicles', {
        method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }));
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    assert.equal(writes, 0);
  } finally {
    if (oldOrigins === undefined) delete process.env.ADMIN_ALLOWED_ORIGINS;
    else process.env.ADMIN_ALLOWED_ORIGINS = oldOrigins;
  }
});

test('one malformed stored row does not poison the public catalogue or leak private fields', async () => {
  const rows = [
    { id: 'GOOD', data: { ...fixture('GOOD'), internal_note: 'PRIVATE', translations: { zh: { color: '白色', role: 'PRIVATE' } } }, version: 2 },
    { id: 'BAD', data: { ...fixture('BAD'), condition: ['Новый'] }, version: 1 },
    { id: 'MISMATCH', data: fixture('OTHER'), version: 1 },
    { id: 'EMPTY', data: null, version: 1 },
    { id: 'VERSION', data: fixture('VERSION'), version: Number.MAX_SAFE_INTEGER + 1 },
    { id: 'LAST', data: fixture('LAST'), version: 1 },
  ];
  const query = { select() { return this; }, order() { return this; }, async range() { return { data: rows, error: null }; } };
  const isolated = modules({ './supabase-server': { getSupabase: () => ({ from: () => query }) } });
  const result = await isolated('lib/cloud-repository.ts').listCloudCars();
  assert.deepEqual(result.map(car => car.id), ['GOOD', 'LAST']);
  assert.equal(result[0].version, 2);
  assert.equal(result[0].translations.zh.color, '白色');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|internal_note|role/);
});

test('actual SQL migration upgrades existing data non-destructively and enforces new writes', async t => {
  const db = new PGlite();
  await db.waitReady;
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609150001_vehicle_integrity.sql'), 'utf8');
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202609140001_catalog.sql'), 'utf8'));
    await db.query('insert into vehicles(id,data) values($1,$2)', ['LEGACY-EMPTY', {}]);
    await db.query('insert into vehicles(id,data) values($1,$2)', ['LEGACY-EXTRA', { ...fixture('LEGACY-EXTRA'), internal_note: 'legacy kept for review' }]);
    const before = (await db.query('select * from vehicles order by id')).rows;
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual((await db.query('select * from vehicles order by id')).rows, before);
    const constraints = (await db.query("select convalidated from pg_constraint where conname in ('vehicle_data_valid', 'vehicle_version_safe_integer')")).rows;
    assert.equal(constraints.length, 2);
    assert.ok(constraints.every(row => row.convalidated === false));

    await t.test('missing keys, JSON null, wrong types, private fields and invalid prices fail SQL INSERT and UPDATE', async () => {
      await db.query('insert into vehicles(id,data) values($1,$2)', ['VALID', fixture('VALID')]);
      const without = field => Object.fromEntries(Object.entries(fixture('INVALID')).filter(([key]) => key !== field));
      const invalid = [null, {}, [], without('id'), without('price'), without('condition'), without('year'),
        { ...fixture('INVALID'), condition: ['Новый'] }, { ...fixture('INVALID'), status: null },
        { ...fixture('INVALID'), price: '12345' }, { ...fixture('INVALID'), year: null },
        { ...fixture('INVALID'), price: -1 }, { ...fixture('INVALID'), price: 0.0001 },
        { ...fixture('INVALID'), price: 0.1 + 0.2 }, { ...fixture('INVALID'), price: 100000001 },
        { ...fixture('INVALID'), price: 1e100 }, { ...fixture('INVALID'), role: 'admin' },
        { ...fixture('INVALID'), color: 'x'.repeat(81) }, { ...fixture('INVALID'), translations: { zh: { color: [] } } },
      ];
      for (const document of invalid) {
        await assert.rejects(db.query('insert into vehicles(id,data) values($1,$2)', ['INVALID', document]));
        const update = document && !Array.isArray(document) && Object.hasOwn(document, 'id') ? { ...document, id: 'VALID' } : document;
        await assert.rejects(db.query('update vehicles set data=$1 where id=$2', [update, 'VALID']), undefined, JSON.stringify(update));
      }
      assert.equal((await db.query("select count(*)::integer as n from vehicles where id='INVALID'")).rows[0].n, 0);
      assert.equal((await db.query("select version from vehicles where id='VALID'")).rows[0].version, 1);
    });

    await t.test('SQL stores exact boundary prices, bilingual text and increments versions once', async () => {
      const original = { ...fixture('BOUNDARY'), price: 1, image: 'HTTPS://example.invalid/car.png', color: '😀'.repeat(80), translations: { zh: { brand: '品牌', trim: '中文'.repeat(80) } } };
      const inserted = await db.query('insert into vehicles(id,data) values($1,$2) returning data,version', ['BOUNDARY', original]);
      assert.deepEqual(inserted.rows[0].data, original);
      assert.equal(inserted.rows[0].version, 1);
      const changed = { ...original, price: carPriceMax };
      const updated = await db.query('update vehicles set data=$1 where id=$2 and version=$3 returning data,version', [changed, 'BOUNDARY', 1]);
      assert.equal(updated.rows[0].data.price, 100000000);
      assert.equal(updated.rows[0].version, 2);
      assert.equal((await db.query('update vehicles set data=$1 where id=$2 and version=$3 returning id', [original, 'BOUNDARY', 1])).rows.length, 0);
      assert.equal((await db.query("select data->>'price' as price from vehicles where id='BOUNDARY'")).rows[0].price, '100000000');
      await assert.rejects(db.query('insert into vehicles(id,data,version) values($1,$2,$3)', ['OVERFLOW', fixture('OVERFLOW'), '9007199254740992']));
    });
  } finally { await db.close(); }
});
