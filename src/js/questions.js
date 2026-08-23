// questions.js — generates questions and attaches the derived working.
// Each generator returns a full question object; the explanation is produced
// by the same numbers that produced the answer, so they cannot disagree.

import { randInt, pick, shuffle, Frac, fmt, round, gcd } from './util.js';
import { explainAdd, explainSub, explainMul, explainDiv } from './explain.js';
import {
  explainFraction, explainPercentOf, explainPercentChange,
  explainPower, explainRoot, explainLinear, explainSimplify,
} from './explain-advanced.js';
import { ADVANCED_GENERATORS, planFor } from './curriculum.js';

/**
 * Which topics each league asks now lives in curriculum.js, alongside the
 * question count and time allowance. What stays here is the difficulty
 * *level* handed to the older arithmetic generators, which take 1-4.
 */
export const LEAGUE_TIER = {
  bronze: 1, silver: 2, gold: 3, diamond: 4, platinum: 4, vibranium: 4,
};

// ── individual generators ───────────────────────────────────

function genAdd(level) {
  const max = [0, 50, 200, 999, 9999][level] || 99;
  const a = randInt(Math.floor(max / 6), max);
  const b = randInt(Math.floor(max / 6), max);
  const e = explainAdd(a, b);
  return { prompt: `${a} + ${b}`, answer: e.answer, ...e, topic: 'Addition' };
}

function genSub(level) {
  const max = [0, 50, 200, 999, 9999][level] || 99;
  let a = randInt(Math.floor(max / 4), max);
  let b = randInt(2, a - 1);
  const e = explainSub(a, b);
  return { prompt: `${a} − ${b}`, answer: e.answer, ...e, topic: 'Subtraction' };
}

function genMul(level) {
  const ranges = [null, [2, 12, 2, 9], [3, 15, 3, 12], [6, 40, 4, 25], [12, 99, 11, 60]];
  const [aLo, aHi, bLo, bHi] = ranges[level] || ranges[1];
  const a = randInt(aLo, aHi);
  const b = randInt(bLo, bHi);
  const e = explainMul(a, b);
  return { prompt: `${a} × ${b}`, answer: e.answer, ...e, topic: 'Multiplication' };
}

function genDiv(level) {
  const ranges = [null, [2, 10, 2, 10], [2, 12, 2, 12], [3, 20, 4, 25], [6, 40, 7, 60]];
  const [bLo, bHi, qLo, qHi] = ranges[level] || ranges[1];
  const b = randInt(bLo, bHi);
  const q = randInt(qLo, qHi);
  const a = b * q;
  const e = explainDiv(a, b);
  return { prompt: `${a} ÷ ${b}`, answer: e.answer, ...e, topic: 'Division' };
}

function genFraction(level) {
  const maxD = level >= 3 ? 12 : 8;
  const op = pick(level >= 3 ? ['add', 'sub', 'mul', 'div'] : ['add', 'sub', 'mul']);
  const d1 = randInt(2, maxD), d2 = randInt(2, maxD);
  const n1 = randInt(1, d1 - 1), n2 = randInt(1, d2 - 1);
  let f1 = new Frac(n1, d1), f2 = new Frac(n2, d2);
  if (op === 'sub' && f1.value < f2.value) [f1, f2] = [f2, f1];
  const e = explainFraction(op, f1, f2);
  const sym = { add: '+', sub: '−', mul: '×', div: '÷' }[op];
  return {
    prompt: `${f1} ${sym} ${f2}`,
    answer: e.answer,
    acceptText: [e.exact.toString(), fmt(e.answer)],
    hint: 'Answer as a fraction like 3/4, or as a decimal.',
    ...e,
    topic: 'Fractions',
  };
}

function genPercent(level) {
  const pcts = level >= 3 ? [5, 12, 15, 18, 22, 35, 45, 65, 85] : [10, 20, 25, 50, 75, 5, 30];
  const pct = pick(pcts);
  const total = level >= 3 ? randInt(4, 90) * 10 : pick([20, 40, 60, 80, 120, 200, 250, 400]);
  const e = explainPercentOf(pct, total);
  return { prompt: `${pct}% of ${total}`, answer: e.answer, ...e, topic: 'Percentages' };
}

