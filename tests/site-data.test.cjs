const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', output)(name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')))
    : require(name), mod.exports, mod);
  cache.set(filename, mod.exports);
  return mod.exports;
}
const data = load('lib/site-data.ts');
const { filterAdminCars, initialAdminFilters } = load('lib/catalog-filters.ts');
let memory;
beforeEach(() => {
  memory = new Map();
  global.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
});

test('existing browser catalogue is retained and an intentionally empty catalogue stays empty', () => {
  const seed = data.readCars();
  memory.set(data.carsKey, JSON.stringify([{ ...seed[0], price: 40000 }]));
  assert.equal(data.readCars()[0].price, 40000);
  memory.set(data.carsKey, '[]');
  assert.deepEqual(data.readCars(), []);
});

test('new and edited cars retain characteristics and local media after reading again', () => {
  const car = { ...data.readCars()[0], id: 'TEST', brand: 'New brand', year: 2026, engine: 'Бензин', customsType: 'ТПО', image: 'hl-media:photo', gallery: ['hl-media:photo'], video: 'hl-media:video' };
  data.writeCar(car);
  assert.deepEqual(data.readCars().find(item => item.id === 'TEST'), car);
  data.writeCar({ ...car, price: 45000, color: 'Белый', customsType: 'ГТД' }, car);
  const saved = data.readCars().find(item => item.id === 'TEST');
  assert.equal(saved.price, 45000);
  assert.equal(saved.color, 'Белый');
  assert.equal(saved.customsType, 'ГТД');
  assert.equal(saved.video, 'hl-media:video');
});

test('saving one record preserves a different record changed by another tab', () => {
  const [first, second] = data.readCars();
  data.writeCar({ ...second, price: 50000 }, second);
  data.writeCar({ ...first, price: 60000 }, first);
  assert.equal(data.readCars().find(car => car.id === second.id).price, 50000);
});

test('stale edits and deletes cannot overwrite a newer version', () => {
  const first = data.readCars()[0];
  data.writeCar({ ...first, price: 50000 }, first);
  assert.throws(() => data.writeCar({ ...first, price: 60000 }, first), /другой вкладке/);
  assert.throws(() => data.deleteCar(first), /другой вкладке/);
  assert.equal(data.readCars()[0].price, 50000);
});

test('deleted cars do not return on reload', () => {
  const first = data.readCars()[0];
  data.deleteCar(first);
  assert.equal(data.readCars().some(car => car.id === first.id), false);
});

test('invalid saved data and storage quota failures are not silently overwritten', () => {
  memory.set(data.carsKey, '[null]');
  assert.throws(() => data.readCars());
  assert.equal(memory.get(data.carsKey), '[null]');
  memory.clear();
  const first = data.readCars()[0];
  global.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => data.writeCar({ ...first, price: 40000 }, first), /Quota/);
  assert.equal(data.readCars()[0].price, first.price);
});

test('contact inputs are normalized, persisted and produce the actual public links', () => {
  data.writeContacts({ whatsapp: '+996 (502) 102-270', telegram: 'https://t.me/nur6ultan/', email: ' contact@example.com ' });
  const contacts = data.readContacts();
  assert.equal(data.whatsappLink(contacts, 'Car 1'), 'https://wa.me/996502102270?text=Car%201');
  assert.equal(data.telegramLink(contacts), 'https://t.me/nur6ultan');
  assert.equal(contacts.email, 'contact@example.com');
  assert.throws(() => data.writeContacts({ ...contacts, telegram: 'javascript:alert(1)' }));
  assert.equal(data.readContacts().telegram, 'nur6ultan');
});

test('brand/year options and combined admin filters work with newly added values', () => {
  const base = data.readCars()[0];
  const cars = [{ ...base, id: 'A', brand: 'New brand', year: 2026, price: 40000, vin: 'VIN-TEST' }, { ...base, id: 'B', price: 90000 }];
  assert.ok(data.catalogOptions(cars).brands.includes('New brand'));
  assert.ok(data.catalogOptions(cars).years.includes(2026));
  const filters = { ...initialAdminFilters, brand: 'New brand', year: '2026', condition: base.condition, status: base.status, query: 'vin-test', minPrice: '39000', maxPrice: '41000', sort: 'price-desc' };
  assert.deepEqual(filterAdminCars(cars, filters).map(car => car.id), ['A']);
  assert.deepEqual(filterAdminCars(cars, { ...initialAdminFilters, sort: 'price-desc' }).map(car => car.id), ['B', 'A']);
  assert.equal(cars[0].id, 'A');
});

const { translate, carCount } = load('lib/i18n.ts');
const { localizeCar, updateCarText, normalizeCarText } = load('lib/car-translations.ts');

test('Chinese text can create a vehicle without requiring a Russian translation', () => {
  let car = { ...data.readCars()[0], id: 'CN', brand: '', model: '', trim: '' };
  car = updateCarText(car, 'zh', 'brand', '测试品牌');
  car = updateCarText(car, 'zh', 'model', '测试车型');
  car = updateCarText(car, 'zh', 'trim', '四驱顶配');
  const normalized = normalizeCarText(car);
  data.writeCar(normalized);
  const stored = data.readCars().find(item => item.id === 'CN');
  assert.equal(localizeCar(stored, 'zh').trim, '四驱顶配');
  assert.equal(localizeCar(stored, 'ru').trim, '四驱顶配');
  assert.equal(stored.status, 'В наличии');
});

test('adding or clearing translations preserves the other language and legacy data', () => {
  const car = data.readCars()[0];
  const chinese = normalizeCarText(updateCarText(car, 'zh', 'trim', '四驱顶配'));
  assert.equal(localizeCar(chinese, 'ru').trim, car.trim);
  assert.equal(localizeCar(chinese, 'zh').trim, '四驱顶配');
  data.writeCar(chinese, car);
  const russian = normalizeCarText(updateCarText(chinese, 'ru', 'trim', 'Полная комплектация'));
  data.writeCar(russian, chinese);
  assert.equal(localizeCar(data.readCars()[0], 'ru').trim, 'Полная комплектация');
  assert.equal(localizeCar(data.readCars()[0], 'zh').trim, '四驱顶配');
  const cleared = normalizeCarText(updateCarText(russian, 'zh', 'trim', ''));
  assert.equal(localizeCar(cleared, 'zh').trim, 'Полная комплектация');
});

test('translation validation and Chinese search do not break canonical status filters', () => {
  const car = normalizeCarText(updateCarText(data.readCars()[0], 'zh', 'brand', '极氪'));
  assert.equal(filterAdminCars([car], { ...initialAdminFilters, query: '极氪', status: 'В наличии' }).length, 1);
  assert.throws(() => data.writeCar({ ...car, id: 'INVALID', translations: { zh: { brand: 123 } } }));
  assert.equal(translate('В наличии', 'zh'), '现车');
  assert.equal(translate('В наличии', 'ru'), 'В наличии');
  assert.equal(carCount(21, 'ru'), '21 автомобиль');
  assert.equal(carCount(21, 'zh'), '21 辆车');
  assert.equal(localizeCar(data.readCars()[0], 'zh').mileage, '6 800 公里');
});
