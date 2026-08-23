// curriculum.js — what each league asks, and how long it allows.
//
// The ladder runs from primary arithmetic to first-year university work,
// following the shape of the Ugandan syllabus (UNEB O-level, then A-level Pure
// Maths) and the topic order used in Backhouse's *Pure Mathematics* and
// Sadler & Thorning's *Understanding Pure Mathematics*.
//
// Questions come in two kinds:
//
//   • **numeric** — the student types a single number. Used wherever the
//     answer genuinely is one value.
//   • **choice** — four options, one right. This is what makes the harder
//     topics possible at all: "differentiate x³ ln x" has an *expression* for
//     an answer, and marking typed algebra is unreliable enough that a correct
//     student would sometimes be told they were wrong. Picking an option is
//     also how UNEB and most university papers ask these.
//
// Every generator derives its working from the same numbers that produced the
// answer, so an explanation can never contradict the mark.

import { randInt, pick, shuffle, round, gcd } from './util.js';

// ── league configuration ───────────────────────────────────────────────────

// Harder topics need thinking time, not speed. Bronze stays brisk mental
// arithmetic; by Vibranium a question is a page of working, so the clock comes
// off entirely rather than being set to something arbitrary and stressful.
export const LEAGUE_PLAN = {
  bronze: {
    label: 'Bronze',
    stage: 'Mental arithmetic',
    questions: 20,
    seconds: 45,
    topics: ['add', 'sub', 'mul', 'div'],
  },
  silver: {
    label: 'Silver',
    stage: 'O-level · S1–S3',
    questions: 15,
    seconds: 75,
    topics: ['fraction', 'percent', 'percentChange', 'ratio', 'indices',
             'hcflcm', 'linear'],
  },
  gold: {
    label: 'Gold',
    stage: 'O-level · S3–S4 (UNEB)',
    questions: 12,
    seconds: 120,
    topics: ['quadratic', 'simultaneous', 'surds', 'logarithm', 'sequence',
             'pythagoras', 'factorise', 'simplify'],
  },
  diamond: {
    label: 'Diamond',
    stage: 'A-level Pure · S5',
    questions: 10,
    seconds: 180,
    topics: ['trigEquation', 'trigIdentity', 'coordGeometry', 'circle',
             'binomial', 'remainder', 'rationalise'],
  },
  platinum: {
    label: 'Platinum',
    stage: 'A-level Pure · S6',
    questions: 8,
    seconds: 300,
    topics: ['differentiate', 'derivativeOf', 'integrate', 'integralOf',
             'vectors', 'complex', 'series', 'stationary'],
  },
  vibranium: {
    label: 'Vibranium',
    stage: 'University year 1',
    questions: 6,
    seconds: null,               // untimed — these need real working
    topics: ['substitution', 'byParts', 'determinant', 'diffEquation',
             'partialFractions', 'limit', 'maclaurin'],
  },
};

export const LEAGUE_ORDER = ['bronze', 'silver', 'gold', 'diamond',
                             'platinum', 'vibranium'];

export function planFor(leagueKey) {
  return LEAGUE_PLAN[leagueKey] || LEAGUE_PLAN.bronze;
}

// ── small helpers ──────────────────────────────────────────────────────────

const sup = n => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d] ?? d).join('');
const sub = n => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d] ?? d).join('');
const term = (c, v) => (c === 1 ? v : c === -1 ? `−${v}` : `${c}${v}`);
const plus = n => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);
const nonZero = (lo, hi) => { let v = 0; while (v === 0) v = randInt(lo, hi); return v; };

/**
 * Two distinct non-zero roots that are not each other's negative.
 *
 * Nudging a clash with `r2 = r1 + 1` looks harmless but can land on zero,
 * which prints the nonsense factor "(x + 0)". Mirrored roots are also barred
 * because they make the sign-flipped distractors collapse into each other,
 * leaving a multiple-choice question with fewer than four options.
 */
function rootPair(lo = -7, hi = 7) {
  for (;;) {
    const r1 = nonZero(lo, hi);
    const r2 = nonZero(lo, hi);
    if (r1 !== r2 && r1 !== -r2) return [r1, r2];
  }
}

