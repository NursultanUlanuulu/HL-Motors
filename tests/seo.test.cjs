const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  cache.set(filename, mod.exports);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'module', output)(name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')))
    : require(name), mod.exports, mod);
  return mod.exports;
}
const { vehicleSeo, vehicleStructuredData, jsonLd, catalogMetadata } = load('lib/seo.ts');
const { cars } = load('lib/cars.ts');
test('car snippets use translated vehicle details and custom SEO fields', () => {
  const car = { ...cars[0], model: 'raw model', translations: { ru: { model: 'Test Model' } } };
  assert.match(vehicleSeo(car).title, /Test Model 2024/);
  assert.match(vehicleSeo(car).description, /58,900/);
  assert.equal(vehicleSeo({ ...car, translations: { ru: { metaTitle: 'Custom', metaDescription: 'Custom description' } } }).title, 'Custom — firstseven avto');
  assert.equal(vehicleSeo({ ...car, metaDescription: 'Custom description' }).description, 'Custom description');
});
test('structured data cannot break out of a script tag and retains original values', () => {
  const value = { description: '</script><script>alert(1)</script>&' };
  assert.ok(!jsonLd(value).includes('<'));
  assert.deepEqual(JSON.parse(jsonLd(value)), value);
  const data = vehicleStructuredData(cars[0]);
  assert.equal(data.offers.price, cars[0].price);
  assert.equal(data.offers.priceCurrency, 'USD');
  assert.equal(data.offers.availability, 'https://schema.org/InStock');
});
test('pagination has its own canonical, filter combinations are excluded from indexing', () => {
  assert.equal(catalogMetadata('/catalog', { page: '2', sort: 'desc' }).alternates.canonical, 'https://firstseven-auto.com/catalog?page=2');
  assert.match(catalogMetadata('/catalog', { page: '2' }).title, /страница 2/);
  assert.equal(catalogMetadata('/', { page: '-2', back: '/catalog' }).alternates.canonical, 'https://firstseven-auto.com/');
  assert.equal(catalogMetadata('/catalog', { brand: 'Toyota' }).robots.index, false);
  assert.equal(catalogMetadata('/catalog', { utm_source: 'instagram' }).robots, undefined);
});
