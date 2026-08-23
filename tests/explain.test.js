import test from 'node:test';
import assert from 'node:assert/strict';
import { explainAdd, explainSub, explainMul, explainDiv } from '../src/js/explain.js';
import {
  explainFraction, explainPercentOf, explainPercentChange,
  explainPower, explainRoot, explainLinear, explainSimplify,
} from '../src/js/explain-advanced.js';
import { Frac, fmt } from '../src/js/util.js';

/** Every explanation must be a non-empty list of {text} steps. */
function assertWellFormed(e, label) {
  assert.ok(Array.isArray(e.steps), `${label}: steps must be an array`);
  assert.ok(e.steps.length >= 2, `${label}: needs at least two steps`);
  for (const s of e.steps) {
    assert.equal(typeof s.text, 'string', `${label}: step text must be a string`);
    assert.ok(s.text.trim().length > 0, `${label}: step text must not be empty`);
    if (s.detail !== undefined) assert.equal(typeof s.detail, 'string');
  }
  assert.ok(Array.isArray(e.alternatives), `${label}: alternatives must be an array`);
  for (const alt of e.alternatives) {
    assert.equal(typeof alt.name, 'string');
    assert.ok(alt.steps.length > 0, `${label}: alternative "${alt.name}" is empty`);
  }
}

/** The final step must state the true answer. */
function assertConcludes(e, expected, label) {
  const last = e.steps[e.steps.length - 1].text;
  assert.ok(
    last.includes(fmt(expected)),
    `${label}: final step "${last}" should contain the answer ${fmt(expected)}`
  );
}

// ── the four operations ─────────────────────────────────────
test('addition explanation is well formed and correct', () => {
  const e = explainAdd(247, 386);
  assertWellFormed(e, 'add');
  assert.equal(e.answer, 633);
  assertConcludes(e, 633, 'add');
});

test('subtraction explanation is well formed and correct', () => {
  const e = explainSub(500, 237);
  assertWellFormed(e, 'sub');
  assert.equal(e.answer, 263);
  assertConcludes(e, 263, 'sub');
});

test('multiplication shows partial products that actually sum to the answer', () => {
  const e = explainMul(23, 47);
  assertWellFormed(e, 'mul');
  assert.equal(e.answer, 1081);
  assertConcludes(e, 1081, 'mul');
  const detail = e.steps.map(s => s.detail || '').join('\n');
  assert.ok(detail.includes('23 × 40 = 920'), 'expected the 40s partial product');
  assert.ok(detail.includes('23 × 7 = 161'), 'expected the 7s partial product');
});

test('division explanation is well formed and correct', () => {
  const e = explainDiv(144, 12);
  assertWellFormed(e, 'div');
  assert.equal(e.answer, 12);
  assertConcludes(e, 12, 'div');
});

test('division handles a non-exact result without lying about it', () => {
  const e = explainDiv(10, 4);
  assert.equal(e.answer, 2.5);
  assertConcludes(e, 2.5, 'div-inexact');
});

// ── the answer in the steps is always the real answer ───────
test('exhaustive: arithmetic steps never contradict the computation', () => {
  for (let a = 1; a <= 60; a += 7) {
    for (let b = 1; b <= 60; b += 5) {
      assert.equal(explainAdd(a, b).answer, a + b);
      assert.equal(explainSub(a + b, b).answer, a);
      assert.equal(explainMul(a, b).answer, a * b);
      assert.equal(explainDiv(a * b, b).answer, a);
    }
  }
});

test('exhaustive: every arithmetic explanation stays well formed', () => {
  for (let a = 2; a <= 40; a += 3) {
    for (let b = 2; b <= 40; b += 3) {
      assertWellFormed(explainAdd(a, b), `add ${a},${b}`);
      assertWellFormed(explainSub(a + b, b), `sub ${a + b},${b}`);
      assertWellFormed(explainMul(a, b), `mul ${a},${b}`);
      assertWellFormed(explainDiv(a * b, b), `div ${a * b},${b}`);
    }
  }
});

// ── fractions ───────────────────────────────────────────────
test('fraction addition finds the LCD and simplifies', () => {
  const e = explainFraction('add', new Frac(1, 4), new Frac(1, 6));
  assertWellFormed(e, 'frac-add');
  assert.equal(e.exact.toString(), '5/12');
  assert.equal(e.answer, 5 / 12);
  const all = e.steps.map(s => `${s.text} ${s.detail || ''}`).join('\n');
  assert.ok(all.includes('12'), 'the LCD of 4 and 6 is 12 and should be shown');
});

test('fraction subtraction is exact', () => {
  const e = explainFraction('sub', new Frac(3, 4), new Frac(1, 8));
  assert.equal(e.exact.toString(), '5/8');
});

test('fraction multiplication cancels down', () => {
  const e = explainFraction('mul', new Frac(2, 3), new Frac(3, 4));
  assert.equal(e.exact.toString(), '1/2');
  assertWellFormed(e, 'frac-mul');
});

test('fraction division uses the reciprocal', () => {
  const e = explainFraction('div', new Frac(1, 2), new Frac(3, 4));
  assert.equal(e.exact.toString(), '2/3');
  const all = e.steps.map(s => `${s.text} ${s.detail || ''}`).join(' ');
  assert.ok(/reciprocal/i.test(all), 'should mention the reciprocal');
});

test('exhaustive: fraction results are exact across many pairs', () => {
  for (let d1 = 2; d1 <= 9; d1++) {
    for (let d2 = 2; d2 <= 9; d2++) {
      for (const op of ['add', 'sub', 'mul', 'div']) {
        const f1 = new Frac(1, d1), f2 = new Frac(1, d2);
        const e = explainFraction(op, f1, f2);
        const expect = { add: f1.add(f2), sub: f1.sub(f2), mul: f1.mul(f2), div: f1.div(f2) }[op];
        assert.equal(e.exact.toString(), expect.toString(), `${op} 1/${d1},1/${d2}`);
        assertWellFormed(e, `${op} 1/${d1},1/${d2}`);
      }
    }
  }
});