const factorial = n => { let r = 1; for (let i = 2; i <= n; i += 1) r *= i; return r; };
const choose = (n, k) => factorial(n) / (factorial(k) * factorial(n - k));

function polyText(coeffs) {
  const n = coeffs.length - 1;
  const parts = [];
  coeffs.forEach((c, i) => {
    const p = n - i;
    if (c === 0) return;
    const v = p === 0 ? '' : p === 1 ? 'x' : `x${sup(p)}`;
    const body = p === 0 ? String(Math.abs(c)) : term(Math.abs(c), v);
    parts.push(parts.length === 0 ? (c < 0 ? `−${body}` : body)
                                  : `${c < 0 ? '−' : '+'} ${body}`);
  });
  return parts.join(' ') || '0';
}

/**
 * Build a multiple-choice question. `wrong` are the distractors — they should
 * be the mistakes a student actually makes, not random noise, or the right
 * answer stands out and the question tests nothing.
 */
function choiceQuestion({ topic, prompt, promptPlain, correct, wrong, steps, hint }) {
  const unique = [];
  for (const w of wrong) {
    if (String(w) !== String(correct) && !unique.includes(String(w))) {
      unique.push(String(w));
    }
  }
  if (unique.length < 3) {
    throw new Error(
      `"${prompt}" only produced ${unique.length} distinct wrong options; a `
      + 'multiple-choice question needs three. Fix the distractors.');
  }
  const choices = shuffle([String(correct), ...unique.slice(0, 3)]);
  return {
    kind: 'choice',
    topic,
    prompt,
    promptPlain: promptPlain || prompt,
    choices,
    answerIndex: choices.indexOf(String(correct)),
    answerText: String(correct),
    hint: hint || 'Choose the correct option.',
    steps,
  };
}

// ── Silver: O-level foundations ────────────────────────────────────────────

function genRatio() {
  const a = randInt(2, 9), b = randInt(2, 9);
  const unit = randInt(3, 20);
  const total = (a + b) * unit;
  const larger = Math.max(a, b) * unit;
  return {
    topic: 'Ratio',
    prompt: `Share ${total} in the ratio ${a} : ${b}. What is the larger share?`,
    answer: larger,
    hint: 'Work out the value of one part first.',
    steps: [
      `The ratio has ${a} + ${b} = ${a + b} parts altogether.`,
      `One part is ${total} ÷ ${a + b} = ${unit}.`,
      `The shares are ${a} × ${unit} = ${a * unit} and ${b} × ${unit} = ${b * unit}.`,
      `The larger share is ${larger}.`,
    ],
  };
}

function genIndices() {
  const base = randInt(2, 6);
  const p = randInt(2, 5), q = randInt(1, 4);
  const answer = base ** (p + q);
  return {
    topic: 'Indices',
    prompt: `${base}${sup(p)} × ${base}${sup(q)}`,
    promptPlain: `${base}^${p} x ${base}^${q}`,
    answer,
    steps: [
      'Multiplying powers of the same base means adding the indices.',
      `${base}${sup(p)} × ${base}${sup(q)} = ${base}${sup(p + q)}.`,
      `${base}${sup(p + q)} = ${answer}.`,
    ],
  };
}

function genHcfLcm() {
  const wantHcf = Math.random() < 0.5;
  const a = randInt(8, 60), b = randInt(8, 60);
  const h = gcd(a, b);
  const l = (a * b) / h;
  return {
    topic: wantHcf ? 'HCF' : 'LCM',
    prompt: `Find the ${wantHcf ? 'HCF' : 'LCM'} of ${a} and ${b}`,
    answer: wantHcf ? h : l,
    steps: wantHcf
      ? [`The highest number dividing both ${a} and ${b} is ${h}.`,
         `Check: ${a} = ${h} × ${a / h}, and ${b} = ${h} × ${b / h}.`]
      : [`The HCF of ${a} and ${b} is ${h}.`,
         `LCM = (${a} × ${b}) ÷ HCF = ${a * b} ÷ ${h} = ${l}.`],
  };
}

// ── Gold: O-level / UNEB ───────────────────────────────────────────────────