function genPercentChange(level) {
  const from = randInt(2, 40) * 5;
  const factor = pick([0.5, 0.75, 0.8, 0.9, 1.1, 1.2, 1.25, 1.5, 2]);
  const to = round(from * factor, 2);
  const e = explainPercentChange(from, to);
  return {
    prompt: `Percentage change from ${from} to ${to}`,
    answer: e.answer,
    unit: '%',
    hint: 'Give the answer as a percentage (a negative number for a decrease).',
    ...e,
    topic: 'Percent change',
  };
}

function genPower(level) {
  const opts = level >= 4
    ? [[randInt(2, 12), randInt(2, 3)], [randInt(2, 6), randInt(3, 4)], [randInt(2, 9), 2]]
    : [[randInt(2, 10), 2], [randInt(2, 5), 3]];
  const [base, exp] = pick(opts);
  const e = explainPower(base, exp);
  return { prompt: `${base}${supers(exp)}`, promptPlain: `${base}^${exp}`, answer: e.answer, ...e, topic: 'Powers' };
}

function genRoot(level) {
  const degree = level >= 4 && Math.random() < 0.35 ? 3 : 2;
  const r = degree === 2 ? randInt(2, level >= 4 ? 20 : 12) : randInt(2, 8);
  const n = Math.pow(r, degree);
  const e = explainRoot(n, degree);
  return { prompt: `${degree === 2 ? '√' : '∛'}${n}`, answer: e.answer, ...e, topic: 'Roots' };
}

function genLinear(level) {
  const a = randInt(2, level >= 4 ? 12 : 6);
  const x = randInt(-9, 12);
  const b = randInt(-20, 20) || 3;
  const c = a * x + b;
  const e = explainLinear(a, b, c);
  const bTerm = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
  return {
    prompt: `${a}x ${bTerm} = ${c},  x = ?`,
    answer: e.answer,
    hint: 'Solve for x.',
    ...e,
    topic: 'Algebra',
  };
}

function genSimplify(level) {
  const a1 = randInt(2, 9), a2 = randInt(1, 9);
  const c1 = randInt(1, 15), c2 = randInt(1, 15);
  const subX = Math.random() < 0.4;
  const subC = Math.random() < 0.5;
  const xCoef = subX ? a1 - a2 : a1 + a2;
  const constant = subC ? c1 - c2 : c1 + c2;
  const parts = [`${a1}x`, subX ? '−' : '+', `${a2}x`, '+', `${c1}`, subC ? '−' : '+', `${c2}`];
  const xValue = randInt(2, 9);
  const e = explainSimplify({ xCoef, constant, parts }, xValue);
  return {
    prompt: `Simplify ${parts.join(' ')}, then evaluate at x = ${xValue}`,
    answer: e.answer,
    hint: 'Give the numeric value after substituting x.',
    ...e,
    topic: 'Algebra',
  };
}

function supers(n) {
  const map = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return String(n).split('').map(d => map[d] || d).join('');
}

const GENERATORS = {
  add: genAdd, sub: genSub, mul: genMul, div: genDiv,
  fraction: genFraction, percent: genPercent, percentChange: genPercentChange,
  power: genPower, root: genRoot, linear: genLinear, simplify: genSimplify,
};

/** Build plausible wrong options for multiple choice (used by 50/50). */
function makeOptions(answer) {
  const set = new Set([round(answer, 4)]);
  const jitters = [
    answer + 1, answer - 1, answer * 2, answer / 2,
    answer + 10, answer - 10, answer + Math.max(2, Math.round(Math.abs(answer) * 0.15)),
    -answer, answer + 0.5,
  ];
  for (const j of jitters) {
    const v = round(j, 4);
    if (set.size >= 4) break;
    if (isFinite(v) && v !== round(answer, 4)) set.add(v);
  }
  let guard = 0;
  while (set.size < 4 && guard++ < 50) set.add(round(answer + randInt(-25, 25), 4));
  return shuffle([...set]).slice(0, 4);
}

/**
 * Generate one question for a league.
 * @param {string} leagueKey
 * @param {string[]} [avoidTopics] recently used topics to reduce repeats
 */
/**
 * The working is rendered as { text, detail } objects. The curriculum
 * generators write plain strings because that keeps them readable, so they
 * are converted here - a raw string would render as a blank line, which is
 * exactly the "shows you the working" promise quietly failing.
 */
