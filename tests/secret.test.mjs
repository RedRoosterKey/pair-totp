// The secret, its Base32 encoding, the otpauth:// URI and the QR codes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { openPage, read, base32Decode, canvasShowsQr, fixedCrypto } from './page.mjs';

const RFC_SECRET = new TextEncoder().encode('12345678901234567890'); // RFC 6238 test key
const BASE32_RE = /^[A-Z2-7]{32}$/;

// RFC 6238 TOTP, written here independently of anything in app.js.
function totp(secret, seconds, digits) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(seconds / 30)));
  const mac = createHmac('sha1', secret).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

// The page only ever encodes 20 bytes, which divide evenly into Base32's
// 5-bit groups, so the encoder's leftover-bits path can't be reached through
// the wizard. Take the encoder out of app.js to run the RFC's own vectors.
function extractBase32Encode() {
  const src = read('app.js');
  const alphabet = src.match(/const BASE32_ALPHABET = '([A-Z2-7]{32})';/)[1];
  const fn = src.match(/ {2}function base32Encode\(bytes\) \{[\s\S]*?\n {2}\}\n/)[0];
  return new Function('BASE32_ALPHABET', fn + 'return base32Encode;')(alphabet);
}

test('Base32 encoder matches the RFC 4648 test vectors', () => {
  const base32Encode = extractBase32Encode();
  const vectors = [['', ''], ['f', 'MY'], ['fo', 'MZXQ'], ['foo', 'MZXW6'], ['foob', 'MZXW6YQ'], ['fooba', 'MZXW6YTB'], ['foobar', 'MZXW6YTBOI']];
  for (const [input, output] of vectors) {
    // RFC 4648 pads with "="; otpauth:// secrets leave the padding off.
    assert.equal(base32Encode(new TextEncoder().encode(input)), output, JSON.stringify(input));
  }
});

async function scanScreen(options, a, b) {
  const page = openPage(options);
  await page.createSecret(a, b);
  const uri = page.$('#qr-a').getAttribute('href');
  return { page, uri, params: new URL(uri).searchParams, key: page.$('#key-a').textContent };
}

test('the secret is 160 bits from crypto.getRandomValues', async () => {
  const crypto = {
    calls: [],
    getRandomValues(array) { this.calls.push(array); return globalThis.crypto.getRandomValues(array); },
  };
  const { params } = await scanScreen({ crypto });
  assert.equal(crypto.calls.length, 1);
  assert.ok(crypto.calls[0] instanceof Uint8Array);
  assert.equal(crypto.calls[0].length, 20);
  assert.match(params.get('secret'), BASE32_RE);
});

test('each run makes a different secret', async () => {
  const secrets = new Set();
  for (let i = 0; i < 20; i++) secrets.add((await scanScreen({})).params.get('secret'));
  assert.equal(secrets.size, 20);
});

test('Base32 matches the RFC 6238 test key', async () => {
  const { params, key } = await scanScreen({ crypto: fixedCrypto(RFC_SECRET) });
  assert.equal(params.get('secret'), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(key, 'GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ', 'setup key shown in groups of four');
});

test('Base32 handles all-zero and all-one bytes', async () => {
  assert.equal((await scanScreen({ crypto: fixedCrypto(new Uint8Array(20)) })).params.get('secret'), 'A'.repeat(32));
  assert.equal((await scanScreen({ crypto: fixedCrypto(new Uint8Array(20).fill(255)) })).params.get('secret'), '7'.repeat(32));
});

test('Base32 decodes back to the original bytes', async () => {
  for (let i = 0; i < 50; i++) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(20));
    const { params, key } = await scanScreen({ crypto: fixedCrypto(bytes) });
    assert.deepEqual(base32Decode(params.get('secret')), bytes);
    assert.equal(key.replaceAll(' ', ''), params.get('secret'), 'setup key is the same secret');
  }
});

test('the otpauth:// URI is exactly as authenticator apps expect', async () => {
  const { page, uri } = await scanScreen({ crypto: fixedCrypto(RFC_SECRET) }, 'Alice Ångström', 'Bob');
  const query = '?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=pair-totp&algorithm=SHA1&digits=6&period=30';
  // Person A's entry is labelled with B's name, and B's with A's.
  assert.equal(uri, 'otpauth://totp/pair-totp:Shared%20Code%20with%20Bob' + query);
  await page.action('next');
  assert.equal(page.$('#qr-b').getAttribute('href'),
    'otpauth://totp/pair-totp:Shared%20Code%20with%20Alice%20%C3%85ngstr%C3%B6m' + query);
});

test('both people get the same secret', async () => {
  const { page, params, key } = await scanScreen({});
  await page.action('next');
  assert.equal(new URL(page.$('#qr-b').getAttribute('href')).searchParams.get('secret'), params.get('secret'));
  assert.equal(page.$('#key-b').textContent, key);
});

test('the secret in the URI produces the RFC 6238 SHA1 test codes', async () => {
  const { params } = await scanScreen({ crypto: fixedCrypto(RFC_SECRET) });
  assert.equal(params.get('algorithm'), 'SHA1');
  assert.equal(params.get('period'), '30');
  const secret = Buffer.from(base32Decode(params.get('secret')));
  const vectors = [
    [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
    [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130'],
  ];
  for (const [seconds, code] of vectors) assert.equal(totp(secret, seconds, 8), code, `T=${seconds}`);
  // The page asks for 6 digits, which are the last 6 of the 8-digit code.
  assert.equal(params.get('digits'), '6');
  assert.equal(totp(secret, 59, 6), '287082');
});

test('each QR code shows exactly its otpauth:// URI', async () => {
  const { page, uri } = await scanScreen({}, 'Zoë', '王小明');
  const canvasA = page.$('#qr-a').querySelector('canvas');
  assert.ok(canvasShowsQr(canvasA, uri, page.qrcode));
  await page.action('next');
  const canvasB = page.$('#qr-b').querySelector('canvas');
  assert.ok(canvasShowsQr(canvasB, page.$('#qr-b').getAttribute('href'), page.qrcode));
  assert.ok(!canvasShowsQr(canvasB, uri, page.qrcode), "B's code isn't A's");
});