function genQuadratic() {
  const [r1, r2] = rootPair(-9, 9);
  const b = -(r1 + r2), c = r1 * r2;
  const larger = Math.max(r1, r2);
  return {
    topic: 'Quadratic equations',
    prompt: `Solve x² ${plus(b)}x ${plus(c)} = 0. Give the larger root.`,
    answer: larger,
    hint: 'Factorise, or use the formula.',
    steps: [
      `Find two numbers multiplying to ${c} and adding to ${b}.`,
      `They are ${-r1} and ${-r2}, so it factorises as (x ${plus(-r1)})(x ${plus(-r2)}) = 0.`,
      `So x = ${r1} or x = ${r2}.`,
      `The larger root is ${larger}.`,
    ],
  };
}

function genSimultaneous() {
  const x = nonZero(-8, 9), y = nonZero(-8, 9);
  const a1 = nonZero(1, 6), b1 = nonZero(1, 6);
  const a2 = nonZero(1, 6), b2 = nonZero(1, 6);
  if (a1 * b2 - a2 * b1 === 0) return genSimultaneous();   // no unique solution
  const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y;
  return {
    topic: 'Simultaneous equations',
    prompt: `${term(a1, 'x')} ${plus(b1)}y = ${c1}  and  ${term(a2, 'x')} ${plus(b2)}y = ${c2}.  Find x.`,
    answer: x,
    hint: 'Eliminate one unknown.',
    steps: [
      `Multiply the first equation by ${b2} and the second by ${b1} to match the y terms.`,
      `Subtracting removes y and leaves x = ${x}.`,
      `Substituting back gives y = ${y}.`,
      `Check: ${a1}(${x}) ${plus(b1)}(${y}) = ${c1}. ✓`,
    ],
  };
}

function genSurds() {
  const n = pick([2, 3, 5, 6, 7]);
  const p = randInt(2, 6), q = randInt(2, 6);
  const first = p * p * n, second = q * q * n;
  return {
    topic: 'Surds',
    prompt: `√${first} + √${second} = k√${n}.  Find k.`,
    answer: p + q,
    hint: 'Simplify each surd first.',
    steps: [
      `√${first} = √(${p * p} × ${n}) = ${p}√${n}.`,
      `√${second} = √(${q * q} × ${n}) = ${q}√${n}.`,
      `${p}√${n} + ${q}√${n} = ${p + q}√${n}.`,
      `So k = ${p + q}.`,
    ],
  };
}

function genLogarithm() {
  const base = pick([2, 3, 5, 10]);
  const n = randInt(2, base === 2 ? 8 : 5);
  const value = base ** n;
  return {
    topic: 'Logarithms',
    prompt: `log${sub(base)} ${value}`,
    promptPlain: `log base ${base} of ${value}`,
    answer: n,
    hint: `${base} raised to what power gives ${value}?`,
    steps: [
      `log${sub(base)} ${value} asks which power of ${base} gives ${value}.`,
      `${base}${sup(n)} = ${value}.`,
      `So the logarithm is ${n}.`,
    ],
  };
}

function genSequence() {
  if (Math.random() < 0.6) {
    const a = randInt(-8, 12), d = nonZero(-6, 8), n = randInt(6, 20);
    const answer = a + (n - 1) * d;
    return {
      topic: 'Sequences',
      prompt: `An AP starts at ${a} with common difference ${d}. Find the ${n}th term.`,
      answer,
      steps: [
        'For an arithmetic progression the nth term is a + (n − 1)d.',
        `= ${a} + (${n} − 1)(${d}) = ${a} + ${(n - 1) * d}`,
        `= ${answer}.`,
      ],
    };
  }
  const a = nonZero(1, 5), r = pick([2, 3]), n = randInt(4, 8);
  const answer = (a * (r ** n - 1)) / (r - 1);
  return {
    topic: 'Sequences',
    prompt: `A GP starts at ${a} with common ratio ${r}. Find the sum of the first ${n} terms.`,
    answer,
    steps: [
      'For a geometric progression, Sₙ = a(rⁿ − 1) ÷ (r − 1).',
      `= ${a}(${r ** n} − 1) ÷ ${r - 1}`,
      `= ${answer}.`,
    ],
  };
}

