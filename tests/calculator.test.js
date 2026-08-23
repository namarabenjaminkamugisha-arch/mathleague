import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluate, format, tokenize, bracketsBalanced, CalcError,
} from '../src/js/calculator.js';

const calc = (text, opts) => evaluate(text, opts);
const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance,
    `expected ${expected}, got ${actual}`);

// ── arithmetic ─────────────────────────────────────────────────────────────

test('adds and subtracts left to right', () => {
  assert.equal(calc('2+3'), 5);
  assert.equal(calc('10-4-3'), 3);          // not 10-(4-3)
});

test('multiplies and divides before adding', () => {
  assert.equal(calc('2+3*4'), 14);
  assert.equal(calc('20-6/2'), 17);
});

test('brackets override precedence', () => {
  assert.equal(calc('(2+3)*4'), 20);
  assert.equal(calc('2*(3+(4-1))'), 12);
});

test('handles decimals without floating point noise', () => {
  assert.equal(format(calc('0.1+0.2')), '0.3');
  assert.equal(format(calc('1.005*100')), '100.5');
});

test('accepts the pretty operator symbols the buttons produce', () => {
  assert.equal(calc('6 × 7'), 42);
  assert.equal(calc('84 ÷ 2'), 42);
  assert.equal(calc('10 − 3'), 7);          // true minus sign, not a hyphen
});

// ── unary and powers ───────────────────────────────────────────────────────

test('understands negative numbers', () => {
  assert.equal(calc('-5'), -5);
  assert.equal(calc('3+-2'), 1);
  assert.equal(calc('-(4-9)'), 5);
  assert.equal(calc('--7'), 7);
});

test('powers are right-associative', () => {
  assert.equal(calc('2^3'), 8);
  assert.equal(calc('2^3^2'), 512);         // 2^(3^2), not (2^3)^2 = 64
});

test('negative base with a power binds the way maths does', () => {
  assert.equal(calc('-2^2'), -4);           // -(2^2)
  assert.equal(calc('(-2)^2'), 4);
});

// ── functions and constants ────────────────────────────────────────────────

test('square root and cube root', () => {
  assert.equal(calc('sqrt(81)'), 9);
  assert.equal(calc('√(144)'), 12);
  assert.equal(calc('cbrt(27)'), 3);
});

test('logs', () => {
  assert.equal(calc('log(1000)'), 3);
  near(calc('ln(e)'), 1);
});

test('trigonometry in degrees by default', () => {
  near(calc('sin(30)'), 0.5);
  near(calc('cos(60)'), 0.5);
  near(calc('tan(45)'), 1);
});

test('trigonometry in radians when asked', () => {
  near(calc('sin(pi/2)', { degrees: false }), 1);
  near(calc('cos(0)', { degrees: false }), 1);
});

test('inverse trig returns the unit it was given', () => {
  near(calc('asin(0.5)'), 30);
  near(calc('asin(0.5)', { degrees: false }), Math.PI / 6);
});

test('constants', () => {
  near(calc('pi'), Math.PI);
  near(calc('π'), Math.PI);
  near(calc('e'), Math.E);
});

test('factorial', () => {
  assert.equal(calc('5!'), 120);
  assert.equal(calc('0!'), 1);
  assert.equal(calc('3!+2'), 8);
});

// ── percent and remainder ──────────────────────────────────────────────────

test('a trailing percent means "out of a hundred"', () => {
  assert.equal(calc('50%'), 0.5);
  assert.equal(calc('200*15%'), 30);
});

test('percent between two values means remainder', () => {
  assert.equal(calc('10%3'), 1);
  assert.equal(calc('17%5'), 2);
});

// ── implicit multiplication ────────────────────────────────────────────────

test('a value next to a bracket multiplies', () => {
  assert.equal(calc('2(3+4)'), 14);
  assert.equal(calc('(1+1)(2+2)'), 8);
});

test('a number next to a constant multiplies', () => {
  near(calc('2pi'), 2 * Math.PI);
});

// ── errors are explained, not just thrown ──────────────────────────────────

test('division by zero is refused clearly', () => {
  assert.throws(() => calc('1/0'), CalcError);
  assert.throws(() => calc('1/0'), /divide by zero/i);
});

test('unbalanced brackets are caught', () => {
  assert.throws(() => calc('(2+3'), /bracket/i);
  assert.throws(() => calc('2+3)'), /bracket/i);
});

test('nonsense input is refused', () => {
  assert.throws(() => calc('2++'), CalcError);
  assert.throws(() => calc('hello'), /do not know/i);
  assert.throws(() => calc(''), /nothing to work out/i);
  assert.throws(() => calc('2..3'), /decimal/i);
});

test('impossible maths is explained', () => {
  assert.throws(() => calc('sqrt(-1)'), /negative/i);
  assert.throws(() => calc('ln(0)'), /above zero/i);
  assert.throws(() => calc('(-1)!'), /whole number/i);
  assert.throws(() => calc('2.5!'), /whole number/i);
  assert.throws(() => calc('asin(5)'), /-1 to 1/i);
});

test('a result too large to show is reported, not shown as Infinity', () => {
  assert.throws(() => calc('9^9^9'), /too big/i);
  assert.throws(() => calc('171!'), /too big/i);
});

test('never runs arbitrary code', () => {
  // The whole reason the parser exists rather than eval().
  assert.throws(() => calc('process.exit(1)'), CalcError);
  assert.throws(() => calc('[].constructor'), CalcError);
});

// ── formatting ─────────────────────────────────────────────────────────────

test('formats cleanly', () => {
  assert.equal(format(0), '0');
  assert.equal(format(42), '42');
  assert.equal(format(-7.5), '-7.5');
  assert.equal(format(1 / 3), '0.333333333333');
});

test('very large and very small numbers fall back to exponent form', () => {
  assert.match(format(1e20), /e\+?20/);
  assert.match(format(1e-12), /e-12/);
});

// ── helpers ────────────────────────────────────────────────────────────────

test('tokenizer ignores spaces', () => {
  assert.deepEqual(tokenize('1 + 2').length, 3);
});

test('bracket balance check', () => {
  assert.equal(bracketsBalanced('(1+2)'), true);
  assert.equal(bracketsBalanced('(1+2'), false);
  assert.equal(bracketsBalanced('1+2)'), false);
  assert.equal(bracketsBalanced('((1))'), true);
});
