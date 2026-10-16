// Isolated browser checks; does not write catalogue records.
const { chromium } = require('./audit/runtime/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const origin = 'http://localhost:3107';
const output = path.resolve(__dirname, '../output/marketplace-qa');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const popup = () => page.locator('.search-select-popup:popover-open');
  async function search(label, text) { await page.getByRole('combobox', { name: label, exact: true }).click(); await popup().getByRole('searchbox').fill(text); }
  async function swipe(locator, direction) {
    const bounds = await locator.boundingBox();
    const start = direction === 'left' ? .7 : .3; const end = direction === 'left' ? .3 : .7;
    await page.mouse.move(bounds.x + bounds.width * start, bounds.y + bounds.height * .5); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * end, bounds.y + bounds.height * .5, { steps: 8 }); await page.mouse.up();
  }
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' }); await page.locator('.market-car').first().waitFor();
    await search('Марка', 'мерседес');
    assert.equal(await popup().getByRole('option').count(), 1);
    await page.screenshot({ path: path.join(output, 'brand-search-desktop.png') });
    await popup().getByRole('searchbox').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.market-car').length === 1);
    assert.equal(await page.getByRole('combobox', { name: 'Марка', exact: true }).getAttribute('data-value'), 'Mercedes Benz');
    await search('Модель', 'GLC260'); await popup().getByRole('searchbox').press('ArrowDown'); await popup().getByRole('searchbox').press('Enter');
    assert.ok(page.url().includes('model=GLC'));
    await search('Марка', 'no-matching-brand'); await page.getByText('Нет подходящих вариантов', { exact: true }).waitFor();
    await popup().getByRole('searchbox').press('Escape'); assert.equal(await popup().count(), 0);
    assert.equal(await page.getByRole('combobox', { name: 'Марка', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('combobox', { name: 'Сортировка', exact: true }).click();
    await popup().getByRole('listbox').press('End'); await popup().getByRole('listbox').press('Enter');
    assert.ok(page.url().includes('sort=newest'));
    await page.locator('.market-car-title a').click();
    const image = page.locator('.main-gallery-image img');
    await image.waitFor();
    await page.waitForFunction(() => document.querySelector('.main-gallery-image img')?.complete && document.querySelector('.main-gallery-image img')?.naturalWidth > 0, null, { timeout: 60000 });
    assert.equal(new URL(await image.getAttribute('src'), origin).pathname, '/_next/image');
    assert.ok((await page.locator('.gallery-thumb img').first().getAttribute('sizes')).includes('90px'));
    await page.getByRole('button', { name: 'Открыть фотогалерею' }).click();
    const viewer = page.getByRole('dialog', { name: /^Галерея:/ }); await viewer.waitFor();
    await page.keyboard.press('ArrowRight'); await viewer.getByText('2 / 5', { exact: true }).waitFor();
    await viewer.getByRole('button', { name: 'Увеличить фото', exact: true }).click();
    assert.ok(await viewer.locator('.photo-viewer-canvas.zoomed').isVisible());
    await page.waitForFunction(() => { const img = document.querySelector('.photo-viewer-image img'); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 60000 });
    await page.screenshot({ path: path.join(output, 'gallery-fullscreen.png') });
    await viewer.getByRole('button', { name: 'Уменьшить фото', exact: true }).click();
    await swipe(viewer.locator('.photo-viewer-canvas'), 'left'); await viewer.getByText('3 / 5', { exact: true }).waitFor();
    await page.keyboard.press('Escape'); assert.equal(await viewer.isVisible(), false);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await swipe(page.getByRole('button', { name: 'Открыть фотогалерею' }), 'right');
    await page.locator('.gallery-counter').getByText('2 / 5', { exact: true }).waitFor();
    assert.equal(await viewer.isVisible(), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Открыть фотогалерею' }).click();
    await viewer.waitFor();
    await page.waitForFunction(() => { const img = document.querySelector('.photo-viewer-image img'); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 60000 });
    await page.screenshot({ path: path.join(output, 'gallery-mobile.png') }); await page.keyboard.press('Escape');
    await page.goto(origin + '/catalog', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    const filters = page.getByRole('dialog', { name: 'Фильтры', exact: true });
    await filters.getByRole('combobox', { name: 'Марка', exact: true }).click();
    await popup().getByRole('searchbox').fill('比亚迪');
    await page.screenshot({ path: path.join(output, 'brand-search-mobile.png') });
    const rect = await popup().boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
    await popup().getByRole('searchbox').press('Escape'); assert.ok(await filters.isVisible(), 'Escape closes only the dropdown');
    await filters.getByRole('combobox', { name: 'Марка', exact: true }).click(); await popup().getByRole('searchbox').fill('BYD'); await popup().getByRole('option').first().click();
    await filters.getByRole('combobox', { name: 'Модель', exact: true }).click(); await popup().getByRole('searchbox').fill('海豹');
    assert.equal(await popup().getByRole('option').count(), 1); await popup().getByRole('searchbox').press('Enter');
    await filters.getByRole('button', { name: /Показать автомобили/ }).click();
    await page.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByRole('button', { name: /Filters/ }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Brand', exact: true }).click();
    await popup().getByRole('searchbox').fill('奔驰'); assert.equal(await popup().getByRole('option').count(), 1);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'CN — 中文', exact: true }).click();
    await page.getByRole('heading', { name: '中国汽车', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Admin uses the same searchable controls inside its existing modal editor.
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('admin'); await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-Password9!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/admin/vehicles');
    await page.getByRole('button', { name: /Add car/ }).click();
    const editor = page.getByRole('dialog', { name: 'Car editor' });
    await editor.getByRole('combobox', { name: 'Brand', exact: true }).click(); await popup().getByRole('searchbox').fill('тойота'); await popup().getByRole('searchbox').press('Enter');
    assert.equal(await editor.getByRole('combobox', { name: 'Brand', exact: true }).getAttribute('data-value'), 'Toyota');
    await editor.getByRole('combobox', { name: 'Transmission', exact: true }).click(); await popup().getByRole('searchbox').fill('E-CVT');
    assert.ok(await popup().getByRole('option').count() > 0);
    await page.keyboard.press('Escape'); assert.ok(await editor.isVisible());
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['RU/EN/ZH search', 'keyboard selection', 'mobile top-layer dropdown', 'nested Escape', 'optimized images', 'gallery arrows and swipe', 'zoom', 'admin editor'] }));
  } catch (error) { await page.screenshot({ path: path.join(output, 'media-failure.png'), fullPage: true }); throw error; }
  finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