function genPythagoras() {
  const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 40, 41]]);
  const k = randInt(1, 4);
  const findHyp = Math.random() < 0.6;
  return {
    topic: 'Pythagoras',
    prompt: findHyp
      ? `A right-angled triangle has shorter sides ${a * k} and ${b * k}. Find the hypotenuse.`
      : `A right-angled triangle has hypotenuse ${c * k} and one shorter side ${a * k}. Find the other side.`,
    answer: findHyp ? c * k : b * k,
    steps: findHyp
      ? [`a² + b² = c², so c² = ${a * k}² + ${b * k}² = ${(c * k) ** 2}.`,
         `c = √${(c * k) ** 2} = ${c * k}.`]
      : [`a² + b² = c², so b² = ${c * k}² − ${a * k}² = ${(b * k) ** 2}.`,
         `b = √${(b * k) ** 2} = ${b * k}.`],
  };
}

function genFactorise() {
  const [r1, r2] = rootPair();
  const b = -(r1 + r2), c = r1 * r2;
  const f = (r) => `(x ${plus(-r)})`;
  return choiceQuestion({
    topic: 'Factorising',
    prompt: `Factorise x² ${plus(b)}x ${plus(c)}`,
    correct: `${f(r1)}${f(r2)}`,
    wrong: [`${f(-r1)}${f(-r2)}`, `${f(r1)}${f(-r2)}`, `${f(-r1)}${f(r2)}`],
    hint: 'The two numbers must multiply to the constant and add to the x coefficient.',
    steps: [
      `Look for two numbers multiplying to ${c} and adding to ${b}.`,
      `They are ${-r1} and ${-r2}.`,
      `So x² ${plus(b)}x ${plus(c)} = ${f(r1)}${f(r2)}.`,
    ],
  });
}

// ── Diamond: A-level Pure, first year ──────────────────────────────────────

const EXACT = [
  { angle: 30, sin: '1/2', cos: '√3/2' },
  { angle: 45, sin: '√2/2', cos: '√2/2' },
  { angle: 60, sin: '√3/2', cos: '1/2' },
];

function genTrigEquation() {
  const fn = pick(['sin', 'cos']);
  const e = pick(EXACT);
  const shown = fn === 'sin' ? e.sin : e.cos;
  return {
    topic: 'Trigonometric equations',
    prompt: `Solve ${fn} x = ${shown} for the smallest positive x, in degrees.`,
    answer: e.angle,
    unit: '°',
    hint: 'Use the exact values you know.',
    steps: [
      `${fn} ${e.angle}° = ${shown}.`,
      `The smallest positive solution is x = ${e.angle}°.`,
    ],
  };
}

function genTrigIdentity() {
  const items = [
    { q: 'sin 2x', a: '2 sin x cos x',
      wrong: ['2 sin x', 'sin²x − cos²x', 'sin x cos x'],
      why: 'This is the double-angle formula for sine.' },
    { q: 'cos 2x', a: 'cos²x − sin²x',
      wrong: ['2 cos x', 'sin²x − cos²x', '2 sin x cos x'],
      why: 'This is the double-angle formula for cosine.' },
    { q: 'sin²x + cos²x', a: '1',
      wrong: ['0', '2', 'sin 2x'],
      why: 'The Pythagorean identity.' },
    { q: '1 + tan²x', a: 'sec²x',
      wrong: ['cosec²x', 'cot²x', 'sec x'],
      why: 'Divide sin²x + cos²x = 1 through by cos²x.' },
  ];
  const it = pick(items);
  return choiceQuestion({
    topic: 'Trigonometric identities',
    prompt: `Simplify ${it.q}`,
    correct: it.a,
    wrong: it.wrong,
    steps: [it.why, `So ${it.q} = ${it.a}.`],
  });
}

function genRationalise() {
  const n = pick([2, 3, 5, 7]);
  const k = randInt(1, 6);
  return choiceQuestion({
    topic: 'Surds',
    prompt: `Rationalise the denominator of ${k}/√${n}`,
    promptPlain: `${k}/sqrt(${n})`,
    correct: `${k}√${n}/${n}`,
    wrong: [`${k}√${n}`, `√${n}/${k}`, `${k}/${n}`],
    hint: 'Multiply top and bottom by the surd.',
    steps: [
      `Multiply top and bottom by √${n}.`,
      `${k}/√${n} × √${n}/√${n} = ${k}√${n} / ${n}.`,
    ],
  });
}

