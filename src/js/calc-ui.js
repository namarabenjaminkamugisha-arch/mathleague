// calc-ui.js — the calculator screen. All the maths lives in calculator.js;
// this file only turns taps and keystrokes into text, and text into a result.

import { evaluate, format, bracketsBalanced, CalcError } from './calculator.js';

const $ = id => document.getElementById(id);

// Touch devices get no focus at all: even with the system keyboard suppressed,
// focusing scrolls the display around under the user's thumb. On a desktop
// focus is what keeps the caret visible, so it stays.
const isTouch = () => !!(window.matchMedia
  && window.matchMedia('(pointer: coarse)').matches);
const keepCaret = input => { if (!isTouch()) input.focus(); };

const HISTORY_KEY = 'mathleague.calc.history';
const MAX_HISTORY = 20;

// label      what it types        class      inverse label / insert
const KEYS = [
  { label: 'AC', act: 'clear', cls: 'k-fn k-warn' },
  { label: '⌫', act: 'back', cls: 'k-fn' },
  { label: '(', ins: '(', cls: 'k-fn' },
  { label: ')', ins: ')', cls: 'k-fn' },
  { label: '÷', ins: '÷', cls: 'k-op' },

  { label: 'sin', ins: 'sin(', cls: 'k-fn', inv: { label: 'asin', ins: 'asin(' } },
  { label: 'cos', ins: 'cos(', cls: 'k-fn', inv: { label: 'acos', ins: 'acos(' } },
  { label: 'tan', ins: 'tan(', cls: 'k-fn', inv: { label: 'atan', ins: 'atan(' } },
  { label: 'xʸ', ins: '^', cls: 'k-fn', inv: { label: '√ʸ', ins: '^(1/' } },
  { label: '×', ins: '×', cls: 'k-op' },

  { label: 'ln', ins: 'ln(', cls: 'k-fn', inv: { label: 'eˣ', ins: 'exp(' } },
  { label: 'log', ins: 'log(', cls: 'k-fn', inv: { label: '10ˣ', ins: '10^(' } },
  { label: '√', ins: '√(', cls: 'k-fn', inv: { label: '∛', ins: 'cbrt(' } },
  { label: 'x²', ins: '^2', cls: 'k-fn', inv: { label: '1/x', ins: '^(-1)' } },
  { label: '−', ins: '−', cls: 'k-op' },

  { label: '7', ins: '7' }, { label: '8', ins: '8' }, { label: '9', ins: '9' },
  { label: '%', ins: '%', cls: 'k-fn' },
  { label: '+', ins: '+', cls: 'k-op' },

  { label: '4', ins: '4' }, { label: '5', ins: '5' }, { label: '6', ins: '6' },
  { label: 'π', ins: 'π', cls: 'k-fn' },
  { label: '=', act: 'equals', cls: 'k-eq' },

  { label: '1', ins: '1' }, { label: '2', ins: '2' }, { label: '3', ins: '3' },
  { label: 'e', ins: 'e', cls: 'k-fn' },

  { label: '±', act: 'negate' }, { label: '0', ins: '0' }, { label: '.', ins: '.' },
  { label: 'n!', ins: '!', cls: 'k-fn' },
];

const MEMORY_KEYS = [
  { label: 'MC', act: 'mc' }, { label: 'MR', act: 'mr' },
  { label: 'M+', act: 'mplus' }, { label: 'M−', act: 'mminus' },
  { label: 'ANS', act: 'ans' },
];

let degrees = true;
let inverse = false;
let memory = 0;
let lastAnswer = 0;
let history = [];

// ── storage ────────────────────────────────────────────────────────────────

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    history = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];
  } catch { history = []; }          // private mode, or corrupted - not fatal
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* nothing worth interrupting the user for */ }
}

// ── rendering ──────────────────────────────────────────────────────────────

function renderKeys() {
  const box = $('calcKeys');
  box.replaceChildren();
  for (const key of [...MEMORY_KEYS, ...KEYS]) {
    const face = inverse && key.inv ? key.inv : key;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `k ${key.cls || ''} ${MEMORY_KEYS.includes(key) ? 'k-mem' : ''}`.trim();
    b.textContent = face.label;
    b.addEventListener('click', () => {
      if (face.ins !== undefined) insert(face.ins);
      else runAction(key.act);
    });
    box.appendChild(b);
  }
}

function renderHistory() {
  const box = $('calcHistory');
  box.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'calc-empty';
    empty.textContent = 'Nothing yet. Your last 20 calculations will appear here.';
    box.appendChild(empty);
    return;
  }
  for (const row of history) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'calc-hist-row';
    const expr = document.createElement('span');
    expr.className = 'calc-hist-expr';
    expr.textContent = row.expr;
    const val = document.createElement('span');
    val.className = 'calc-hist-val';
    val.textContent = `= ${row.value}`;
    item.append(expr, val);
    // Tapping a past line puts its answer back in play - the thing people
    // actually want from history, rather than just looking at it.
    item.addEventListener('click', () => { insert(row.value); });
    box.appendChild(item);
  }
}

function preview() {
  const input = $('calcInput');
  const out = $('calcPreview');
  const text = input.value.trim();
  out.classList.remove('is-error');
  if (!text) { out.textContent = ''; return; }
  if (!bracketsBalanced(text)) { out.textContent = ''; return; }
  try {
    out.textContent = `= ${format(evaluate(text, { degrees }))}`;
  } catch {
    out.textContent = '';         // mid-typing errors are noise, not news
  }
}

