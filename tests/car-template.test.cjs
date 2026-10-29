const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync(require.resolve('../lib/car-template.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod.exports, mod);
const { applyCarTemplate } = mod.exports;

test('template preserves new vehicle identity, media and individual details in every language', () => {
  const draft = { id: 'new', brand: '', model: '', trim: '', price: 123, year: 2026, mileage: '20', city: 'New city', status: 'Под заказ', condition: 'Новый', power: '', drive: '', image: 'new.jpg', gallery: ['new.jpg'], vin: 'new-vin', specs: { color: 'white', mileageKm: 20 }, translations: { en: { city: 'New city', model: 'Old draft model' } } };
  const source = { ...draft, id: 'source', version: 8, brand: 'Toyota', model: 'Sienna', trim: 'Luxury', year: 2023, price: 40000, image: 'source.jpg', gallery: ['source.jpg'], video: 'source.mp4', vin: 'source-vin', carCode: 'source-code', listedAt: '2026-01-01', fobPrice: 35000, color: 'black', featureTags: ['damaged'], title: 'Unique title', metaTitle: 'Unique SEO', specs: { color: 'black', mileageKm: 45000, registrationDate: '2023-02-03', officialPrice: 300000, displacement: 2.5, seats: '7' }, translations: Object.fromEntries(['ru', 'en', 'zh'].map(locale => [locale, { model: `${locale} model`, remark: `${locale} description`, mileage: '45000', city: 'Source city', color: 'black', metaTitle: 'Source SEO' }])) };
  const before = structuredClone(source);
  const result = applyCarTemplate(draft, source);
  for (const field of ['id', 'price', 'year', 'mileage', 'city', 'status', 'condition', 'image', 'gallery', 'vin']) assert.deepEqual(result[field], draft[field], field);
  for (const field of ['version', 'video', 'carCode', 'listedAt', 'fobPrice', 'color', 'featureTags', 'title', 'metaTitle']) assert.equal(result[field], undefined, field);
  assert.deepEqual(result.specs, { color: 'white', mileageKm: 20, displacement: 2.5, seats: '7' });
  for (const locale of ['ru', 'en', 'zh']) {
    assert.equal(result.translations[locale].model, `${locale} model`);
    assert.equal(result.translations[locale].remark, `${locale} description`);
    assert.equal(result.translations[locale].mileage, undefined);
    assert.equal(result.translations[locale].metaTitle, undefined);
  }
  assert.equal(result.translations.en.city, 'New city');
  result.translations.zh.model = 'Edited';
  result.specs.seats = '5';
  assert.deepEqual(source, before);
  assert.equal(draft.translations.en.model, 'Old draft model');
});

test('switching templates clears old shared fields instead of mixing two models', () => {
  const draft = { id: 'new', brand: '', model: '', trim: '', power: '', drive: '', specs: { mileageKm: 0 }, translations: { en: { city: 'Bishkek' } } };
  const first = applyCarTemplate(draft, { model: 'First', specs: { batteryCapacity: 90 }, translations: { en: { model: 'First EN', remark: 'First description' } } });
  const next = applyCarTemplate(first, { model: 'Second' });
  assert.equal(next.model, 'Second');
  assert.equal(next.translations.en.model, undefined);
  assert.equal(next.translations.en.remark, undefined);
  assert.equal(next.translations.en.city, 'Bishkek');
  assert.deepEqual(next.specs, { mileageKm: 0 });
});
