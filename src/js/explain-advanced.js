// explain-advanced.js — fractions, percentages, powers/roots, algebra.
// Same contract as explain.js: every line is computed, never canned.

import { Frac, gcd, lcm, fmt, primeFactors, round } from './util.js';

const S = (text, detail) => (detail ? { text, detail } : { text });

// ─────────────────────────────────────────────────────────────
// FRACTIONS  (+ − × ÷)
// ─────────────────────────────────────────────────────────────
export function explainFraction(op, f1, f2) {
  const A = Frac.from(f1), B = Frac.from(f2);
  const sym = { add: '+', sub: '−', mul: '×', div: '÷' }[op];
  const steps = [S(`Work out ${A} ${sym} ${B}.`)];
  let result;

  if (op === 'add' || op === 'sub') {
    const L = lcm(A.d, B.d);
    result = op === 'add' ? A.add(B) : A.sub(B);
    if (A.d === B.d) {
      steps.push(S(
        `The denominators already match, so ${op === 'add' ? 'add' : 'subtract'} the numerators.`,
        `(${A.n} ${sym} ${B.n}) / ${A.d} = ${op === 'add' ? A.n + B.n : A.n - B.n}/${A.d}`
      ));
    } else {
      const ma = L / A.d, mb = L / B.d;
      steps.push(S(
        `The denominators differ, so find the lowest common denominator of ${A.d} and ${B.d}.`,
        `LCD = ${L}`
      ));
      steps.push(S(
        `Rewrite both fractions over ${L}.`,
        `${A} = ${A.n}×${ma}/${A.d}×${ma} = ${A.n * ma}/${L}\n${B} = ${B.n}×${mb}/${B.d}×${mb} = ${B.n * mb}/${L}`
      ));
      const rn = op === 'add' ? A.n * ma + B.n * mb : A.n * ma - B.n * mb;
      steps.push(S(
        `Now ${op === 'add' ? 'add' : 'subtract'} the numerators.`,
        `(${A.n * ma} ${sym} ${B.n * mb}) / ${L} = ${rn}/${L}`
      ));
      const g = gcd(rn, L);
      if (g > 1) {
        steps.push(S(
          `Simplify by dividing top and bottom by ${g}.`,
          `${rn}/${L} = ${rn / g}/${L / g}`
        ));
      }
    }
  } else if (op === 'mul') {
    result = A.mul(B);
    steps.push(S(
      `Multiply straight across: numerators together, denominators together.`,
      `${A.n}×${B.n} / ${A.d}×${B.d} = ${A.n * B.n}/${A.d * B.d}`
    ));
    const g = gcd(A.n * B.n, A.d * B.d);
    if (g > 1) {
      steps.push(S(
        `Divide top and bottom by ${g} to simplify.`,
        `${A.n * B.n}/${A.d * B.d} = ${result}`
      ));
    }
  } else {
    result = A.div(B);
    steps.push(S(
      `Dividing by a fraction is the same as multiplying by its reciprocal.`,
      `${A} ÷ ${B} = ${A} × ${new Frac(B.d, B.n)}`
    ));
    steps.push(S(
      `Multiply across.`,
      `${A.n}×${B.d} / ${A.d}×${B.n} = ${A.n * B.d}/${A.d * B.n}`
    ));
    const g = gcd(Math.abs(A.n * B.d), Math.abs(A.d * B.n));
    if (g > 1) steps.push(S(`Simplify by ${g}: ${result}.`));
  }

  steps.push(S(`Answer: ${result}${result.d !== 1 ? ` (= ${fmt(result.value)})` : ''}.`));

  const alternatives = [];
  if (op === 'add' || op === 'sub') {
    // Decimal cross-check.
    alternatives.push({
      name: 'Decimal check',
      steps: [
        S(`${A} = ${fmt(A.value)} and ${B} = ${fmt(B.value)}.`),
        S(`${fmt(A.value)} ${sym} ${fmt(B.value)} = ${fmt(result.value)}.`),
        S(`That matches ${result}. ✓`),
      ],
    });
    // Cross-multiplication shortcut for two fractions.
    if (A.d !== B.d) {
      const n = op === 'add' ? A.n * B.d + B.n * A.d : A.n * B.d - B.n * A.d;
      const d = A.d * B.d;
      alternatives.push({
        name: 'Cross-multiply',
        steps: [
          S(`Use (a·d ${sym} c·b) / (b·d) directly.`),
          S(`(${A.n}×${B.d} ${sym} ${B.n}×${A.d}) / (${A.d}×${B.d}) = ${n}/${d}.`),
          S(`Simplify: ${new Frac(n, d)}.`),
        ],
      });
    }
  }
  if (op === 'mul') {
    const g1 = gcd(Math.abs(A.n), B.d), g2 = gcd(Math.abs(B.n), A.d);
    if (g1 > 1 || g2 > 1) {
      alternatives.push({
        name: 'Cancel first',
        steps: [
          S(`Cancel common factors before multiplying — smaller numbers, same answer.`),
          S(`${g1 > 1 ? `${A.n} and ${B.d} share ${g1}. ` : ''}${g2 > 1 ? `${B.n} and ${A.d} share ${g2}.` : ''}`),
          S(`After cancelling you get ${result} straight away.`),
        ],
      });
    }
  }
  return { steps, alternatives, answer: result.value, exact: result };
}

