// The authenticator app picker on the intro screen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage, canvasShowsQr } from './page.mjs';

const visiblePanels = (page) => page.root.querySelectorAll('[data-panel]').filter((p) => !p.hidden).map((p) => p.dataset.panel);
const pressed = (page) => page.root.querySelectorAll('button[data-platform]')
  .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.platform);

test('picks the right panel from the device', () => {
  const cases = [
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }, ['android']],
    [{ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, ['iphone']],
    [{ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }, ['iphone']],
    [{ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }, ['iphone']], // iPadOS
    [{ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, []],
    [{ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, []],
  ];
  for (const [options, expected] of cases) {
    const page = openPage(options);
    assert.deepEqual(visiblePanels(page), expected, options.userAgent);
    assert.deepEqual(pressed(page), expected, options.userAgent);
  }
});

test('on a computer, nothing is drawn until you choose', () => {
  const page = openPage();
  assert.equal(page.root.querySelectorAll('.store-qr canvas').length, 0);
});

test('choosing a platform shows only its panel, with QR codes for its store links', async () => {
  const page = openPage();
  for (const platform of ['android', 'iphone', 'other']) {
    await page.click(`button[data-platform="${platform}"]`);
    assert.deepEqual(visiblePanels(page), [platform]);
    assert.deepEqual(pressed(page), [platform]);
    const links = page.$(`[data-panel="${platform}"]`).querySelectorAll('a.store');
    assert.ok(links.length > 0);
    for (const link of links) {
      const canvas = link.querySelector('.store-qr canvas');
      assert.ok(canvas, `QR drawn for ${link.href}`);
      assert.ok(canvasShowsQr(canvas, link.href, page.qrcode), `QR shows ${link.href}`);
    }
  }
});

test('choosing a platform again doesn\'t draw its QR codes twice', async () => {
  const page = openPage();
  await page.click('button[data-platform="android"]');
  await page.click('button[data-platform="iphone"]');
  await page.click('button[data-platform="android"]');
  for (const box of page.$('[data-panel="android"]').querySelectorAll('.store-qr')) {
    assert.equal(box.querySelectorAll('canvas').length, 1);
  }
});
