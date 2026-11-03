// Moving through the steps, and wiping the secret.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage, fixedCrypto } from './page.mjs';

const secretOf = (page, who) => new URL(page.$(`#qr-${who}`).getAttribute('href')).searchParams.get('secret');

// Nothing secret left anywhere on the page: no QR drawing, no link, no key text.
function assertNoSecretOnPage(page) {
  for (const who of ['a', 'b']) {
    assert.equal(page.$(`#qr-${who}`).querySelectorAll('canvas').length, 0, `no QR drawn for ${who}`);
    assert.equal(page.$(`#qr-${who}`).getAttribute('href'), null, `no otpauth link for ${who}`);
    assert.equal(page.$(`#key-${who}`).textContent, '', `no setup key text for ${who}`);
  }
  assert.ok(!page.root.querySelectorAll('[href]').some((el) => el.href.startsWith('otpauth:')), 'no otpauth link anywhere');
}

test('starts on step 1 of 7 with nothing secret on the page', () => {
  const page = openPage();
  assert.equal(page.step(), 1);
  assert.equal(page.$('#progress').textContent, 'Step 1 of 7');
  assertNoSecretOnPage(page);
});

test('goes through all seven steps in order, with progress and focus', async () => {
  const page = openPage();
  await page.action('next');
  assert.equal(page.step(), 2);
  assert.equal(page.doc.activeElement, page.$('#name-a'), 'focus moves to the name field');
  page.type('name-a', 'Alice');
  await page.click('#next-a');
  assert.equal(page.step(), 3);
  assert.equal(page.doc.activeElement, page.$('#name-b'));
  page.type('name-b', 'Bob');
  await page.click('#next-b');
  for (const n of [4, 5, 6, 7]) {
    assert.equal(page.step(), n);
    assert.equal(page.$('#progress').textContent, `Step ${n} of 7`);
    assert.equal(page.doc.activeElement, page.section(n).querySelector('h2'), `focus on step ${n} heading`);
    if (n < 7) await page.action('next');
  }
});

test('names fill in the headings and labels', async () => {
  const page = openPage();
  await page.createSecret('Alice', 'Bob');
  const a = page.root.querySelectorAll('[data-name="a"]').map((el) => el.textContent);
  const b = page.root.querySelectorAll('[data-name="b"]').map((el) => el.textContent);
  assert.ok(a.length > 0 && a.every((t) => t === 'Alice'));
  assert.ok(b.length > 0 && b.every((t) => t === 'Bob'));
});

test('no secret exists until "Create secret" on step 4', async () => {
  const crypto = fixedCrypto(new Uint8Array(20).fill(7));
  const page = openPage({ crypto });
  await page.action('next');
  await page.enterNames('Alice', 'Bob');
  assert.equal(page.step(), 4);
  assert.equal(crypto.arrays.length, 0);
  assertNoSecretOnPage(page);
  await page.action('next');
  assert.equal(crypto.arrays.length, 1);
});

test("leaving step 5 removes A's code before B's is shown", async () => {
  const page = openPage();
  await page.createSecret();
  page.$('#key-a').closest('details').open = true;
  await page.action('next');
  assert.equal(page.step(), 6);
  assert.equal(page.$('#qr-a').querySelectorAll('canvas').length, 0);
  assert.equal(page.$('#qr-a').getAttribute('href'), null);
  assert.equal(page.$('#key-a').textContent, '');
  assert.ok(!page.$('#key-a').closest('details').open, '"Show the setup key" is closed again');
  assert.equal(page.$('#qr-b').querySelectorAll('canvas').length, 1);
});

test('Back from step 6 shows A the same secret again', async () => {
  const page = openPage();
  await page.createSecret();
  const secret = secretOf(page, 'a');
  await page.action('next');
  await page.action('back');
  assert.equal(page.step(), 5);
  assert.equal(secretOf(page, 'a'), secret);
  assert.equal(page.$('#qr-b').querySelectorAll('canvas').length, 0, "B's code removed");
});

test('Back from step 5 asks first, and keeps the secret if you say no', async () => {
  const page = openPage({ confirm: false });
  await page.createSecret('Alice', 'Bob');
  const secret = secretOf(page, 'a');
  await page.action('back');
  assert.equal(page.confirms.length, 1);
  assert.match(page.confirms[0], /discards this secret/);
  assert.match(page.confirms[0], /Alice/);
  assert.equal(page.step(), 5);
  assert.equal(secretOf(page, 'a'), secret);
});

test('Back from step 5 discards the secret if you say yes, and a new one is made', async () => {
  const crypto = {
    arrays: [],
    getRandomValues(array) { this.arrays.push(array); return globalThis.crypto.getRandomValues(array); },
  };
  const page = openPage({ crypto });
  await page.createSecret();
  const secret = secretOf(page, 'a');
  await page.action('back');
  assert.equal(page.step(), 4);
  assertNoSecretOnPage(page);
  assert.ok(crypto.arrays[0].every((byte) => byte === 0), 'old secret bytes zeroed');
  await page.action('next');
  assert.notEqual(secretOf(page, 'a'), secret);
});

test('the last screen has wiped the secret and zeroed its bytes', async () => {
  const crypto = fixedCrypto(new Uint8Array(20).fill(0xab));
  const page = openPage({ crypto });
  await page.finish();
  assert.equal(page.step(), 7);
  assertNoSecretOnPage(page);
  assert.ok(crypto.arrays[0].every((byte) => byte === 0), 'secret bytes zeroed');
  assert.ok(!page.$('#wiped').hidden);
  assert.equal(page.section(7).querySelector('button[data-action="back"]'), null, 'no way back to the codes');
});

test('"Start over" clears the names and goes back to the intro', async () => {
  const page = openPage();
  await page.finish('Alice', 'Bob');
  await page.action('restart');
  assert.equal(page.step(), 1);
  assert.equal(page.$('#name-a').value, '');
  assert.equal(page.$('#name-b').value, '');
  assert.ok(page.$('#next-a').disabled && page.$('#next-b').disabled);
  assertNoSecretOnPage(page);
});

test('"Start over with" the same names keeps them and makes a new secret', async () => {
  const page = openPage();
  await page.createSecret('Alice', 'Bob');
  const secret = secretOf(page, 'a');
  await page.action('next');
  await page.action('next');
  const redo = page.section(7).querySelector('button[data-action="redo"]');
  assert.equal(redo.textContent, 'Start over with Alice and Bob');
  await page.click(redo);
  assert.equal(page.step(), 4, 'back on "Create your shared secret"');
  assertNoSecretOnPage(page);
  await page.action('next');
  assert.notEqual(secretOf(page, 'a'), secret);
  assert.match(page.$('#qr-a').getAttribute('href'), /Shared%20Code%20with%20Bob/);
});

test('leaving the page wipes the secret, so Back/Forward can\'t bring it back', async () => {
  const crypto = fixedCrypto(new Uint8Array(20).fill(9));
  const page = openPage({ crypto });
  await page.createSecret();
  await page.leave();
  assert.equal(page.step(), 1);
  assertNoSecretOnPage(page);
  assert.ok(crypto.arrays[0].every((byte) => byte === 0));
});
