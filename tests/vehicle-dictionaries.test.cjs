const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'module', code)(name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(file), name + '.ts'))) : require(name), mod.exports, mod);
  return mod.exports;
}
const { vehicleBrands, vehicleOptions } = load('lib/vehicle-dictionaries.ts');
const { cars } = load('lib/cars.ts');
const { isCar, publicCar, writeCar, readCars, carsKey, catalogOptions } = load('lib/site-data.ts');
const { normalizeCarText, updateCarText, localizeCar, editableCarText, modelLabel } = load('lib/car-translations.ts');
const { initialAdvancedFilters, matchesAdvanced } = load('lib/vehicle-filters.ts');
const { optionId, specSelects, specNumbers, carNumeric } = load('lib/vehicle-specs.ts');
const { translate, carCount, parseLocale } = load('lib/i18n.ts');
const { readMarketFilters, filterMarketCars, marketQuery, marketDefaults } = load('lib/marketplace-filters.ts');

test('marketplace URL state restores multiple fuels, canonical brands and ordering without changing records', () => {
  const demo = require('../fixtures/demo-cars.json');
  const filters = { ...marketDefaults, fuelType: [optionId('fuelType', 'Gasoline'), optionId('fuelType', 'Pure electric')].join('|'), maxPrice: '30000', sort: 'desc' };
  assert.deepEqual(readMarketFilters(new URLSearchParams(marketQuery(filters))), filters);
  assert.deepEqual(filterMarketCars(demo, filters).map(car => car.id), ['DEMO-1', 'DEMO-2']);
  assert.deepEqual(filterMarketCars(demo, { ...marketDefaults, brand: 'Mercedes-Benz' }).map(car => car.id), ['DEMO-1']);
  assert.equal(filterMarketCars(demo, { ...marketDefaults, minPrice: '30000', maxPrice: '20000' }).length, 0);
  assert.equal(filterMarketCars(demo, { ...marketDefaults, condition: 'Новый|С пробегом' }).length, 5);
});

test('marketplace query parser rejects invalid enum/range values and bounds pagination', () => {
  const parsed = readMarketFilters(new URLSearchParams('fuelType=unknown&condition=broken&sort=bad&page=-2&minPrice=NaN&maxYear=2026&query=海豹'));
  assert.equal(parsed.fuelType, ''); assert.equal(parsed.condition, ''); assert.equal(parsed.sort, 'asc'); assert.equal(parsed.page, '1'); assert.equal(parsed.minPrice, '');
  assert.equal(parsed.maxYear, '2026'); assert.equal(parsed.query, '海豹');
  assert.equal(readMarketFilters(new URLSearchParams('page=99999999999')).page, '100000');
});

function fixture() {
  return {
    ...cars[0], id: 'QA-DICTIONARIES', price: 25000,
    specs: { ...Object.fromEntries(specSelects.map(([key]) => [key, vehicleOptions[key][0].id])),
      displacement: 2, mileageKm: 0, powerHp: 150, acceleration: 8.4, fuelConsumption: 6.5,
      batteryCapacity: 73.5, range: 650, officialPrice: 250000, registrationDate: '2026-10-15' },
    featureTags: [vehicleOptions.featureTags[0].id], listedAt: '2026-10-15', carCode: 'SOURCE-123', fobPrice: 27000,
    translations: { ru: { trim: 'Полная', remark: 'Описание' }, en: { trim: 'Premium', remark: 'Description' }, zh: { trim: '顶配', remark: '描述' } },
  };
}

test('models are scoped to the canonical brand and labels change without changing their filter values', () => {
  const sample = [
    { ...cars[0], brand: 'Mercedes-Benz', model: 'Shared', translations: { zh: { model: '奔驰车型' } } },
    { ...cars[1], brand: 'Mercedes Benz', model: 'Second' },
    { ...cars[2], brand: 'BYD', model: 'Shared', translations: { zh: { model: '比亚迪车型' } } },
  ];
  assert.deepEqual(catalogOptions(sample, 'Mercedes Benz').models, ['Second', 'Shared']);
  assert.deepEqual(catalogOptions(sample, 'BYD').models, ['Shared']);
  assert.deepEqual(catalogOptions(sample, 'No cars').models, []);
  assert.equal(modelLabel('Shared', sample, 'zh', 'BYD'), '比亚迪车型');
  assert.equal(modelLabel('Shared', sample, 'zh', 'Mercedes Benz'), '奔驰车型');
});