function genCoordGeometry() {
  const x1 = randInt(-8, 8), y1 = randInt(-8, 8);
  const [dx, dy] = pick([[3, 4], [6, 8], [5, 12], [8, 15], [9, 12]]);
  const dist = Math.hypot(dx, dy);
  return {
    topic: 'Coordinate geometry',
    prompt: `Find the distance between (${x1}, ${y1}) and (${x1 + dx}, ${y1 + dy}).`,
    answer: dist,
    steps: [
      'Distance = √((x₂ − x₁)² + (y₂ − y₁)²).',
      `= √(${dx}² + ${dy}²) = √${dx * dx + dy * dy}`,
      `= ${dist}.`,
    ],
  };
}

function genCircle() {
  const h = randInt(-6, 6), k = randInt(-6, 6), r = randInt(2, 9);
  const c = h * h + k * k - r * r;
  const wantRadius = Math.random() < 0.5;
  return {
    topic: 'Circles',
    prompt: `The circle x² + y² ${plus(-2 * h)}x ${plus(-2 * k)}y ${plus(c)} = 0. Find its ${wantRadius ? 'radius' : 'centre x-coordinate'}.`,
    answer: wantRadius ? r : h,
    hint: 'Complete the square in x and in y.',
    steps: [
      `Completing the square gives (x ${plus(-h)})² + (y ${plus(-k)})² = ${r * r}.`,
      `So the centre is (${h}, ${k}) and the radius is ${r}.`,
      wantRadius ? `The radius is ${r}.` : `The centre's x-coordinate is ${h}.`,
    ],
  };
}

function genBinomial() {
  const n = randInt(4, 9);
  const k = randInt(2, Math.min(4, n - 1));
  const answer = choose(n, k);
  return {
    topic: 'Binomial theorem',
    prompt: `In the expansion of (1 + x)${sup(n)}, find the coefficient of x${sup(k)}.`,
    promptPlain: `coefficient of x^${k} in (1+x)^${n}`,
    answer,
    hint: 'It is a binomial coefficient.',
    steps: [
      `The coefficient of x${sup(k)} is C(${n}, ${k}).`,
      `C(${n}, ${k}) = ${n}! ÷ (${k}! × ${n - k}!)`,
      `= ${answer}.`,
    ],
  };
}

function genRemainder() {
  const a = nonZero(-4, 4);
  const c3 = randInt(1, 4), c2 = randInt(-5, 5), c1 = randInt(-6, 6), c0 = randInt(-9, 9);
  const value = c3 * a ** 3 + c2 * a ** 2 + c1 * a + c0;
  return {
    topic: 'Remainder theorem',
    prompt: `Find the remainder when ${polyText([c3, c2, c1, c0])} is divided by (x ${plus(-a)}).`,
    answer: value,
    hint: 'The remainder theorem saves the long division.',
    steps: [
      `Dividing by (x − a) leaves remainder p(a), with a = ${a}.`,
      `p(${a}) = ${c3}(${a})³ ${plus(c2)}(${a})² ${plus(c1)}(${a}) ${plus(c0)}`,
      `= ${value}.`,
    ],
  };
}

// ── Platinum: A-level Pure, second year ────────────────────────────────────

function genDifferentiate() {
  const a = randInt(1, 5), b = randInt(-6, 6), c = randInt(-8, 8);
  const at = nonZero(-4, 5);
  const answer = 3 * a * at * at + 2 * b * at + c;
  return {
    topic: 'Differentiation',
    prompt: `y = ${polyText([a, b, c, 0])}.  Find dy/dx at x = ${at}.`,
    answer,
    hint: 'Differentiate term by term, then substitute.',
    steps: [
      `dy/dx = ${3 * a}x² ${plus(2 * b)}x ${plus(c)}.`,
      `At x = ${at}: ${3 * a}(${at * at}) ${plus(2 * b)}(${at}) ${plus(c)}`,
      `= ${answer}.`,
    ],
  };
}

