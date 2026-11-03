// The frame check, failing closed, and static checks on the files themselves:
// the Content-Security-Policy, integrity hashes, and no storage or network code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { ROOT, openPage, read } from './page.mjs';

const html = read('index.html');
const app = read('app.js');

test('refuses to run inside another page\'s frame', async () => {
  const page = openPage({ framed: true });
  assert.ok(!page.started, 'no click handling at all');
  const main = page.$('main');
  assert.equal(main.elements().length, 1);
  const message = main.elements()[0];
  assert.equal(message.className, 'warn');
  assert.match(message.textContent, /won't run inside another page/);
  const link = message.querySelector('a');
  assert.equal(link.href, 'https://redroosterkey.github.io/pair-totp/');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
});

test('without a secure random number generator, it stops on step 4', async () => {
  for (const crypto of [null, {}]) {
    const page = openPage({ crypto });
    await page.action('next');
    await page.enterNames('Alice', 'Bob');
    assert.ok(page.$('#no-crypto').hidden, 'no warning before trying');
    await page.action('next');
    assert.equal(page.step(), 4);
    assert.ok(!page.$('#no-crypto').hidden, 'warning shown');
    assert.equal(page.$('#qr-a').querySelectorAll('canvas').length, 0);
    assert.equal(page.$('#key-a').textContent, '');
  }
});

test('the Content-Security-Policy blocks network access and outside code', () => {
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
  const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')]));
  assert.deepEqual(directives, {
    'default-src': "'none'",
    'script-src': "'self'",
    'style-src': "'self'",
    'img-src': "'self'",
    'connect-src': "'none'",
    'font-src': "'none'",
    'form-action': "'none'",
    'base-uri': "'none'",
  });
});

test('no inline scripts, inline styles or event handler attributes', () => {
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), 'every script has a src');
  assert.ok(!/\sstyle="/.test(html), 'no style attributes');
  assert.ok(!/<style/.test(html), 'no style elements');
  assert.ok(!/\son[a-z]+="/.test(html), 'no onclick= and similar');
});

test('every script and stylesheet is local and pinned with a correct integrity hash', () => {
  const tags = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"([^>]*)>/g)];
  assert.deepEqual(tags.map((m) => m[1]).sort(), ['app.js', 'style.css', 'vendor/qrcode.js']);
  for (const [, path, rest] of tags) {
    const expected = 'sha384-' + createHash('sha384').update(read(path)).digest('base64');
    const actual = rest.match(/integrity="([^"]+)"/)?.[1];
    assert.equal(actual, expected, `${path}: run python3 tools/update-sri.py`);
  }
});

test('every local file the page refers to exists', () => {
  const refs = [...html.matchAll(/\s(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 5);
  for (const ref of refs) assert.ok(existsSync(new URL(ref, ROOT)), ref);
});

test('the app picker\'s store links are the only outside links, and open safely', () => {
  const page = openPage();
  const outside = page.root.querySelectorAll('a[href]').filter((a) => /^https?:/.test(a.href));
  assert.ok(outside.length >= 6);
  for (const a of outside) {
    assert.match(a.href, /^https:\/\/(play\.google\.com|f-droid\.org|apps\.apple\.com|ente\.com)\//, a.href);
    assert.equal(a.target, '_blank', a.href);
    assert.equal(a.rel, 'noopener noreferrer', a.href);
  }
});

test('app.js uses no storage, network, or HTML-writing APIs', () => {
  const code = app.replace(/\/\/.*$/gm, '');
  for (const api of [
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches',
    'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'RTCPeerConnection',
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function',
    'history.pushState', 'history.replaceState', 'location.hash', 'location.search',
    'Math.random',
  ]) {
    assert.ok(!code.includes(api), `app.js mentions ${api}`);
  }
});

test('vendor/qrcode.js is the unmodified qrcode-generator 1.4.4', () => {
  const sha256 = createHash('sha256').update(read('vendor/qrcode.js')).digest('hex');
  assert.equal(sha256, '18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780');
  assert.ok(read('README.md').includes(sha256), 'README states the same hash');
});
