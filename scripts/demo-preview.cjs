// Local, disposable catalogue. Restarting resets edits to the five demo cars.
// Build first: npm run build. Then: node scripts/demo-preview.cjs
const { main } = require('../tests/security-preview.cjs');
const cars = require('../fixtures/demo-cars.json');
main(cars).catch(error => { console.error(error); process.exitCode = 1; });
