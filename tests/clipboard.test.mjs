// The Copy button, and clearing the clipboard afterwards.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage } from './page.mjs';

const copyButton = (page, who) => page.$(`button[data-copy="${who}"]`);
const bareKey = (page, who) => page.$(`#key-${who}`).textContent.replaceAll(' ', '');

test('Copy puts the bare 32-character key on the clipboard', async () => {
  const page = openPage();
  await page.createSecret();
  await page.click(copyButton(page, 'a'));
  assert.match(page.clipboard.text, /^[A-Z2-7]{32}$/);
  assert.equal(page.clipboard.text, bareKey(page, 'a'));
  assert.equal(copyButton(page, 'a').textContent, 'Copied');
});

test('without the Clipboard API, Copy selects the key instead', async () => {
  for (const options of [{ clipboard: false }, { secureContext: false }]) {
    const page = openPage(options);
    await page.createSecret();
    await page.click(copyButton(page, 'a'));
    assert.equal(page.clipboard.writes.length, 0);
    assert.equal(page.selection, page.$('#key-a'));
    assert.equal(copyButton(page, 'a').textContent, 'Selected');
  }
});

test('finishing clears the clipboard and says so', async () => {
  const page = openPage();
  await page.createSecret();
  await page.click(copyButton(page, 'a'));
  await page.action('next');
  await page.click(copyButton(page, 'b'));
  assert.ok(page.$('#clipboard-note').hidden, 'no note before the end');
  await page.action('next');
  assert.equal(page.clipboard.text, '');
  assert.ok(!page.$('#clipboard-note').hidden);
  assert.ok(page.$('#clipboard-failed').hidden);
});

test('if nothing was copied, the clipboard is left alone', async () => {
  const page = openPage();
  page.clipboard.text = 'something of yours';
  await page.finish();
  assert.equal(page.clipboard.writes.length, 0);
  assert.equal(page.clipboard.text, 'something of yours');
  assert.ok(page.$('#clipboard-note').hidden && page.$('#clipboard-failed').hidden);
});

test('if the browser refuses to clear it, the last screen warns instead', async () => {
  const page = openPage();
  await page.createSecret();
  await page.click(copyButton(page, 'a'));
  const key = page.clipboard.text;
  page.clipboard.refuseClear = true;
  await page.action('next');
  await page.action('next');
  assert.equal(page.clipboard.text, key, 'key still on the clipboard');
  assert.ok(!page.$('#clipboard-failed').hidden, 'warning shown');
  assert.ok(page.$('#clipboard-note').hidden, 'no success message');
});

test('a refused clear is retried at the next button press', async () => {
  const page = openPage();
  await page.finish();
  await page.action('restart');
  await page.createSecret();
  await page.click(copyButton(page, 'a'));
  page.clipboard.refuseClear = true;
  await page.action('back'); // confirmed: discards the secret, clear refused
  assert.notEqual(page.clipboard.text, '');
  page.clipboard.refuseClear = false;
  await page.action('next'); // "Create secret" retries
  assert.equal(page.clipboard.text, '');
});

test('"Start over" retries a refused clear and hides the warning', async () => {
  const page = openPage();
  await page.createSecret();
  await page.click(copyButton(page, 'a'));
  page.clipboard.refuseClear = true;
  await page.action('next');
  await page.action('next');
  page.clipboard.refuseClear = false;
  await page.action('restart');
  assert.equal(page.clipboard.text, '');
  assert.ok(page.$('#clipboard-failed').hidden && page.$('#clipboard-note').hidden);
});

test('"Start over with" the same names hides the clipboard messages', async () => {
  const page = openPage();
  await page.createSecret();
  await page.click(copyButton(page, 'a'));
  await page.action('next');
  await page.action('next');
  assert.ok(!page.$('#clipboard-note').hidden);
  await page.action('redo');
  await page.action('next');
  await page.action('next');
  await page.action('next');
  assert.ok(page.$('#clipboard-note').hidden, 'no stale note after a run without Copy');
});

test('Copy does nothing once the secret is gone', async () => {
  const page = openPage();
  await page.finish();
  await page.click(copyButton(page, 'a'));
  assert.equal(page.clipboard.writes.length, 0);
});
