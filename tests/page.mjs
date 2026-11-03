// Loads the real index.html, vendor/qrcode.js and app.js into a small fake
// browser, so the tests drive the page the way a person would: type names,
// press buttons, and read what's on screen. No dependencies beyond Node.

import { readFileSync } from 'node:fs';

export const ROOT = new URL('../', import.meta.url);
export const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const VOID = new Set(['meta', 'link', 'img', 'input', 'br', 'hr']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e]);

// ---- Elements ---------------------------------------------------------------

class Text {
  constructor(text) { this.text = text; this.parent = null; }
}

class Element {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = attrs;
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this.selectionStart = 0;
    const el = this;
    this.classList = {
      contains: (c) => el.classes().includes(c),
      add: (c) => { if (!el.classList.contains(c)) el.className = [...el.classes(), c].join(' '); },
      remove: (c) => { el.className = el.classes().filter((x) => x !== c).join(' '); },
      toggle: (c, on) => { (on ?? !el.classList.contains(c)) ? el.classList.add(c) : el.classList.remove(c); },
    };
  }

  classes() { return (this.attrs.class || '').split(/\s+/).filter(Boolean); }
  get tagName() { return this.tag.toUpperCase(); }
  get id() { return this.attrs.id || ''; }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  get dataset() {
    const out = {};
    for (const [k, v] of Object.entries(this.attrs)) {
      if (k.startsWith('data-')) out[k.slice(5).replace(/-(.)/g, (_, c) => c.toUpperCase())] = v;
    }
    return out;
  }

  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }

  get textContent() {
    return this.children.map((c) => (c instanceof Text ? c.text : c.textContent)).join('');
  }
  set textContent(v) {
    this.children.forEach((c) => { c.parent = null; });
    this.children = v === '' ? [] : [Object.assign(new Text(String(v)), { parent: this })];
  }

  appendChild(child) {
    if (child.parent) child.remove();
    child.parent = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  elements() { return this.children.filter((c) => c instanceof Element); }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => node.elements().forEach((el) => {
      if (el.matches(selector, this)) out.push(el);
      walk(el);
    });
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    for (let el = this; el instanceof Element; el = el.parent) if (el.matches(selector)) return el;
    return null;
  }

  // Compound selectors (tag, #id, .class, [attr], [attr="value"]) joined by
  // spaces for descendants. That's all app.js and these tests use.
  matches(selector, scope) {
    const parts = selector.trim().split(/\s+/);
    if (!matchesCompound(this, parts.pop())) return false;
    let el = this.parent;
    while (parts.length) {
      while (el instanceof Element && el !== scope && !matchesCompound(el, parts[parts.length - 1])) el = el.parent;
      if (!(el instanceof Element) || el === scope) return false;
      parts.pop();
      el = el.parent;
    }
    return true;
  }

  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, event = {}) { (this.listeners[type] || []).forEach((fn) => fn(event)); }

  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start) { this.selectionStart = start; }
}

function matchesCompound(el, compound) {
  const re = /^([a-z0-9]+)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  let pos = 0;
  for (let m; (m = re.exec(compound)) && m.index === pos; pos = re.lastIndex) {
    if (m[1] && el.tag !== m[1]) return false;
    if (m[2] && el.id !== m[2]) return false;
    if (m[3] && !el.classList.contains(m[3])) return false;
    if (m[4] && (!(m[4] in el.attrs) || (m[5] !== undefined && el.attrs[m[4]] !== m[5]))) return false;
  }
  if (pos !== compound.length) throw new Error('Unsupported selector: ' + compound);
  return true;
}

// Boolean and string properties that reflect attributes, as in a browser.
for (const name of ['hidden', 'disabled', 'open']) {
  Object.defineProperty(Element.prototype, name, {
    get() { return name in this.attrs; },
    set(v) { if (v) this.attrs[name] = ''; else delete this.attrs[name]; },
  });
}
for (const name of ['href', 'target', 'rel', 'type']) {
  Object.defineProperty(Element.prototype, name, {
    get() { return this.attrs[name] || ''; },
    set(v) { this.attrs[name] = String(v); },
  });
}
Object.defineProperty(Element.prototype, 'value', {
  get() { return this._value ?? this.attrs.value ?? ''; },
  set(v) { this._value = String(v); },
});

