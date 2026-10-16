// Browser regression checks for the marketplace; only the browser's private test storage is changed.
const { chromium } = require('./audit/runtime/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://localhost:3107';
const out = path.resolve(__dirname, '../output/marketplace-qa');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1080 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const count = async (n, target = page) => target.waitForFunction(n => document.querySelectorAll('.market-car').length === n, n);
  const brand = () => page.getByRole('combobox', { name: /^Марка/ });
  const model = () => page.getByRole('combobox', { name: /^Модель/ });
  const reset = () => page.locator('.market-desktop-filters').getByRole('button', { name: 'Сбросить', exact: true }).click();
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' }); await count(5);
    await page.locator('.market-car').first().getByRole('button', { name: 'Добавить в избранное' }).click();
    await page.getByRole('link', { name: 'Избранное: 1', exact: true }).click(); await count(1);
    await page.reload({ waitUntil: 'domcontentloaded' }); await count(1);
    const tab = await context.newPage(); await tab.goto(origin + '/favorites', { waitUntil: 'domcontentloaded' }); await count(1, tab);
    await page.getByRole('button', { name: 'Убрать из избранного' }).click(); await count(0); await count(0, tab);
    await page.getByRole('heading', { name: 'Здесь будут понравившиеся автомобили' }).waitFor(); await tab.close();
    await page.goto(origin + '/catalog', { waitUntil: 'domcontentloaded' }); await count(5);
    await brand().selectOption('BYD'); await model().selectOption('Seal 06 DM-i'); await count(1);
    await page.reload({ waitUntil: 'domcontentloaded' }); await count(1);
    assert.equal(await model().inputValue(), 'Seal 06 DM-i');
    await page.getByRole('button', { name: 'CN — 中文', exact: true }).click();
    await page.getByRole('heading', { name: '比亚迪 海豹06 DM-i', exact: true }).waitFor();
    await page.locator('.market-car-title a').click(); await page.waitForURL('**/catalog/DEMO-3?*');
    await page.getByText('本车辆为网站功能测试示例。', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByText('Demo listing for testing this website.', { exact: false }).waitFor();
    await page.getByRole('link', { name: '← Back to results', exact: true }).click(); await count(1);
    await page.getByRole('button', { name: 'RU — Русский', exact: true }).click();
    assert.equal(await model().inputValue(), 'Seal 06 DM-i');
    await brand().selectOption('Buick'); await count(1); assert.equal(await model().inputValue(), '');
    await reset(); await count(5);
    await page.getByRole('spinbutton', { name: 'Цена, $: До', exact: true }).fill('25000'); await count(2);
    await page.getByRole('button', { name: /^Убрать фильтр: Цена до/ }).click(); await count(5);
    await page.getByRole('checkbox', { name: 'Бензин', exact: true }).check(); await count(2);
    await page.getByRole('checkbox', { name: 'Электромобиль BEV', exact: true }).check(); await count(3);
    await reset(); await count(5);
    await page.getByRole('searchbox').fill('海豹'); await page.getByRole('button', { name: 'Найти', exact: true }).click(); await count(1);
    await page.getByRole('searchbox').fill('no-such-car'); await page.getByRole('button', { name: 'Найти', exact: true }).click(); await count(0);
    await page.getByRole('heading', { name: 'Ничего не найдено' }).waitFor(); await reset(); await count(5);
    await page.waitForFunction(() => [...document.querySelectorAll('.market-car img')].filter(img => img.naturalWidth > 0).length >= 3, null, { timeout: 60000 });
    await page.screenshot({ path: path.join(out, 'catalog-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Фильтры', exact: true });
    await dialog.getByRole('combobox', { name: /^Марка/ }).selectOption('BYD');
    await page.screenshot({ path: path.join(out, 'filters-mobile.png') });
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    await count(1);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.locator('.market-car-title a').click();
    await page.getByRole('heading', { name: 'BYD Seal 06 DM-i', exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, 'detail-mobile.png'), fullPage: true });
    assert.ok(await page.locator('.market-mobile-contact').isVisible());
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Detail overflow at ' + width);
    }
    await page.goto(origin + '/catalog', { waitUntil: 'domcontentloaded' }); await count(5);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, 'catalog-mobile.png') });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Catalog overflow at ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Доставка и оплата', exact: true }).click();
    await page.getByRole('heading', { name: 'Доставка и оплата', exact: true }).waitFor();
    for (const route of ['about', 'contacts', 'delivery']) {
      await page.goto(origin + '/' + route, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }

    // Read-only interception exercises real pagination without adding fake rows to the database.
    const snapshot = await (await page.request.get(origin + '/api/site')).json();
    const many = Array.from({ length: 27 }, (_, i) => ({ ...snapshot.cars[i % snapshot.cars.length], id: 'PAGE-' + i, price: 10000 + i }));
    await page.route('**/api/site', route => route.fulfill({ json: { ...snapshot, cars: many } }));
    await page.goto(origin + '/catalog', { waitUntil: 'domcontentloaded' }); await count(12);
    await page.getByRole('button', { name: 'Страница 3', exact: true }).click(); await count(3);
    await page.reload({ waitUntil: 'domcontentloaded' }); await count(3);
    assert.ok(page.url().includes('page=3'));
    await page.unroute('**/api/site');
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Логин', { exact: true }).fill('admin');
    await page.getByLabel('Пароль', { exact: true }).fill('Synthetic-only-Password9!');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL('**/admin/vehicles');
    await page.getByRole('button', { name: /Добавить автомобиль/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['URL filters', 'multiple fuels', 'empty results', 'favorites persistence and tab sync', 'three languages', 'detail return link', 'mobile dialog and menu', '320/390/768 layouts', 'pagination', 'admin login'], screenshots: out }));
  } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); console.error((await page.locator('body').innerText()).slice(-1200)); throw error; }
  finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