function normaliseSteps(steps) {
  return (steps || [])
    .map(s => (typeof s === 'string' ? { text: s } : s))
    .filter(s => s && typeof s.text === 'string' && s.text.trim());
}

/** −0 prints as "-0", which looks like a mistake to a student. */
const zeroSafe = n => (typeof n === 'number' && n === 0 ? 0 : n);

/**
 * Generate one question.
 *
 * @param {string} leagueKey
 * @param {string[]} avoidTopics  recently seen topics, to reduce repeats
 * @param {{topics: string[], tier: number}} [pool]
 *        An explicit pool, used by practice runs. When given it replaces the
 *        league's own topic list and difficulty entirely, so a practice run
 *        stays on the topic the player chose no matter which league they are in.
 */
export function generateQuestion(leagueKey = 'bronze', avoidTopics = [], pool = null) {
  const tier = pool?.tier || LEAGUE_TIER[leagueKey] || 1;
  let pool_ = pool?.topics?.length ? pool.topics : planFor(leagueKey).topics;
  const fresh = pool_.filter(t => !avoidTopics.includes(t));
  if (fresh.length >= 2) pool_ = fresh;

  const topicKey = pick(pool_);
  const generator = GENERATORS[topicKey] || ADVANCED_GENERATORS[topicKey];
  if (!generator) throw new Error(`no generator for topic "${topicKey}"`);
  const q = generator(tier);

  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    topicKey,
    topic: q.topic,
    tier,
    league: leagueKey,
    prompt: q.prompt,
    promptPlain: q.promptPlain || q.prompt,
    hint: q.hint || null,
    unit: q.unit || null,
    steps: normaliseSteps(q.steps),
    alternatives: q.alternatives || [],
  };

  // Multiple choice: the options ARE the question, so there is nothing to
  // parse and nothing to round. Marking is by which option was picked.
  if (q.kind === 'choice') {
    return {
      ...base,
      kind: 'choice',
      choices: q.choices,
      answerIndex: q.answerIndex,
      answer: q.answerText,
      options: q.choices,
    };
  }

  const answerValue = typeof q.answer === 'number'
    ? zeroSafe(round(q.answer, 4)) : q.answer;
  return {
    ...base,
    kind: 'numeric',
    answer: answerValue,
    acceptText: q.acceptText || null,
    options: makeOptions(answerValue),
    expression: q.expression || null,
  };
}

/**
 * Check a typed answer. Accepts decimals, fractions ("3/4"),
 * and tolerates tiny rounding differences.
 */
export function checkAnswer(question, raw) {
  // A multiple-choice answer arrives as the index of the chosen option, so
  // there is no text to interpret and no tolerance to apply.
  if (question.kind === 'choice') {
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0 || index >= question.choices.length) {
      return { correct: false, value: null };
    }
    return {
      correct: index === question.answerIndex,
      value: question.choices[index],
    };
  }

  const text = String(raw ?? '').trim().replace(/\s+/g, '').replace(/[,%]/g, '');
  if (!text) return { correct: false, value: null };

  // Exact textual matches (e.g. the reduced fraction form).
  if (question.acceptText) {
    for (const t of question.acceptText) {
      if (text === String(t).replace(/\s+/g, '')) return { correct: true, value: question.answer };
    }
  }

  let value = null;
  const frac = text.match(/^(-?\d+)\/(-?\d+)$/);
  if (frac) {
    const d = Number(frac[2]);
    if (d !== 0) value = Number(frac[1]) / d;
  } else if (/^-?\d*\.?\d+$/.test(text)) {
    value = Number(text);
  }
  if (value === null || !isFinite(value)) return { correct: false, value: null };

  const target = Number(question.answer);
  // A RELATIVE tolerance is wrong for whole-number answers: 6⁹ is 10,077,696,
  // and a millionth of that is ±10, so a student could be seven out and still
  // be marked right. Whole numbers must match exactly; only genuinely decimal
  // answers get slack, and then only enough to cover 4-decimal rounding.
  const tol = Number.isInteger(target) ? 1e-9 : 0.005;
  return { correct: Math.abs(value - target) <= tol, value };
}