// ── actions ────────────────────────────────────────────────────────────────

function insert(text) {
  const input = $('calcInput');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const caret = start + String(text).length;
  input.setSelectionRange(caret, caret);
  keepCaret(input);
  preview();
}

function showError(message) {
  const out = $('calcPreview');
  out.textContent = message;
  out.classList.add('is-error');
}

function equals() {
  const input = $('calcInput');
  const text = input.value.trim();
  if (!text) return;
  try {
    const value = evaluate(text, { degrees });
    const shown = format(value);
    lastAnswer = value;
    history.unshift({ expr: text, value: shown });
    history = history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
    input.value = shown;
    input.setSelectionRange(shown.length, shown.length);
    $('calcPreview').textContent = '';
    $('calcPreview').classList.remove('is-error');
  } catch (err) {
    showError(err instanceof CalcError ? err.message : 'That will not calculate');
  }
}

function negate() {
  const input = $('calcInput');
  const text = input.value.trim();
  if (!text) { insert('−'); return; }
  // Flip the sign of the whole expression rather than the last digit, which
  // is what people mean when the box already holds an answer.
  input.value = text.startsWith('−') ? text.slice(1) : `−(${text})`;
  preview();
  keepCaret(input);
}

function runAction(act) {
  const input = $('calcInput');
  switch (act) {
    case 'clear':
      input.value = '';
      $('calcPreview').textContent = '';
      $('calcPreview').classList.remove('is-error');
      keepCaret(input);
      break;
    case 'back': {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      if (start !== end) {
        input.value = input.value.slice(0, start) + input.value.slice(end);
        input.setSelectionRange(start, start);
      } else if (start > 0) {
        input.value = input.value.slice(0, start - 1) + input.value.slice(start);
        input.setSelectionRange(start - 1, start - 1);
      }
      keepCaret(input);
      preview();
      break;
    }
    case 'equals': equals(); break;
    case 'negate': negate(); break;
    case 'ans': insert(format(lastAnswer)); break;
    case 'mc': memory = 0; updateMemoryFlag(); break;
    case 'mr': insert(format(memory)); break;
    case 'mplus': case 'mminus': {
      const text = input.value.trim();
      if (!text) return;
      try {
        const value = evaluate(text, { degrees });
        memory += act === 'mplus' ? value : -value;
        updateMemoryFlag();
      } catch (err) {
        showError(err instanceof CalcError ? err.message : 'That will not calculate');
      }
      break;
    }
    default: break;
  }
}

function updateMemoryFlag() {
  const flag = $('calcMemFlag');
  flag.hidden = memory === 0;
  flag.title = `Memory holds ${format(memory)}`;
}

// ── physical keyboard ──────────────────────────────────────────────────────

// Typed characters are mapped to the same symbols the buttons produce, so a
// keyboard and the keypad put identical text in the display.
const TYPED = {
  '*': '×', x: '×', '/': '÷', '-': '−',
  '+': '+', '^': '^', '(': '(', ')': ')', '!': '!', '%': '%', '.': '.',
};

function onKeyDown(e) {
  // Only while the calculator is on screen, and never while the player is
  // typing an answer during a run.
  if (!$('screen-calc').classList.contains('is-active')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;      // let copy/paste through
  const target = e.target;
  if (target && target !== $('calcInput')
      && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

  const k = e.key;

  if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); return; }
  if (k === 'Escape') { e.preventDefault(); runAction('clear'); return; }
  if (k === 'Backspace') { e.preventDefault(); runAction('back'); return; }
  if (k === 'Delete') { e.preventDefault(); runAction('clear'); return; }

  if (/^[0-9]$/.test(k)) { e.preventDefault(); insert(k); return; }

  if (Object.prototype.hasOwnProperty.call(TYPED, k)) {
    e.preventDefault();
    insert(TYPED[k]);
  }
}

// ── wiring ─────────────────────────────────────────────────────────────────

export function initCalculator() {
  loadHistory();
  renderKeys();
  renderHistory();
  updateMemoryFlag();

  const input = $('calcInput');
  input.addEventListener('input', preview);

  // On a touch device the keypad IS the keyboard, so the display must never
  // summon the system one - it covers half the screen and the keys underneath.
  // inputmode="none" handles this on current browsers; readOnly is the belt
  // and braces for older iOS, which ignores inputmode. Neither stops the
  // buttons, which set the value in code, nor a real keyboard, which is
  // handled below.
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    input.readOnly = true;
  }

  // Physical keyboards are handled on the document rather than the input, so
  // they work whether or not the display has focus - and still work when the
  // input is readOnly on a tablet with a keyboard attached.
  document.addEventListener('keydown', onKeyDown);

  $('calcAngle').addEventListener('click', () => {
    degrees = !degrees;
    $('calcAngle').textContent = degrees ? 'DEG' : 'RAD';
    $('calcAngle').classList.toggle('is-on', !degrees);
    preview();
  });

  $('calcInv').addEventListener('click', () => {
    inverse = !inverse;
    $('calcInv').classList.toggle('is-on', inverse);
    renderKeys();
  });

  $('btnCalcClearHistory').addEventListener('click', () => {
    history = [];
    saveHistory();
    renderHistory();
  });
}

/** Called each time the screen is opened, so it always starts ready to type. */
export function focusCalculator() {
  const input = $('calcInput');
  // Deliberately does nothing on a phone: opening the calculator used to
  // throw the on-screen keyboard up over the keypad every single time.
  if (isTouch()) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