// A canvas with a one-bit framebuffer: 1 where black was drawn, 0 for white.
class Canvas extends Element {
  constructor() { super('canvas'); this._w = 0; this._h = 0; this.pixels = new Uint8Array(0); }
  get width() { return this._w; }
  set width(v) { this._w = v; this.pixels = new Uint8Array(this._w * this._h); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.pixels = new Uint8Array(this._w * this._h); }
  getContext() {
    const canvas = this;
    return {
      fillStyle: '#000000',
      fillRect(x, y, w, h) {
        const v = this.fillStyle === '#000000' ? 1 : 0;
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) canvas.pixels[j * canvas._w + i] = v;
      },
      clearRect() { canvas.pixels.fill(0); },
    };
  }
  pixel(x, y) { return this.pixels[y * this._w + x]; }
}

// ---- Parsing ------------------------------------------------------------------

export function parseHtml(html, doc) {
  const root = new Element('#root');
  let current = root;
  const token = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/gi;
  for (let m; (m = token.exec(html));) {
    if (m[1]) {
      if (current.tag !== m[1].toLowerCase()) throw new Error(`Unexpected </${m[1]}> inside <${current.tag}>`);
      current = current.parent;
    } else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? '' : decode(a[2]);
      const el = new Element(m[2].toLowerCase(), attrs);
      el.ownerDocument = doc;
      current.appendChild(el);
      if (!VOID.has(el.tag)) current = el;
    } else if (m[4] && current !== root) {
      current.appendChild(new Text(decode(m[4])));
    }
  }
  if (current !== root) throw new Error(`Unclosed <${current.tag}>`);
  return root;
}

