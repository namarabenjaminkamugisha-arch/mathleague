// Guards for the calculator's input behaviour on phones.
//
// These read the source rather than the DOM: the app has no DOM test harness,
// and the failure being guarded against is a missing attribute or a dropped
// guard clause, which source-level checks catch perfectly well.
//
// The bug: the display is a real <input>, so focusing it made Android and iOS
// throw their on-screen keyboard up over the keypad every time the calculator
// was opened and after every key press.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'src/index.html'), 'utf8');
const ui = readFileSync(join(root, 'src/js/calc-ui.js'), 'utf8');

test('the display never asks for the on-screen keyboard', () => {
  const tag = html.match(/<input[^>]*id="calcInput"[^>]*>/s);
  assert.ok(tag, 'calcInput is missing from index.html');
  assert.match(tag[0], /inputmode="none"/,
    'calcInput must set inputmode="none", or phones cover the keypad with '
    + 'their own keyboard');
});

test('touch devices also get readOnly, for older iOS', () => {
  assert.match(ui, /pointer:\s*coarse/,
    'calc-ui.js must detect a coarse pointer');
  assert.match(ui, /input\.readOnly\s*=\s*true/,
    'older iOS ignores inputmode, so readOnly is the fallback');
});

test('opening the calculator does not focus the display on a phone', () => {
  const fn = ui.split('export function focusCalculator()')[1];
  assert.ok(fn, 'focusCalculator is missing');
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /if\s*\(isTouch\(\)\)\s*return/,
    'focusCalculator must bail out on touch before it calls focus()');
});

test('no unguarded focus() calls remain in the calculator UI', () => {
  const offenders = ui
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => /\.focus\(\)/.test(line))
    // the guarded helper and the desktop-only branch inside it are fine
    .filter(({ line }) => !/keepCaret|isTouch/.test(line))
    // focusCalculator's own call sits after an isTouch() early return
    .filter(({ n }) => {
      const before = ui.split('\n').slice(0, n).join('\n');
      return !/export function focusCalculator\(\)[\s\S]*isTouch\(\)\s*\)\s*return/
        .test(before);
    });
  assert.deepEqual(offenders, [],
    `focus() must go through keepCaret(): ${JSON.stringify(offenders)}`);
});

test('a physical keyboard still works', () => {
  assert.match(ui, /document\.addEventListener\('keydown'/,
    'keyboard handling must be on the document, so it works even when the '
    + 'display is readOnly or unfocused');
  assert.match(ui, /screen-calc'\)\.classList\.contains\('is-active'\)/,
    'the keyboard handler must only act while the calculator is on screen, '
    + 'or it will steal keystrokes from the quiz answer box');
  for (const key of ['Enter', 'Escape', 'Backspace']) {
    assert.ok(ui.includes(`'${key}'`), `${key} must be handled`);
  }
});

test('typed operators become the same symbols the buttons produce', () => {
  // Otherwise "2*3" from a keyboard and "2×3" from the keypad would be two
  // different strings, and only one of them round-trips through history.
  assert.match(ui, /'\*':\s*'×'/);
  assert.match(ui, /'\/':\s*'÷'/);
  assert.match(ui, /'-':\s*'−'/);
});