test('demo cars validate and include translated content and different powertrains', () => {
  const demo = require('../fixtures/demo-cars.json');
  assert.equal(demo.length, 5);
  assert.equal(new Set(demo.map(car => car.id)).size, 5);
  assert.equal(new Set(demo.map(car => car.specs.fuelType)).size, 4);
  for (const car of demo) {
    assert.ok(isCar(car), car.id);
    for (const locale of ['ru', 'en', 'zh']) {
      assert.ok(car.translations[locale].remark);
      assert.equal(localizeCar(car, locale).title, car.translations[locale].title);
    }
  }
});

test('all source entries are represented, synonyms share stable filter identities, service brands are not selectable', () => {
  assert.equal(vehicleBrands.length, 628);
  assert.equal(vehicleBrands.filter(item => !item.selectable).length, 5);
  assert.equal(Object.values(vehicleOptions).flat().reduce((count, option) => count + option.sources.length, 0), 162);
  assert.equal(optionId('fuelType', 'Plug-in hybrid'), optionId('fuelType', 'plug-in hybrid'));
  assert.equal(optionId('bodyType', 'SUV/SUV'), optionId('bodyType', 'SUV'));
  for (const group of Object.values(vehicleOptions)) {
    assert.equal(new Set(group.map(option => option.id)).size, group.length);
    for (const option of group) for (const locale of ['ru', 'en', 'zh']) assert.ok(option[locale].trim());
  }
});

test('one stored selection is localized without changing data or filtering across languages', () => {
  const car = fixture(); car.specs.fuelType = optionId('fuelType', 'Gasoline');
  const snapshot = JSON.stringify(car);
  for (const locale of ['ru', 'en', 'zh']) {
    assert.equal(localizeCar(car, locale).trim, car.translations[locale].trim);
    assert.equal(localizeCar(car, locale).remark, car.translations[locale].remark);
    assert.ok(matchesAdvanced(car, { ...initialAdvancedFilters, fuelType: car.specs.fuelType, minMileage: '0', maxMileage: '0' }));
  }
  assert.equal(JSON.stringify(car), snapshot);
  assert.equal(localizeCar(car, 'en').drive, vehicleOptions.driveType[0].en);
  assert.equal(localizeCar(car, 'zh').drive, vehicleOptions.driveType[0].zh);
  assert.equal(localizeCar(car, 'en').mileage, '0 km');
  assert.equal(localizeCar(car, 'zh').mileage, '0 公里');
});

test('Chinese-only text falls back honestly and adding English preserves Chinese, Russian and structured values', () => {
  let car = { ...fixture(), model: '', trim: '', translations: { zh: { model: '测试车型', trim: '顶配' } } };
  car = normalizeCarText(car);
  assert.equal(localizeCar(car, 'en').model, '测试车型');
  car = normalizeCarText(updateCarText(car, 'en', 'model', 'Test model'));
  assert.equal(localizeCar(car, 'en').model, 'Test model');
  assert.equal(localizeCar(car, 'zh').model, '测试车型');
  assert.equal(editableCarText(car, 'ru', 'model'), '');
  assert.equal(car.translations.ru?.model, undefined);
  assert.equal(car.specs.batteryCapacity, 73.5);
  assert.ok(isCar(car));
  const memory = new Map([[carsKey, '[]']]);
  global.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  writeCar(car);
  assert.deepEqual(readCars()[0], car);
});