// ---- The page ----------------------------------------------------------------

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Options:
//   userAgent, maxTouchPoints   for the app picker
//   crypto                      replaces window.crypto (null for none)
//   clipboard: false            no Clipboard API
//   secureContext: false        plain http
//   framed: true                loaded inside another page's frame
//   confirm                     answer to window.confirm (default true)
export function openPage(options = {}) {
  const doc = {
    activeElement: null,
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    getElementById: (id) => root.querySelector('#' + id),
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    createElement(tag) {
      const el = tag === 'canvas' ? new Canvas() : new Element(tag);
      el.ownerDocument = doc;
      return el;
    },
    createRange: () => ({ selectNodeContents(el) { this.node = el; } }),
  };
  const root = parseHtml(read('index.html'), doc);

  const clipboard = {
    text: null,
    writes: [],
    refuseClear: false,
    writeText(text) {
      this.writes.push(text);
      if (text === '' && this.refuseClear) return Promise.reject(new Error('NotAllowedError'));
      this.text = text;
      return Promise.resolve();
    },
  };
  let selection = null;
  const confirms = [];
  const winListeners = {};
  const win = {
    isSecureContext: options.secureContext !== false,
    devicePixelRatio: 1,
    crypto: 'crypto' in options ? options.crypto : globalThis.crypto,
    scrollTo() {},
    confirm(message) { confirms.push(message); return options.confirm !== false; },
    getSelection: () => ({ removeAllRanges() { selection = null; }, addRange(range) { selection = range.node; } }),
    addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); },
  };
  win.self = win;
  win.top = options.framed ? {} : win;
  const nav = {
    userAgent: options.userAgent || 'Mozilla/5.0 (X11; Linux x86_64)',
    maxTouchPoints: options.maxTouchPoints || 0,
    clipboard: options.clipboard === false ? undefined : clipboard,
  };
  const location = { href: 'https://redroosterkey.github.io/pair-totp/' };
  // The Copy button's label resets after 2 seconds; tests don't need to wait.
  const noTimer = () => 0;

  const qrcode = new Function('define', 'exports', 'module', read('vendor/qrcode.js') + '\nreturn qrcode;')();
  new Function('window', 'document', 'navigator', 'location', 'qrcode', 'setTimeout', 'clearTimeout', read('app.js'))(
    win, doc, nav, location, qrcode, noTimer, noTimer,
  );

  const $ = (sel) => {
    const el = root.querySelector(sel);
    if (!el) throw new Error('No element matches ' + sel);
    return el;
  };
  const step = () => root.querySelectorAll('section[data-step]').filter((s) => !s.hidden).map((s) => Number(s.dataset.step));

  const page = {
    root, doc, win, clipboard, confirms, qrcode, $,
    get selection() { return selection; },
    get started() { return (doc.listeners.click || []).length > 0; },

    // The visible step number. Exactly one step is visible at a time.
    step() {
      const visible = step();
      if (visible.length !== 1) throw new Error('Visible steps: ' + visible.join(','));
      return visible[0];
    },
    section(n) { return $(`section[data-step="${n}"]`); },

    // Presses a button like a browser would: nothing happens if it's
    // disabled, and a submit button submits its form.
    async click(target) {
      const el = typeof target === 'string' ? $(target) : target;
      if (el.disabled) return;
      (doc.listeners.click || []).forEach((fn) => fn({ target: el }));
      if (el.tag === 'button' && el.type === 'submit') el.closest('form').dispatch('submit', { preventDefault() {} });
      await settle();
    },
    // Presses the button with this data-action on the visible step.
    action(name) { return page.click(page.section(page.step()).querySelector(`button[data-action="${name}"]`)); },

    // Types into a name field. The browser has already put the raw text in
    // the field when the input event fires, with the caret at the end.
    type(id, text) {
      const input = $('#' + id);
      input.value = text;
      input.selectionStart = text.length;
      input.dispatch('input');
      return input.value;
    },

    // Steps 2 and 3, ending on step 4.
    async enterNames(a, b) {
      page.type('name-a', a);
      await page.click('#next-a');
      page.type('name-b', b);
      await page.click('#next-b');
    },
    // From the intro to Person A's QR code (step 5), creating the secret.
    async createSecret(a = 'Alice', b = 'Bob') {
      await page.action('next');
      await page.enterNames(a, b);
      await page.action('next');
    },
    // All the way to the last screen.
    async finish(a = 'Alice', b = 'Bob') {
      await page.createSecret(a, b);
      await page.action('next');
      await page.action('next');
    },

    async leave() { (winListeners.pagehide || []).forEach((fn) => fn({})); await settle(); },
  };
  return page;
}

// ---- Helpers for checking output ----------------------------------------------

// Reads the QR modules back off a canvas drawn by app.js and compares them
// with what qrcode-generator produces for `text`. Returns true when the canvas
// shows exactly that QR code, with a white quiet zone around it.
export function canvasShowsQr(canvas, text, qrcode, quietZone = 4) {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const total = count + quietZone * 2;
  if (canvas.width !== canvas.height || canvas.width % total !== 0) return false;
  const scale = canvas.width / total;
  for (let row = 0; row < total; row++) {
    for (let col = 0; col < total; col++) {
      const inside = row >= quietZone && row < quietZone + count && col >= quietZone && col < quietZone + count;
      const dark = inside && qr.isDark(row - quietZone, col - quietZone);
      const y = row * scale + (scale >> 1);
      const x = col * scale + (scale >> 1);
      if (canvas.pixel(x, y) !== (dark ? 1 : 0)) return false;
    }
  }
  return true;
}

// RFC 4648 Base32 decoding, written separately from app.js's encoder so each
// checks the other.
export function base32Decode(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error('Not Base32: ' + ch);
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

// A stand-in for window.crypto that hands out chosen bytes and remembers the
// array it filled, so tests can check it was zeroed afterwards.
export function fixedCrypto(bytes) {
  return {
    arrays: [],
    getRandomValues(array) {
      array.set(bytes);
      this.arrays.push(array);
      return array;
    },
  };
}