function genDerivativeOf() {
  const items = [
    { q: 'x ln x', a: 'ln x + 1', wrong: ['1/x', 'ln x', 'x/ln x'],
      why: 'Product rule: (x)(1/x) + (1)(ln x) = 1 + ln x.' },
    { q: 'sin 3x', a: '3 cos 3x', wrong: ['cos 3x', '−3 cos 3x', '3 sin 3x'],
      why: 'Chain rule: differentiate the outside, times the derivative of 3x.' },
    { q: 'e^(2x)', a: '2e^(2x)', wrong: ['e^(2x)', '2e^x', 'e^(2x)/2'],
      why: 'Chain rule: the derivative of 2x is 2.' },
    { q: 'tan x', a: 'sec²x', wrong: ['cot x', '−cosec²x', 'sec x tan x'],
      why: 'A standard derivative worth memorising.' },
    { q: '1/x', a: '−1/x²', wrong: ['1/x²', 'ln x', '−1/x'],
      why: 'Write it as x⁻¹, then bring the power down: −x⁻².' },
  ];
  const it = pick(items);
  return choiceQuestion({
    topic: 'Differentiation',
    prompt: `Differentiate ${it.q} with respect to x.`,
    correct: it.a,
    wrong: it.wrong,
    steps: [it.why, `So the derivative is ${it.a}.`],
  });
}

function genIntegrate() {
  const a = randInt(1, 4), b = randInt(-4, 5), upper = randInt(1, 4);
  const answer = a * upper ** 3 + b * upper ** 2;
  return {
    topic: 'Integration',
    prompt: `Evaluate ∫₀${sup(upper)} (${polyText([3 * a, 2 * b, 0])}) dx`,
    promptPlain: `integral from 0 to ${upper} of ${polyText([3 * a, 2 * b, 0])} dx`,
    answer,
    steps: [
      `Integrating gives ${a}x³ ${plus(b)}x².`,
      `At x = ${upper}: ${a}(${upper ** 3}) ${plus(b)}(${upper ** 2}) = ${answer}.`,
      'At x = 0 it is 0, so that is the value of the definite integral.',
    ],
  };
}

function genIntegralOf() {
  const items = [
    { q: '1/x', a: 'ln|x| + C', wrong: ['x⁻² + C', '1/(2x²) + C', 'x ln x + C'],
      why: 'The one power that does not follow the usual rule.' },
    { q: 'cos x', a: 'sin x + C', wrong: ['−sin x + C', 'tan x + C', '−cos x + C'],
      why: 'Integration undoes differentiation, and sin differentiates to cos.' },
    { q: 'sin x', a: '−cos x + C', wrong: ['cos x + C', '−sin x + C', 'sec x + C'],
      why: 'Since −cos x differentiates to sin x.' },
    { q: 'e^x', a: 'e^x + C', wrong: ['x e^x + C', 'e^x/x + C', 'ln x + C'],
      why: 'It is its own integral, up to the constant.' },
    { q: 'sec²x', a: 'tan x + C', wrong: ['sec x + C', 'cot x + C', '−tan x + C'],
      why: 'Since tan x differentiates to sec²x.' },
  ];
  const it = pick(items);
  return choiceQuestion({
    topic: 'Integration',
    prompt: `Find ∫ ${it.q} dx`,
    promptPlain: `integral of ${it.q} dx`,
    correct: it.a,
    wrong: it.wrong,
    steps: [it.why, `So ∫ ${it.q} dx = ${it.a}.`],
  });
}

function genVectors() {
  const a = [randInt(-6, 6), randInt(-6, 6), randInt(-6, 6)];
  const b = [randInt(-6, 6), randInt(-6, 6), randInt(-6, 6)];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return {
    topic: 'Vectors',
    prompt: `a = (${a.join(', ')}) and b = (${b.join(', ')}).  Find a · b.`,
    answer: dot,
    steps: [
      'The scalar product multiplies matching components and adds them.',
      `= (${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) + (${a[2]})(${b[2]})`,
      `= ${a[0] * b[0]} + ${a[1] * b[1]} + ${a[2] * b[2]} = ${dot}.`,
    ],
  };
}