// ── percentages ─────────────────────────────────────────────
test('percent-of is correct and offers more than one method', () => {
  const e = explainPercentOf(15, 240);
  assertWellFormed(e, 'percent');
  assert.equal(e.answer, 36);
  assertConcludes(e, 36, 'percent');
  assert.ok(e.alternatives.length >= 2, 'should show alternative methods');
});

test('percent change handles an increase and a decrease', () => {
  const up = explainPercentChange(200, 250);
  assert.equal(up.answer, 25);
  assertWellFormed(up, 'pct-up');

  const down = explainPercentChange(200, 150);
  assert.equal(down.answer, -25);
  assertWellFormed(down, 'pct-down');
});

// ── powers and roots ────────────────────────────────────────
test('powers expand into repeated multiplication', () => {
  const e = explainPower(3, 4);
  assertWellFormed(e, 'power');
  assert.equal(e.answer, 81);
  assertConcludes(e, 81, 'power');
  const detail = e.steps.map(s => s.detail || '').join('\n');
  assert.ok(detail.includes('3 × 3 × 3 × 3'), 'should show the expansion');
});

test('a zero exponent is explained, not fudged', () => {
  const e = explainPower(7, 0);
  assert.equal(e.answer, 1);
  assertWellFormed(e, 'power-0');
});

test('a negative exponent becomes a reciprocal', () => {
  const e = explainPower(2, -3);
  assert.equal(e.answer, 0.125);
  assertWellFormed(e, 'power-neg');
});

test('exact square roots are verified by squaring back', () => {
  const e = explainRoot(144, 2);
  assertWellFormed(e, 'root');
  assert.equal(e.answer, 12);
  const all = e.steps.map(s => `${s.text} ${s.detail || ''}`).join(' ');
  assert.ok(all.includes('144'), 'should reference the number itself');
});

test('cube roots work too', () => {
  assert.equal(explainRoot(125, 3).answer, 5);
});

test('a non-perfect square is bracketed between whole numbers', () => {
  const e = explainRoot(50, 2);
  assertWellFormed(e, 'root-inexact');
  assert.ok(Math.abs(e.answer - Math.sqrt(50)) < 0.001);
  const all = e.steps.map(s => `${s.text} ${s.detail || ''}`).join(' ');
  assert.ok(all.includes('49') && all.includes('64'), 'should bracket 50 between 7² and 8²');
});

test('exhaustive: perfect squares always resolve exactly', () => {
  for (let r = 2; r <= 25; r++) {
    const e = explainRoot(r * r, 2);
    assert.equal(e.answer, r, `√${r * r}`);
    assertWellFormed(e, `root ${r * r}`);
  }
});

// ── algebra ─────────────────────────────────────────────────
test('linear equations are solved and checked by substitution', () => {
  const e = explainLinear(3, 5, 20); // 3x + 5 = 20
  assertWellFormed(e, 'linear');
  assert.equal(e.answer, 5);
  assertConcludes(e, 5, 'linear');
  const all = e.steps.map(s => `${s.text} ${s.detail || ''}`).join(' ');
  assert.ok(all.includes('✓'), 'should verify the solution');
});

test('linear equations handle a negative constant', () => {
  const e = explainLinear(4, -7, 13); // 4x - 7 = 13
  assert.equal(e.answer, 5);
  assertWellFormed(e, 'linear-neg');
});

test('linear equations handle a negative solution', () => {
  const e = explainLinear(2, 10, 4); // 2x + 10 = 4  -> x = -3
  assert.equal(e.answer, -3);
  assertWellFormed(e, 'linear-negx');
});

test('exhaustive: linear solutions are always right', () => {
  for (let a = 2; a <= 9; a++) {
    for (let x = -6; x <= 9; x++) {
      for (const b of [-13, -1, 4, 17]) {
        const c = a * x + b;
        const e = explainLinear(a, b, c);
        assert.equal(e.answer, x, `${a}x + ${b} = ${c}`);
      }
    }
  }
});

test('simplifying collects like terms and evaluates', () => {
  const e = explainSimplify(
    { xCoef: 7, constant: 9, parts: ['4x', '+', '3x', '+', '5', '+', '4'] },
    3
  );
  assertWellFormed(e, 'simplify');
  assert.equal(e.expression, '7x + 9');
  assert.equal(e.answer, 30); // 7*3 + 9
});

test('simplifying handles a negative constant', () => {
  const e = explainSimplify(
    { xCoef: 2, constant: -6, parts: ['5x', '−', '3x', '+', '4', '−', '10'] },
    5
  );
  assert.equal(e.expression, '2x − 6');
  assert.equal(e.answer, 4); // 2*5 - 6
});

// ── alternatives are genuinely alternative ──────────────────
test('where alternatives exist they reach the same answer', () => {
  const cases = [
    explainAdd(47, 38),
    explainSub(500, 237),
    explainMul(24, 18),
    explainPercentOf(20, 350),
  ];
  for (const e of cases) {
    for (const alt of e.alternatives) {
      const last = alt.steps[alt.steps.length - 1];
      const joined = `${last.text} ${last.detail || ''}`;
      assert.ok(
        joined.includes(fmt(e.answer)) || alt.steps.some(s => `${s.text} ${s.detail || ''}`.includes(fmt(e.answer))),
        `alternative "${alt.name}" never states the answer ${fmt(e.answer)}`
      );
    }
  }
});
