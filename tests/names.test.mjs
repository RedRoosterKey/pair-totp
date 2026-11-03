// Name filtering on steps 2 and 3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage } from './page.mjs';

async function nameStep() {
  const page = openPage();
  await page.action('next');
  return page;
}

test('characters that could change the URI are removed as you type', async () => {
  const page = await nameStep();
  assert.equal(page.type('name-a', 'a:b/c?d#e%f+g=h&i@j<k>"l;m,n'), 'abcdefghijklmn');
  assert.ok(page.$('#hint-a').classList.contains('rejected'), 'hint turns red');
});

test('emoji, invisible and control characters are removed', async () => {
  const page = await nameStep();
  assert.equal(page.type('name-a', 'Mum \u{1F600}​‮\u0007'), 'Mum ');
});

test('letters from any language, accents, apostrophes, hyphens and full stops are kept', async () => {
  const page = await nameStep();
  for (const name of ['José O’Brien-Smith Jr.', "D'Arcy", '王小明', 'Zoë Ångström', 'Đorđe', 'Ольга', 'محمد', 'Nguyễn']) {
    assert.equal(page.type('name-a', name), name);
    assert.ok(!page.$('#hint-a').classList.contains('rejected'), `hint not flagged for ${name}`);
  }
});

test('leading and doubled spaces are tidied without flagging the hint', async () => {
  const page = await nameStep();
  assert.equal(page.type('name-a', '   Mary   Ann'), 'Mary Ann');
  assert.ok(!page.$('#hint-a').classList.contains('rejected'));
});

test('the caret stays where it was when a character is removed', async () => {
  const page = await nameStep();
  const input = page.$('#name-a');
  input.value = 'Al&ice';
  input.selectionStart = 3; // just after the &
  input.dispatch('input');
  assert.equal(input.value, 'Alice');
  assert.equal(input.selectionStart, 2);
});

test('Next stays disabled until the name has a letter or digit', async () => {
  const page = await nameStep();
  assert.ok(page.$('#next-a').disabled, 'disabled before typing');
  for (const empty of ['', '   ', "-'.", '\u{1F600}']) {
    page.type('name-a', empty);
    assert.ok(page.$('#next-a').disabled, `disabled for ${JSON.stringify(empty)}`);
  }
  page.type('name-a', 'A');
  assert.ok(!page.$('#next-a').disabled);
});

test('a name without letters or digits is refused on submit', async () => {
  const page = await nameStep();
  page.$('#name-a').value = "-'.";
  page.$('#form-a').dispatch('submit', { preventDefault() {} });
  assert.equal(page.step(), 2);
});

test('names are cleaned and trimmed on submit, even if set without typing', async () => {
  const page = await nameStep();
  page.$('#name-a').value = '  Eve & Mallory ';
  page.$('#form-a').dispatch('submit', { preventDefault() {} });
  assert.equal(page.step(), 3);
  page.type('name-b', 'Bob');
  await page.click('#next-b');
  await page.action('next');
  assert.equal(page.$('section[data-step="5"] h2 [data-name="a"]').textContent, 'Eve Mallory');
});

test('names appear as plain text, never as HTML', async () => {
  const page = await nameStep();
  page.$('#name-a').value = '<img src=x onerror=alert(1)>';
  page.$('#form-a').dispatch('submit', { preventDefault() {} });
  page.type('name-b', 'Bob');
  await page.click('#next-b');
  await page.action('next');
  const heading = page.$('section[data-step="5"] h2 [data-name="a"]');
  assert.equal(heading.textContent, 'img srcx onerroralert1');
  assert.equal(heading.querySelectorAll('img').length, 0);
});