// ─────────────────────────────────────────────────────────────
// PERCENTAGES
// ─────────────────────────────────────────────────────────────
export function explainPercentOf(pct, total) {
  const answer = (pct / 100) * total;
  const steps = [
    S(`Find ${pct}% of ${total}.`),
    S(`"Per cent" means "per hundred", so ${pct}% = ${pct}/100 = ${fmt(pct / 100)}.`),
    S(`Multiply: ${fmt(pct / 100)} × ${total} = ${fmt(answer)}.`),
  ];

  const alternatives = [];
  // 1% building block.
  const onePct = total / 100;
  alternatives.push({
    name: 'Build from 1%',
    steps: [
      S(`1% of ${total} = ${total} ÷ 100 = ${fmt(onePct)}.`),
      S(`So ${pct}% = ${pct} × ${fmt(onePct)} = ${fmt(answer)}.`),
    ],
  });
  // 10% chunks when the percentage is a multiple of 5.
  if (pct % 5 === 0) {
    const tenPct = total / 10;
    const tens = Math.floor(pct / 10);
    const halfLeft = pct % 10 === 5;
    const lines = [S(`10% of ${total} = ${fmt(tenPct)}.`)];
    if (tens) lines.push(S(`${tens} × 10% = ${tens * 10}% = ${fmt(tens * tenPct)}.`));
    if (halfLeft) lines.push(S(`5% is half of 10% = ${fmt(tenPct / 2)}.`));
    lines.push(S(`Total: ${fmt(answer)}.`));
    alternatives.push({ name: 'Chunk in 10%s', steps: lines });
  }
  // Swap trick: a% of b == b% of a.
  if (pct !== total) {
    alternatives.push({
      name: 'Swap the numbers',
      steps: [
        S(`${pct}% of ${total} is the same as ${fmt(total)}% of ${pct}.`),
        S(`Sometimes that is far easier: ${fmt(total)}% of ${pct} = ${fmt(answer)}.`),
      ],
    });
  }
  return { steps, alternatives, answer };
}

export function explainPercentChange(from, to) {
  const diff = to - from;
  const pct = (diff / from) * 100;
  const up = diff >= 0;
  const steps = [
    S(`Find the percentage change from ${from} to ${to}.`),
    S(`Change = ${to} − ${from} = ${fmt(diff)} (${up ? 'an increase' : 'a decrease'}).`),
    S(`Divide by the ORIGINAL amount: ${fmt(diff)} ÷ ${from} = ${fmt(round(diff / from, 6))}.`),
    S(`Multiply by 100: ${fmt(round(diff / from, 6))} × 100 = ${fmt(round(pct, 4))}%.`),
  ];
  const alternatives = [{
    name: 'Multiplier method',
    steps: [
      S(`New ÷ old = ${to} ÷ ${from} = ${fmt(round(to / from, 6))}.`),
      S(`Subtract 1: ${fmt(round(to / from, 6))} − 1 = ${fmt(round(to / from - 1, 6))}.`),
      S(`As a percentage: ${fmt(round(pct, 4))}%.`),
    ],
  }];
  return { steps, alternatives, answer: round(pct, 4) };
}

// ─────────────────────────────────────────────────────────────
// POWERS AND ROOTS
// ─────────────────────────────────────────────────────────────
export function explainPower(base, exp) {
  const answer = Math.pow(base, exp);
  const steps = [S(`Work out ${base}^${exp}.`)];

  if (Number.isInteger(exp) && exp > 0 && exp <= 8) {
    steps.push(S(
      `The exponent ${exp} means ${base} multiplied by itself ${exp} time${exp === 1 ? '' : 's'}.`,
      Array(exp).fill(base).join(' × ')
    ));
    let running = 1;
    const lines = [];
    for (let i = 0; i < exp; i++) {
      const next = running * base;
      lines.push(`${i === 0 ? '' : `${running} × ${base} = `}${i === 0 ? `${base}` : next}`);
      running = next;
    }
    steps.push(S(`Multiply step by step.`, lines.join('\n')));
  } else if (exp === 0) {
    steps.push(S(`Anything (except 0) to the power 0 is 1.`));
  } else if (exp < 0) {
    steps.push(S(
      `A negative exponent means one over the positive power.`,
      `${base}^${exp} = 1 / ${base}^${Math.abs(exp)} = 1 / ${Math.pow(base, Math.abs(exp))}`
    ));
  }
  steps.push(S(`${base}^${exp} = ${fmt(answer)}.`));

  const alternatives = [];
  if (Number.isInteger(exp) && exp >= 4 && exp % 2 === 0) {
    const half = exp / 2;
    const h = Math.pow(base, half);
    alternatives.push({
      name: 'Square a smaller power',
      steps: [
        S(`${base}^${exp} = (${base}^${half})².`),
        S(`${base}^${half} = ${fmt(h)}.`),
        S(`${fmt(h)}² = ${fmt(answer)}.`),
      ],
    });
  }
  return { steps, alternatives, answer };
}