test('combined filters handle every category, numeric boundaries, unknown mileage and multilingual searches', () => {
  const car = fixture();
  const filters = { ...initialAdvancedFilters, ...Object.fromEntries(specSelects.map(([key]) => [key, car.specs[key]])), featureTags: car.featureTags[0], minPrice: '25000', maxPrice: '25000', minYear: '2024', maxYear: '2024', minMileage: '0', maxMileage: '0', minPower: '150', maxPower: '150', query: '顶配' };
  assert.ok(matchesAdvanced(car, filters));
  for (const [key] of specSelects) {
    assert.equal(matchesAdvanced({ ...car, specs: { ...car.specs, [key]: vehicleOptions[key][1].id } }, filters), false, key);
  }
  assert.equal(matchesAdvanced(car, { ...filters, minPrice: '25001' }), false);
  assert.equal(matchesAdvanced(car, { ...filters, maxPower: '149' }), false);
  assert.equal(matchesAdvanced({ ...car, specs: undefined, mileage: 'По запросу' }, { ...initialAdvancedFilters, maxMileage: '100' }), false);
  assert.equal(carNumeric({ ...car, specs: undefined, mileage: '6 800 км' }, 'mileageKm'), 6800);
  assert.equal(carNumeric({ ...car, specs: undefined, mileage: '60,000 km' }, 'mileageKm'), 60000);
});

test('English covers every existing interface dictionary key and locale persistence accepts all three languages', () => {
  const { en } = load('lib/en.ts'); const { zh } = load('lib/zh.ts');
  assert.deepEqual(Object.keys(zh).filter(key => !en[key]), []);
  assert.equal(translate('В наличии', 'en'), 'In stock');
  assert.equal(translate('Здравствуйте! Интересует {name}. Номер объявления: {id}. Год: {year}. Цена: ${price}. Статус: {status}.', 'en', { name: 'Test', id: '1', year: 2026, price: 25000, status: 'In stock' }), 'Hello! I am interested in Test. Listing ID: 1. Year: 2026. Price: $25000. Availability: In stock.');
  assert.equal(carCount(1, 'en'), '1 car'); assert.equal(carCount(2, 'en'), '2 cars');
  for (const locale of ['ru', 'en', 'zh']) assert.equal(parseLocale(locale), locale);
  assert.equal(parseLocale('invalid'), 'ru');
});

test('new database migration preserves legacy rows and agrees with application validation', async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);');
    for (const name of ['202609140001_catalog.sql', '202609150001_vehicle_integrity.sql']) await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'));
    await db.query('insert into vehicles(id,data) values($1,$2)', [cars[0].id, cars[0]]);
    const before = (await db.query('select * from vehicles')).rows;
    const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202610150001_vehicle_dictionaries.sql'), 'utf8');
    await db.exec(migration); await db.exec(migration);
    assert.deepEqual((await db.query('select * from vehicles')).rows, before);
    const good = fixture();
    const cases = [good, { ...good, specs: {} }, ...specNumbers.flatMap(([key,,min,max]) => [{ ...good, specs: { [key]: min } }, { ...good, specs: { [key]: max } }]),
      { ...good, specs: null }, { ...good, specs: { private: 'secret' } }, { ...good, specs: { fuelType: 'unknown' } }, { ...good, specs: { mileageKm: 0.5 } },
      { ...good, specs: { displacement: -1 } }, { ...good, specs: { batteryCapacity: '73.5' } }, { ...good, specs: { registrationDate: '2026-02-30' } },
      { ...good, featureTags: [good.featureTags[0], good.featureTags[0]] }, { ...good, featureTags: ['unknown'] }, { ...good, featureTags: null },
      { ...good, listedAt: 'not-a-date' }, { ...good, listedAt: '0000-01-01' }, { ...good, fobPrice: 0 }, { ...good, carCode: 'x'.repeat(161) },
      { ...good, translations: { en: { remark: 'x'.repeat(5001) } } }, { ...good, translations: { de: { model: 'Test' } } },
    ];
    for (const car of cases) {
      const sql = (await db.query('select public.is_valid_vehicle_document($1::jsonb,$2) as valid', [JSON.stringify(car), car.id])).rows[0].valid;
      assert.equal(sql, isCar(car), JSON.stringify(car.specs ?? car.translations));
    }
    assert.ok(isCar(good));
    await db.query('insert into vehicles(id,data) values($1,$2)', [good.id, good]);
    const saved = (await db.query('select data from vehicles where id=$1', [good.id])).rows[0].data;
    assert.deepEqual(publicCar(saved), good);
  } finally { await db.close(); }
});