function genComplex() {
  const [re, im] = pick([[3, 4], [5, 12], [8, 15], [7, 24], [6, 8], [9, 12]]);
  return {
    topic: 'Complex numbers',
    prompt: `Find |z| where z = ${re} + ${im}i`,
    answer: Math.hypot(re, im),
    steps: [
      'The modulus is √(real² + imaginary²).',
      `= √(${re * re} + ${im * im}) = √${re * re + im * im}`,
      `= ${Math.hypot(re, im)}.`,
    ],
  };
}

function genSeries() {
  const n = randInt(5, 25);
  const answer = (n * (n + 1)) / 2;
  return {
    topic: 'Series',
    prompt: `Find the sum 1 + 2 + 3 + … + ${n}`,
    answer,
    steps: [
      'The sum of the first n whole numbers is n(n + 1) ÷ 2.',
      `= ${n}(${n + 1}) ÷ 2 = ${n * (n + 1)} ÷ 2`,
      `= ${answer}.`,
    ],
  };
}

function genStationary() {
  const x0 = nonZero(-6, 6);
  const b = -2 * x0, c = randInt(-9, 9);
  return {
    topic: 'Stationary points',
    prompt: `y = x² ${plus(b)}x ${plus(c)}.  Find the x-coordinate of the stationary point.`,
    answer: x0,
    hint: 'Set dy/dx to zero.',
    steps: [
      `dy/dx = 2x ${plus(b)}.`,
      `Setting it to zero: 2x = ${-b}, so x = ${x0}.`,
    ],
  };
}

// ── Vibranium: first-year university ───────────────────────────────────────

function genSubstitution() {
  const upper = randInt(1, 3), k = randInt(2, 4);
  const top = (upper * upper + 1) ** k;
  const answer = (top - 1) / k;
  return {
    topic: 'Integration by substitution',
    prompt: `Evaluate ∫₀${sup(upper)} 2x(x² + 1)${sup(k - 1)} dx`,
    promptPlain: `integral 0 to ${upper} of 2x(x^2+1)^${k - 1} dx`,
    answer,
    hint: 'Let u = x² + 1.',
    steps: [
      'Let u = x² + 1, so du = 2x dx.',
      `The integral becomes ∫ u${sup(k - 1)} du = u${sup(k)} ÷ ${k}.`,
      `Back in x: (x² + 1)${sup(k)} ÷ ${k}, evaluated from 0 to ${upper}.`,
      `= (${top} − 1) ÷ ${k} = ${answer}.`,
    ],
  };
}

function genByParts() {
  const n = randInt(1, 3);
  const answer = round(n ** 4 / 4 + (2 * n ** 3) / 3 + n ** 2 / 2, 4);
  return {
    topic: 'Integration',
    prompt: `Evaluate ∫₀${sup(n)} x(x + 1)² dx`,
    promptPlain: `integral 0 to ${n} of x(x+1)^2 dx`,
    answer,
    hint: 'Expanding first is quicker than integrating by parts here.',
    steps: [
      'Expand: x(x + 1)² = x³ + 2x² + x.',
      'Integrating gives x⁴/4 + 2x³/3 + x²/2.',
      `At x = ${n} that is ${answer}, and at x = 0 it is 0.`,
    ],
  };
}

function genDeterminant() {
  const m = [[randInt(-6, 8), randInt(-6, 8)], [randInt(-6, 8), randInt(-6, 8)]];
  const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  return {
    topic: 'Matrices',
    prompt: `Find the determinant of the matrix with rows (${m[0].join(', ')}) and (${m[1].join(', ')}).`,
    answer: det,
    steps: [
      'For a 2×2 matrix the determinant is ad − bc.',
      `= (${m[0][0]})(${m[1][1]}) − (${m[0][1]})(${m[1][0]})`,
      `= ${m[0][0] * m[1][1]} − ${m[0][1] * m[1][0]} = ${det}.`,
    ],
  };
}

function genDiffEquation() {
  const k = randInt(1, 4), y0 = randInt(1, 9), at = randInt(1, 4);
  const answer = k * at ** 3 + y0;
  return {
    topic: 'Differential equations',
    prompt: `dy/dx = ${3 * k}x², and y = ${y0} when x = 0.  Find y when x = ${at}.`,
    answer,
    hint: 'Integrate, then use the condition to fix the constant.',
    steps: [
      `Integrating: y = ${k}x³ + C.`,
      `At x = 0, y = ${y0}, so C = ${y0}.`,
      `At x = ${at}: y = ${k}(${at ** 3}) + ${y0} = ${answer}.`,
    ],
  };
}

