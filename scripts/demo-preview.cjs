// Local, disposable catalogue. Restarting resets edits to the five demo cars.
// Build first: npm run build. Then: node scripts/demo-preview.cjs
const { main } = require('../tests/security-preview.cjs');
const fs = require('node:fs');
const path = require('node:path');
const snapshotIndex = process.argv.indexOf('--snapshot');
const cars = snapshotIndex >= 0
  ? JSON.parse(fs.readFileSync(path.resolve(process.argv[snapshotIndex + 1]), 'utf8')).cars.map(({ version, ...car }) => car)
  : require('../fixtures/demo-cars.json');
if (!Array.isArray(cars)) throw new Error('Expected a catalogue snapshot with a cars array.');
main(cars).catch(error => { console.error(error); process.exitCode = 1; });