export function explainRoot(n, degree = 2) {
  const answer = degree === 2 ? Math.sqrt(n) : Math.cbrt(n);
  const label = degree === 2 ? '√' : '∛';
  const steps = [S(`Work out ${label}${n}.`)];
  const exact = Number.isInteger(round(answer, 9));
  const r = Math.round(answer);

  if (exact) {
    steps.push(S(
      `Ask: what number times itself ${degree === 2 ? 'once' : 'twice'} more gives ${n}?`
    ));
    const pf = primeFactors(n);
    if (pf.length) {
      steps.push(S(
        `Factorise ${n} into primes.`,
        `${n} = ${pf.map(([p, c]) => (c > 1 ? `${p}^${c}` : `${p}`)).join(' × ')}`
      ));
      steps.push(S(
        `Take one factor out of every group of ${degree}.`,
        pf.map(([p, c]) => `${p}^${c} → ${p}^${c / degree}`).join('\n')
      ));
    }
    steps.push(S(`Check: ${r}${degree === 2 ? ' × ' + r : ' × ' + r + ' × ' + r} = ${Math.pow(r, degree)}. ✓`));
  } else {
    const lo = Math.floor(answer), hi = lo + 1;
    steps.push(S(
      `${n} is not a perfect ${degree === 2 ? 'square' : 'cube'}, so estimate between whole numbers.`,
      `${lo}^${degree} = ${Math.pow(lo, degree)}\n${hi}^${degree} = ${Math.pow(hi, degree)}\nSo the answer lies between ${lo} and ${hi}.`
    ));
    steps.push(S(`Refining gives ${fmt(round(answer, 4))}.`));
  }
  steps.push(S(`${label}${n} = ${fmt(round(answer, 4))}.`));
  return { steps, alternatives: [], answer: round(answer, 4) };
}

// ─────────────────────────────────────────────────────────────
// ALGEBRA — solve ax + b = c, and simplify like terms
// ─────────────────────────────────────────────────────────────
export function explainLinear(a, b, c) {
  // a·x + b = c
  const x = (c - b) / a;
  const bTerm = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
  const steps = [
    S(`Solve ${a}x ${bTerm} = ${c} for x.`),
    S(
      `Undo the ${b < 0 ? 'subtraction' : 'addition'}: ${b < 0 ? 'add' : 'subtract'} ${Math.abs(b)} on both sides.`,
      `${a}x ${bTerm} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${c} ${b < 0 ? '+' : '−'} ${Math.abs(b)}\n${a}x = ${c - b}`
    ),
    S(
      `Undo the multiplication: divide both sides by ${a}.`,
      `${a}x ÷ ${a} = ${c - b} ÷ ${a}\nx = ${fmt(x)}`
    ),
    S(
      `Check by substituting back.`,
      `${a} × ${fmt(x)} ${bTerm} = ${fmt(a * x)} ${bTerm} = ${fmt(a * x + b)} ✓`
    ),
    S(`x = ${fmt(x)}.`),
  ];

  const alternatives = [{
    name: 'Rearrange the formula first',
    steps: [
      S(`Rearrange ax + b = c into x = (c − b) / a.`),
      S(`Substitute: x = (${c} − ${b}) / ${a}.`),
      S(`x = ${fmt(c - b)} / ${a} = ${fmt(x)}.`),
    ],
  }];
  return { steps, alternatives, answer: round(x, 6) };
}

export function explainSimplify(terms, xValue) {
  // terms: {x: coefficient, c: constant} collected from a generated expression
  const { xCoef, constant, parts } = terms;
  const steps = [
    S(`Simplify ${parts.join(' ')}.`),
    S(
      `Group the like terms together.`,
      `x terms: ${parts.filter(p => p.includes('x')).join(' ')}\nnumbers: ${parts.filter(p => !p.includes('x') && p !== '+' && p !== '−').join(' ')}`
    ),
    S(`Add the x coefficients: that gives ${xCoef}x.`),
    S(`Add the constants: that gives ${constant >= 0 ? constant : `${constant}`}.`),
  ];
  const expr = `${xCoef}x ${constant < 0 ? '−' : '+'} ${Math.abs(constant)}`;
  steps.push(S(`Simplified: ${expr}.`));
  if (xValue !== undefined) {
    const val = xCoef * xValue + constant;
    steps.push(S(
      `With x = ${xValue}:`,
      `${xCoef} × ${xValue} ${constant < 0 ? '−' : '+'} ${Math.abs(constant)} = ${fmt(val)}`
    ));
    return { steps, alternatives: [], answer: val, expression: expr };
  }
  return { steps, alternatives: [], answer: null, expression: expr };
}
