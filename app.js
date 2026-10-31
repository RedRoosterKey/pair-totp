// pair-totp: sets up one shared TOTP secret for two people, entirely in this tab.
// The secret is never stored, never put in the URL, and never sent anywhere.
(function () {
  'use strict';

  const TOTAL_STEPS = 7;
  const ISSUER = 'pair-totp';
  const ACCOUNT_PREFIX = 'Shared Code with ';
  const SECRET_BYTES = 20; // 160 bits, the RFC 4226 recommended length for SHA1
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const QR_QUIET_ZONE = 4; // modules of white border required by the QR spec
  const QR_DISPLAY_PX = 288;
  const STORE_QR_PX = 160;

  const state = {
    step: 1,
    nameA: '',
    nameB: '',
    secretBytes: null,
    secretB32: null,
  };

  // ---- Secret, encoding, URI ------------------------------------------------

  // RFC 4648 Base32, no padding (20 bytes encode to exactly 32 characters).
  function base32Encode(bytes) {
    let out = '';
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < bytes.length; i++) {
      buffer = (buffer << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
    }
    buffer = 0;
    return out;
  }

  function generateSecret() {
    wipeSecret();
    state.secretBytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
    state.secretB32 = base32Encode(state.secretBytes);
  }

  // Key URI format: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
  // otherName is the person the scanner will be verifying.
  function buildUri(otherName) {
    const label = encodeURIComponent(ISSUER) + ':' + encodeURIComponent(ACCOUNT_PREFIX + otherName);
    return 'otpauth://totp/' + label +
      '?secret=' + state.secretB32 +
      '&issuer=' + encodeURIComponent(ISSUER) +
      '&algorithm=SHA1&digits=6&period=30';
  }

  // ---- Names ----------------------------------------------------------------

  // Letters and accents from any language, digits, spaces, hyphens, apostrophes
  // (including the curly one phones insert) and full stops. Everything else is
  // stripped as you type, so a name can never carry URI syntax such as
  // : / ? # & % + =, or emoji and invisible characters that apps garble.
  const NAME_DISALLOWED = /[^\p{L}\p{M}\p{Nd} .'’-]+/gu;

  function cleanName(value) {
    return value.replace(NAME_DISALLOWED, '').replace(/ {2,}/g, ' ').replace(/^ +/, '');
  }

  function isValidName(name) {
    return /[\p{L}\p{Nd}]/u.test(name);
  }

  function formatKey(b32) {
    return b32.replace(/(.{4})(?=.)/g, '$1 ');
  }

  // ---- QR drawing -----------------------------------------------------------

  function drawQr(container, text, displayPx) {
    clearQr(container);
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();

    const count = qr.getModuleCount();
    const total = count + QR_QUIET_ZONE * 2;
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.max(2, Math.floor(((displayPx || QR_DISPLAY_PX) * ratio) / total));

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = total * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + QR_QUIET_ZONE) * scale, (row + QR_QUIET_ZONE) * scale, scale, scale);
        }
      }
    }
    container.appendChild(canvas);
  }

  // The secret QR codes are also links, so someone running the wizard on their
  // own phone can tap to hand the URI straight to their authenticator app.
  function showSecretQr(link, uri) {
    drawQr(link, uri);
    link.setAttribute('href', uri);
  }

  function clearQr(container) {
    container.querySelectorAll('canvas').forEach(function (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = canvas.height = 0;
      canvas.remove();
    });
    container.textContent = '';
    if (container.tagName === 'A') container.removeAttribute('href');
  }

  function clearKey(el) {
    el.textContent = '';
    const details = el.closest('details');
    if (details) details.open = false;
  }

  // ---- Copying the setup key ------------------------------------------------

  let keyOnClipboard = false;

  function flashLabel(button, label) {
    button.textContent = label;
    clearTimeout(button.resetTimer);
    button.resetTimer = setTimeout(function () { button.textContent = 'Copy'; }, 2000);
  }

  // Without the Clipboard API (plain http, older browsers), select the key so
  // the person can copy it by hand.
  function selectKey(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function copyKey(button) {
    if (!state.secretB32) return;
    const keyEl = button.dataset.copy === 'a' ? els.keyA : els.keyB;
    const fallback = function () {
      selectKey(keyEl);
      flashLabel(button, 'Selected');
    };
    if (!navigator.clipboard || !window.isSecureContext) {
      fallback();
      return;
    }
    // Copy without the display spaces; every app accepts the bare key.
    navigator.clipboard.writeText(state.secretB32).then(function () {
      keyOnClipboard = true;
      flashLabel(button, 'Copied');
    }, fallback);
  }

  // Runs from a button press, which browsers require for clipboard writes.
  // Clipboard history apps may still keep their own copy.
  function clearClipboard() {
    if (!keyOnClipboard) return;
    keyOnClipboard = false;
    navigator.clipboard.writeText('').then(function () {
      if (state.step === 7) els.clipboardNote.hidden = false;
    }, function () {});
  }

  // ---- Wiping ---------------------------------------------------------------

  // JavaScript can't zero a string in place, so this drops every reference to
  // the secret and zeroes the raw bytes. Closing the tab finishes the job.
  function wipeSecret() {
    if (state.secretBytes) state.secretBytes.fill(0);
    state.secretBytes = null;
    state.secretB32 = null;
    clearQr(els.qrA);
    clearQr(els.qrB);
    clearKey(els.keyA);
    clearKey(els.keyB);
    clearClipboard();
  }

  // ---- App picker on the intro screen ---------------------------------------

  // Store links are public URLs, so their QR codes are drawn once and kept.
  function showPlatform(platform) {
    document.querySelectorAll('button[data-platform]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.platform === platform));
    });
    document.querySelectorAll('[data-panel]').forEach(function (panel) {
      const active = panel.dataset.panel === platform;
      panel.hidden = !active;
      if (!active) return;
      panel.querySelectorAll('a.store').forEach(function (link) {
        const box = link.querySelector('.store-qr');
        if (!box.querySelector('canvas')) drawQr(box, link.getAttribute('href'), STORE_QR_PX);
      });
    });
  }

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'android';
    // iPadOS reports itself as a Mac, so tell them apart by touch support.
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
    return null;
  }

  // ---- Wizard ---------------------------------------------------------------

  const els = {
    sections: document.querySelectorAll('section[data-step]'),
    progress: document.getElementById('progress'),
    formA: document.getElementById('form-a'),
    formB: document.getElementById('form-b'),
    nameA: document.getElementById('name-a'),
    nameB: document.getElementById('name-b'),
    nextA: document.getElementById('next-a'),
    nextB: document.getElementById('next-b'),
    hintA: document.getElementById('hint-a'),
    hintB: document.getElementById('hint-b'),
    qrA: document.getElementById('qr-a'),
    qrB: document.getElementById('qr-b'),
    keyA: document.getElementById('key-a'),
    keyB: document.getElementById('key-b'),
    clipboardNote: document.getElementById('clipboard-note'),
  };

  function fillNames() {
    document.querySelectorAll('[data-name="a"]').forEach(function (el) { el.textContent = state.nameA; });
    document.querySelectorAll('[data-name="b"]').forEach(function (el) { el.textContent = state.nameB; });
  }

  function showStep(step) {
    // Leaving a QR screen always removes its code from the page.
    if (state.step === 5 && step !== 5) { clearQr(els.qrA); clearKey(els.keyA); }
    if (state.step === 6 && step !== 6) { clearQr(els.qrB); clearKey(els.keyB); }

    state.step = step;
    fillNames();

    if (step === 5) {
      showSecretQr(els.qrA, buildUri(state.nameB));
      els.keyA.textContent = formatKey(state.secretB32);
    } else if (step === 6) {
      showSecretQr(els.qrB, buildUri(state.nameA));
      els.keyB.textContent = formatKey(state.secretB32);
    } else if (step === 7) {
      wipeSecret();
    }

    els.sections.forEach(function (section) {
      section.hidden = Number(section.dataset.step) !== step;
    });
    els.progress.textContent = 'Step ' + step + ' of ' + TOTAL_STEPS;
    window.scrollTo(0, 0);

    const current = document.querySelector('section[data-step="' + step + '"]');
    const focusTarget = step === 2 ? els.nameA : step === 3 ? els.nameB : current.querySelector('h2');
    focusTarget.focus({ preventScroll: true });
  }

  function next() {
    if (state.step === 4) generateSecret();
    if (state.step < TOTAL_STEPS) showStep(state.step + 1);
  }

  function back() {
    if (state.step === 5) {
      const ok = window.confirm(
        'Going back discards this secret. If ' + state.nameA +
        ' already scanned it, delete that entry from the app. Go back?'
      );
      if (!ok) return;
      wipeSecret();
    }
    if (state.step > 1) showStep(state.step - 1);
  }

  function restart() {
    wipeSecret();
    state.nameA = '';
    state.nameB = '';
    els.nameA.value = '';
    els.nameB.value = '';
    els.nextA.disabled = true;
    els.nextB.disabled = true;
    els.hintA.classList.remove('rejected');
    els.hintB.classList.remove('rejected');
    els.clipboardNote.hidden = true;
    showStep(1);
  }

  function bindNameForm(form, input, button, hint, key) {
    input.addEventListener('input', function () {
      const raw = input.value;
      const cleaned = cleanName(raw);
      if (cleaned !== raw) {
        const caret = cleanName(raw.slice(0, input.selectionStart || 0)).length;
        input.value = cleaned;
        input.setSelectionRange(Math.min(caret, cleaned.length), Math.min(caret, cleaned.length));
      }
      // Only flag characters that were actually rejected, not tidied-up spaces.
      hint.classList.toggle('rejected', raw.replace(NAME_DISALLOWED, '') !== raw);
      button.disabled = !isValidName(cleaned);
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const name = cleanName(input.value).trim();
      if (!isValidName(name)) return;
      state[key] = name;
      next();
    });
  }

  bindNameForm(els.formA, els.nameA, els.nextA, els.hintA, 'nameA');
  bindNameForm(els.formB, els.nameB, els.nextB, els.hintB, 'nameB');

  document.addEventListener('click', function (event) {
    const platformButton = event.target.closest('button[data-platform]');
    if (platformButton) {
      showPlatform(platformButton.dataset.platform);
      return;
    }
    const copyButton = event.target.closest('button[data-copy]');
    if (copyButton) {
      copyKey(copyButton);
      return;
    }
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'next') next();
    else if (action === 'back') back();
    else if (action === 'restart') restart();
  });

  const detected = detectPlatform();
  if (detected) showPlatform(detected);

  // Don't let the browser's back/forward cache bring a QR code back.
  window.addEventListener('pagehide', restart);
})();
