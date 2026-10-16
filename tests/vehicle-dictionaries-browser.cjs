// End-to-end checks against the disposable synthetic preview only.
// Start after npm run build: node tests/security-preview.cjs
const { chromium } = require('./audit/runtime/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://localhost:3107';
const out = path.resolve(__dirname, '../output/vehicle-integration-qa');
fs.mkdirSync(out, { recursive: true });
const source = fs.readFileSync(path.resolve(__dirname, '../lib/vehicle-dictionaries.ts'), 'utf8');
const options = JSON.parse(source.split('export const vehicleOptions = ')[1].split(/;\r?\nexport const vehicleBrands/)[0]);
const id = (group, label) => options[group].find(option => option.sources.includes(label)).id;

async function main() {
  const initial = await (await fetch(origin + '/api/site')).json();
  assert.ok(initial.cars.some(car => car.id === 'QA-NORMAL') && initial.cars.every(car => car.id.startsWith('QA-') || car.carCode === 'BROWSER-QA'), 'Refuse to edit a real catalogue');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin + '/login');
    await page.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-Password9!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/admin/vehicles');
    for (const previous of initial.cars.filter(car => car.carCode === 'BROWSER-QA')) {
      const response = await page.request.delete(origin + '/api/admin/vehicles', { headers: { Origin: origin }, data: { id: previous.id, version: previous.version } });
      assert.equal(response.status(), 200);
    }
    if (initial.cars.some(car => car.carCode === 'BROWSER-QA')) await page.reload();
    await page.getByRole('button', { name: 'Add car' }).click();
    const dialog = page.getByRole('dialog', { name: 'Car editor' });
    await dialog.getByLabel('Search brands', { exact: true }).fill('Toyota');
    await dialog.getByRole('combobox', { name: /^Brand/ }).selectOption('Toyota');
    await dialog.getByRole('combobox', { name: /^Fuel and powertrain/ }).selectOption(id('fuelType', 'Gasoline'));
    await dialog.getByRole('combobox', { name: /^Transmission/ }).selectOption(id('transmission', 'Automatic'));
    await dialog.getByRole('combobox', { name: /^Drivetrain/ }).selectOption(id('driveType', 'Precursor'));
    await dialog.getByRole('combobox', { name: /^Body and size class/ }).selectOption(id('bodyType', 'Hatchback'));
    await dialog.getByRole('combobox', { name: /^Exterior colour/ }).selectOption(id('color', 'white'));
    await dialog.getByRole('combobox', { name: /^Seats/ }).selectOption(id('seats', '5'));
    await dialog.getByRole('combobox', { name: /^Battery type/ }).selectOption(id('batteryType', 'Lithium iron phosphate'));
    await dialog.getByRole('combobox', { name: /^Engine aspiration/ }).selectOption(id('flowMode', 'Turbocharging'));
    for (const [label, value] of Object.entries({ 'Displacement, L': '2', 'Mileage, km': '12345', 'Power, hp': '180', '0–100 km/h, s': '8.4', 'Fuel consumption, L/100 km': '6.5', 'Battery capacity, kWh': '73.5', 'Range, km': '650', 'Manufacturer price, CNY': '250000' })) await dialog.getByLabel(label, { exact: true }).fill(value);
    await dialog.getByLabel('Registration date', { exact: true }).fill('2026-10-15');
    await dialog.getByLabel('Original paintwork', { exact: true }).check();
    await dialog.getByLabel(/^Price, USD/).fill('25000');
    await dialog.getByLabel('Vehicle code', { exact: true }).fill('BROWSER-QA');
    await dialog.getByLabel('Listing date', { exact: true }).fill('2026-10-15');
    await dialog.getByLabel('FOB price, USD', { exact: true }).fill('27000');
    for (const [tab, suffix, model, title, remark] of [
      ['English', 'EN', 'Test model', 'English QA car', 'English description'],
      ['Русский', 'RU', 'Тестовая модель', 'Русская карточка QA', 'Русское описание'],
      ['中文', 'ZH', '测试车型', '中文测试车辆', '中文描述'],
    ]) {
      await dialog.getByRole('button', { name: tab, exact: true }).click();
      await dialog.getByLabel(`Model · ${suffix}`, { exact: true }).fill(model);
      await dialog.getByLabel(`Listing title · ${suffix}`, { exact: true }).fill(title);
      await dialog.getByLabel(`Description and remarks · ${suffix}`, { exact: true }).fill(remark);
    }
    await page.screenshot({ path: path.join(out, 'admin-desktop.png') });
    await dialog.getByRole('button', { name: 'Save listing' }).click();
    await dialog.waitFor({ state: 'hidden' });
    const saved = (await (await fetch(origin + '/api/site')).json()).cars.find(car => car.carCode === 'BROWSER-QA');
    assert.ok(saved); assert.equal(saved.specs.batteryCapacity, 73.5); assert.equal(saved.translations.en.title, 'English QA car');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.getByRole('row').filter({ hasText: 'Test model' }).getByRole('button', { name: /Edit/ }).click();
    await page.getByLabel('Battery capacity, kWh', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Battery capacity, kWh', { exact: true }).inputValue(), '73.5');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.admin-editor-body').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.join(out, 'admin-mobile.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow in editor');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto(origin + '/catalog');
    await page.getByRole('combobox', { name: /^Brand/ }).selectOption('Toyota');
    await page.getByRole('checkbox', { name: 'Gasoline', exact: true }).check();
    await page.waitForFunction(() => document.querySelectorAll('.catalog-page-card').length === 1);
    assert.equal(await page.locator('.catalog-page-card').count(), 1);
    await page.getByRole('button', { name: 'CN — 中文', exact: true }).click();
    await page.getByRole('heading', { name: '丰田 测试车型', exact: true }).waitFor();
    assert.equal(await page.locator('.catalog-page-card').count(), 1);
    await page.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Gasoline', exact: true }).uncheck();
    await page.getByText('More fuel types', { exact: true }).click();
    await page.getByRole('checkbox', { name: 'Diesel fuel', exact: true }).check();
    await page.waitForFunction(() => document.querySelectorAll('.catalog-page-card').length === 0);
    assert.equal(await page.locator('.catalog-page-card').count(), 0);
    await page.locator('.market-desktop-filters').getByRole('button', { name: 'Reset', exact: true }).click();
    await page.locator('.market-desktop-filters summary').filter({ hasText: /^All filters$/ }).click();
    await page.getByRole('combobox', { name: /^Condition and offer tags/ }).selectOption(saved.featureTags[0]);
    await page.waitForFunction(() => document.querySelectorAll('.catalog-page-card').length === 1);
    assert.equal(await page.locator('.catalog-page-card').count(), 1);
    await page.screenshot({ path: path.join(out, 'catalog-desktop.png') });
    await page.goto(origin + '/catalog/' + saved.id);
    await page.getByRole('heading', { name: 'Toyota Test model', exact: true }).waitFor();
    await page.getByText('English QA car', { exact: true }).waitFor();
    await page.getByText('English description', { exact: true }).waitFor();
    await page.getByText('73.5', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'RU — Русский', exact: true }).click();
    await page.getByText('Русское описание', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'CN — 中文', exact: true }).click();
    await page.getByText('中文描述', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, 'detail-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow on detail');
    await page.goto(origin + '/');
    await page.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
    await filters.getByRole('checkbox', { name: 'Gasoline', exact: true }).check();
    await filters.screenshot({ path: path.join(out, 'filters-mobile.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { name: 'Toyota Test model', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow on home');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, createdId: saved.id, checks: ['create', 'reload', 'edit', 'three languages', 'combined filters', 'mobile layout'], screenshots: out }));
  } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); console.error((await page.locator('body').innerText()).slice(-1800)); throw error; } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