function genPartialFractions() {
  const p = randInt(1, 6), q = randInt(1, 6);
  const a = randInt(1, 5), b = a + randInt(1, 5);
  const A = round((q - p * a) / (b - a), 4);
  return {
    topic: 'Partial fractions',
    prompt: `(${p}x + ${q}) ÷ ((x + ${a})(x + ${b})) = A/(x + ${a}) + B/(x + ${b}).  Find A.`,
    answer: A,
    hint: 'Cover-up rule: substitute the value that kills the other bracket.',
    steps: [
      `Multiply through, then set x = ${-a} so the B term vanishes.`,
      `A = (${p}(${-a}) + ${q}) ÷ (${-a} + ${b}) = ${q - p * a} ÷ ${b - a}`,
      `= ${A}.`,
    ],
  };
}

function genLimit() {
  const a = randInt(2, 9);
  return {
    topic: 'Limits',
    prompt: `Find lim(x→${a}) (x² − ${a * a}) ÷ (x − ${a})`,
    promptPlain: `limit as x approaches ${a} of (x^2 - ${a * a})/(x - ${a})`,
    answer: 2 * a,
    hint: 'Factorise the numerator before substituting.',
    steps: [
      'Substituting straight away gives 0/0, so factorise first.',
      `x² − ${a * a} = (x − ${a})(x + ${a}).`,
      `Cancelling (x − ${a}) leaves x + ${a}, which tends to ${2 * a}.`,
    ],
  };
}

function genMaclaurin() {
  const items = [
    { f: 'eˣ', k: 2, a: '1/2', wrong: ['1', '1/6', '2'],
      why: 'eˣ = 1 + x + x²/2! + x³/3! + …, so the x² coefficient is 1/2! = 1/2.' },
    { f: 'sin x', k: 3, a: '−1/6', wrong: ['1/6', '−1/2', '1'],
      why: 'sin x = x − x³/3! + x⁵/5! − …, so the x³ coefficient is −1/3! = −1/6.' },
    { f: 'cos x', k: 2, a: '−1/2', wrong: ['1/2', '−1/6', '0'],
      why: 'cos x = 1 − x²/2! + x⁴/4! − …, so the x² coefficient is −1/2! = −1/2.' },
    { f: 'ln(1 + x)', k: 2, a: '−1/2', wrong: ['1/2', '1', '−1/3'],
      why: 'ln(1 + x) = x − x²/2 + x³/3 − …, so the x² coefficient is −1/2.' },
  ];
  const it = pick(items);
  return choiceQuestion({
    topic: 'Maclaurin series',
    prompt: `In the Maclaurin series for ${it.f}, what is the coefficient of x${sup(it.k)}?`,
    correct: it.a,
    wrong: it.wrong,
    steps: [it.why],
  });
}

// ── registry ───────────────────────────────────────────────────────────────

export const ADVANCED_GENERATORS = {
  ratio: genRatio, indices: genIndices, hcflcm: genHcfLcm,
  quadratic: genQuadratic, simultaneous: genSimultaneous, surds: genSurds,
  logarithm: genLogarithm, sequence: genSequence, pythagoras: genPythagoras,
  factorise: genFactorise,
  trigEquation: genTrigEquation, trigIdentity: genTrigIdentity,
  rationalise: genRationalise, coordGeometry: genCoordGeometry,
  circle: genCircle, binomial: genBinomial, remainder: genRemainder,
  differentiate: genDifferentiate, derivativeOf: genDerivativeOf,
  integrate: genIntegrate, integralOf: genIntegralOf,
  vectors: genVectors, complex: genComplex, series: genSeries,
  stationary: genStationary,
  substitution: genSubstitution, byParts: genByParts,
  determinant: genDeterminant, diffEquation: genDiffEquation,
  partialFractions: genPartialFractions, limit: genLimit,
  maclaurin: genMaclaurin,
};
