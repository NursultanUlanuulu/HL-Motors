const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync(require.resolve('../lib/car-template.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod.exports, mod);
const { applyCarTemplate } = mod.exports;

test('copies all listing details independently, preserving the new identity and draft photos', () => {
  const draft = { id: 'new', image: 'new.jpg', gallery: ['new.jpg'] };
  const source = { id: 'source', version: 8, image: 'old.jpg', gallery: ['old.jpg'], brand: 'BYD', model: 'Seal',
    year: 2024, price: 16000, status: 'В наличии', condition: 'С пробегом', vin: 'source-vin', carCode: 'A',
    listedAt: '2026-11-02', fobPrice: 15000, video: 'video.mp4', featureTags: ['offer'],
    specs: { color: 'grey', mileageKm: 12000, electricRangeKm: 120, totalRangeKm: 1050 },
    translations: Object.fromEntries(['ru','en','zh'].map(lang => [lang, { title: lang, metaTitle: lang, remark: lang }])) };
  const before = structuredClone(source);
  const result = applyCarTemplate(draft, source);
  const expected = { ...before, ...draft };
  delete expected.version;
  assert.deepEqual(result, expected);
  result.translations.zh.title = 'edited';
  result.specs.electricRangeKm = 110;
  result.featureTags.push('added');
  result.gallery.push('extra.jpg');
  assert.deepEqual(source, before);
  assert.deepEqual(draft.gallery, ['new.jpg']);
});

test('reapplying a template removes values absent in the second source and never imports its photos', () => {
  const draft = { id: 'new', image: '', gallery: [] };
  const first = applyCarTemplate(draft, { model: 'First', vin: 'old', video: 'first.mp4', translations: { en: { title: 'First' } }, specs: { range: 600 } });
  const next = applyCarTemplate(first, { model: 'Second', image: 'second.jpg', gallery: ['second.jpg'], version: 3 });
  assert.deepEqual(next, { ...draft, model: 'Second' });
});
