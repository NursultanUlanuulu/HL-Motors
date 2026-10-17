// Local preview checks. No catalogue or external contact writes.
const { chromium } = require('./audit/runtime/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = 'http://localhost:3107';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    fs.mkdirSync('output/marketplace-qa', { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const nav = page.locator('.market-bottom-nav');
    const sheet = page.getByRole('dialog', { name: 'Ещё', exact: true });
    await page.goto(origin + '/faq', { waitUntil: 'domcontentloaded' });
    for (const width of [320, 390, 768, 1024, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await nav.isVisible());
      assert.ok(!await page.locator('footer').isVisible());
      assert.equal(await page.locator('.market-menu-button').count(), 0);
      assert.equal(await nav.getByRole('link').count(), 4);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const box = await nav.boundingBox();
      assert.ok(Math.abs(box.y + box.height - 844) < 1);
      const last = await page.locator('main .manager-channels').boundingBox();
      assert.ok(last.y + last.height <= box.y, 'Last content must scroll clear of navigation');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await nav.getByRole('button', { name: 'Ещё', exact: true }).click();
    await sheet.waitFor();
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.style.overflow === '');
    assert.ok(await nav.getByRole('button').evaluate(el => el === document.activeElement));
    await nav.getByRole('button').click();
    await sheet.getByRole('button', { name: 'EN — English', exact: true }).click();
    await page.getByRole('dialog', { name: 'More', exact: true }).getByRole('link', { name: 'Delivery & payment', exact: true }).click();
    await page.waitForURL('**/delivery');
    assert.equal(await page.locator('dialog:modal').count(), 0);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.locator('.market-header').getByRole('button', { name: 'CN — 中文', exact: true }).click();
    await nav.getByRole('link', { name: '车辆目录', exact: true }).waitFor();
    await page.locator('.market-header').getByRole('button', { name: 'RU — Русский', exact: true }).click();
    await nav.getByRole('link', { name: 'Каталог', exact: true }).click();
    await page.waitForURL('**/catalog');
    await page.locator('.market-car').first().waitFor();
    assert.equal(await nav.getByRole('link', { name: 'Каталог', exact: true }).getAttribute('aria-current'), 'page');
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    await page.getByRole('dialog', { name: 'Фильтры', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.market-favorite').first().click();
    await nav.locator('b').waitFor();
    assert.equal(await nav.locator('b').innerText(), '1');
    await page.screenshot({ path: 'output/marketplace-qa/bottom-navigation-phone.png' });
    await nav.getByRole('button').click();
    await page.screenshot({ path: 'output/marketplace-qa/bottom-navigation-more.png' });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForFunction(() => document.querySelectorAll('dialog:modal').length === 0);
    assert.ok(!await nav.isVisible());
    assert.ok(await page.locator('footer').isVisible());
    assert.ok(await page.locator('.market-header .market-nav').isVisible());
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: 'output/marketplace-qa/bottom-navigation-tablet.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/catalog/DEMO-2', { waitUntil: 'domcontentloaded' });
    const contact = page.locator('.market-mobile-contact');
    await contact.getByRole('button', { name: 'Связаться', exact: true }).waitFor();
    for (const end of [false, true]) {
      await page.evaluate(end => window.scrollTo(0, end ? document.body.scrollHeight : 0), end);
      const navBox = await nav.boundingBox(); const contactBox = await contact.boundingBox();
      assert.ok(contactBox.y + contactBox.height <= navBox.y + 1, 'Vehicle contact bar overlaps navigation');
    }
    await contact.getByRole('button', { name: 'Связаться', exact: true }).click();
    await page.getByRole('dialog', { name: 'Связаться с менеджером', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Открыть фотогалерею', exact: true }).click();
    await page.locator('dialog:modal').waitFor();
    assert.ok(await page.locator('dialog:modal').evaluate(dialog => {
      const nav = document.querySelector('.market-bottom-nav').getBoundingClientRect();
      return dialog.contains(document.elementFromPoint(nav.x + nav.width / 2, nav.y + 20));
    }), 'Gallery must cover navigation');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('PASS: 5 mobile/tablet widths, footer hidden, fixed navigation, 3 languages, route changes, favorites, keyboard/focus, resize, filters, contact/gallery overlays, desktop preserved');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
