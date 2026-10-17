// Read-only regression: varied aspect ratios must fit before zooming.
const { chromium } = require('./audit/runtime/node_modules/playwright');
const assert = require('node:assert/strict');
const sizes = [[480, 541], [600, 1400], [1800, 600], [900, 900]];
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/site', async route => {
      const response = await route.fetch(); const data = await response.json();
      data.cars = data.cars.map(car => car.id === 'DEMO-4' ? { ...car, gallery: sizes.map((_, i) => `/qa-gallery/${i}.svg`) } : car);
      await route.fulfill({ response, json: data });
    });
    await page.route('**/qa-gallery/*.svg', route => {
      const index = Number(new URL(route.request().url()).pathname.split('/').pop().split('.')[0]);
      const [width, height] = sizes[index];
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#4388ba"/><rect x="5" y="5" width="${width - 10}" height="${height - 10}" fill="none" stroke="white" stroke-width="10"/></svg>` });
    });
    async function geometry() {
      return page.locator('.photo-viewer-canvas').evaluate(canvas => {
        const image = canvas.querySelector('.gallery-frame[data-active=true] img'); const bounds = image.getBoundingClientRect();
        return { width: canvas.clientWidth, height: canvas.clientHeight, scrollWidth: canvas.scrollWidth, scrollHeight: canvas.scrollHeight, left: canvas.scrollLeft, top: canvas.scrollTop, imageWidth: bounds.width, imageHeight: bounds.height, fit: getComputedStyle(image).objectFit };
      });
    }
    async function fit() {
      const g = await geometry();
      assert.equal(g.fit, 'contain');
      assert.ok(Math.abs(g.imageWidth - g.width) <= 1 && Math.abs(g.imageHeight - g.height) <= 1, 'Image box must fit the visible canvas');
      assert.equal(g.left, 0); assert.equal(g.top, 0);
      assert.ok(g.scrollWidth <= g.width + 1 && g.scrollHeight <= g.height + 1, 'Unzoomed photo must not overflow');
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:3107/catalog/DEMO-4', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const frames = document.querySelectorAll('.main-gallery-image .gallery-frame img');
        return frames.length === 3 && [...frames].every(img => img.complete && img.naturalWidth > 0);
      });
      await page.getByRole('button', { name: 'Открыть фотогалерею', exact: true }).click();
      await page.waitForFunction(() => {
        const frames = document.querySelectorAll('.photo-viewer-image .gallery-frame img');
        return frames.length === 3 && [...frames].every(img => img.complete && img.naturalWidth > 0);
      });
      await page.evaluate(() => { window.preloadedNextPhoto = document.querySelector('.photo-viewer-image img[src$="/1.svg"]'); });
      for (let i = 0; i < sizes.length; i++) {
        await page.waitForFunction(index => { const img = document.querySelector('.photo-viewer-image .gallery-frame[data-active=true] img'); return img?.src.endsWith(`/qa-gallery/${index}.svg`) && img.complete && img.naturalWidth > 0; }, i);
        await fit();
        await page.getByRole('button', { name: 'Увеличить фото', exact: true }).click();
        const g = await geometry();
        assert.ok(Math.abs(g.imageWidth - g.width * 2) <= 1 && Math.abs(g.imageHeight - g.height * 2) <= 1);
        assert.ok(Math.abs(g.left - g.width / 2) <= 1 && Math.abs(g.top - g.height / 2) <= 1, 'Zoom must start centered');
        const canvas = page.locator('.photo-viewer-canvas'); const box = await canvas.boundingBox();
        await page.mouse.move(box.width / 2, box.y + box.height / 2); await page.mouse.down();
        await page.mouse.move(box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 5 }); await page.mouse.up();
        const moved = await geometry(); assert.ok(moved.left < g.left && moved.top < g.top, 'Dragging must pan the photo');
        await page.getByRole('button', { name: 'Увеличить фото до 3×', exact: true }).click();
        const triple = await geometry();
        assert.ok(Math.abs(triple.imageWidth - triple.width * 3) <= 1 && Math.abs(triple.imageHeight - triple.height * 3) <= 1);
        assert.ok(Math.abs(triple.left - triple.width) <= 1 && Math.abs(triple.top - triple.height) <= 1);
        const zoomControl = await page.getByRole('button', { name: 'Увеличить фото до 3×', exact: true }).boundingBox();
        assert.ok(zoomControl.x >= 0 && zoomControl.x + zoomControl.width <= viewport.width);
        if (i === 0) {
          await page.getByRole('button', { name: 'Уменьшить фото', exact: true }).click(); await fit();
          await page.getByRole('button', { name: 'Увеличить фото', exact: true }).click();
        }
        await page.keyboard.press('ArrowRight');
        if (i === 0) assert.ok(await page.evaluate(() => {
          const active = document.querySelector('.photo-viewer-image .gallery-frame[data-active=true] img');
          return active === window.preloadedNextPhoto && active.complete && active.naturalWidth > 0;
        }), 'The next photo is already loaded and its DOM image is reused');
      }
      await fit(); await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Открыть фотогалерею', exact: true }).click(); await fit(); await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: adjacent images loaded before navigation and reused; four aspect ratios; desktop/mobile/landscape; 1x/2x/3x zoom, pan and reset');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
