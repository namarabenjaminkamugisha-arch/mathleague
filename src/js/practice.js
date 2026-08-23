// practice.js — the "More" section: pick a topic, pick a level, or take
// anything at random, at whatever difficulty you choose.
//
// Practice runs are deliberately **unranked**: they record how you are doing
// per topic, but they do not move your score, streak or league. If Easy-mode
// practice paid league points, the fastest route to Vibranium would be twenty
// easy additions, and the ladder would stop meaning anything. The UI says so
// plainly rather than hiding it.

import { ADVANCED_GENERATORS } from './curriculum.js';

export const PRACTICE_LENGTH = 20;      // questions per practice run

// ── difficulty ─────────────────────────────────────────────────────────────

// `tier` is the level handed to the generators that accept one — the
// arithmetic and early-algebra topics use it to widen their number ranges.
// Most advanced topics have a fixed shape, so for those difficulty shows up
// as the clock rather than as bigger numbers. That is an honest limit, not an
// oversight: "harder integration by parts" is a different question, not a
// bigger one.
export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    label: 'Easy',
    blurb: 'Small numbers, plenty of time',
    tier: 1,
    seconds: 90,
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    blurb: 'Bigger numbers, a steady clock',
    tier: 2,
    seconds: 70,
  },
  hard: {
    key: 'hard',
    label: 'Hard',
    blurb: 'Large numbers, less time',
    tier: 3,
    seconds: 50,
  },
  difficult: {
    key: 'difficult',
    label: 'Difficult',
    blurb: 'Full-size numbers, tight clock',
    tier: 4,
    seconds: 35,
  },
};

export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'difficult'];

export function difficultyFor(key) {
  return DIFFICULTIES[key] || DIFFICULTIES.medium;
}

// ── topics, grouped the way a student would look for them ──────────────────

export const TOPIC_GROUPS = [
  { key: 'arithmetic', name: 'Arithmetic', stage: 'Primary',
    topics: ['add', 'sub', 'mul', 'div'] },
  { key: 'fractions', name: 'Fractions', stage: 'O-level',
    topics: ['fraction'] },
  { key: 'percentages', name: 'Percentages', stage: 'O-level',
    topics: ['percent', 'percentChange'] },
  { key: 'ratio', name: 'Ratio', stage: 'O-level',
    topics: ['ratio'] },
  { key: 'indices', name: 'Indices & powers', stage: 'O-level',
    topics: ['indices', 'power'] },
  { key: 'roots', name: 'Roots & surds', stage: 'O-level',
    topics: ['root', 'surds', 'rationalise'] },
  { key: 'numbertheory', name: 'HCF & LCM', stage: 'O-level',
    topics: ['hcflcm'] },
  { key: 'algebra', name: 'Algebra', stage: 'O-level',
    topics: ['linear', 'simplify', 'factorise'] },
  { key: 'equations', name: 'Quadratics & simultaneous', stage: 'O-level',
    topics: ['quadratic', 'simultaneous'] },
  { key: 'logarithms', name: 'Logarithms', stage: 'O-level',
    topics: ['logarithm'] },
  { key: 'sequences', name: 'Sequences & series', stage: 'O-level',
    topics: ['sequence', 'series'] },
  { key: 'pythagoras', name: 'Pythagoras', stage: 'O-level',
    topics: ['pythagoras'] },
  { key: 'trigonometry', name: 'Trigonometry', stage: 'A-level',
    topics: ['trigEquation', 'trigIdentity'] },
  { key: 'coordinate', name: 'Coordinate geometry', stage: 'A-level',
    topics: ['coordGeometry', 'circle'] },
  { key: 'polynomials', name: 'Binomial & polynomials', stage: 'A-level',
    topics: ['binomial', 'remainder'] },
  { key: 'differentiation', name: 'Differentiation', stage: 'A-level',
    topics: ['differentiate', 'derivativeOf', 'stationary'] },
  { key: 'integration', name: 'Integration', stage: 'A-level',
    topics: ['integrate', 'integralOf', 'substitution', 'byParts'] },
  { key: 'vectors', name: 'Vectors', stage: 'A-level',
    topics: ['vectors'] },
  { key: 'complex', name: 'Complex numbers', stage: 'A-level',
    topics: ['complex'] },
  { key: 'matrices', name: 'Matrices', stage: 'University',
    topics: ['determinant'] },
  { key: 'differential', name: 'Differential equations', stage: 'University',
    topics: ['diffEquation'] },
  { key: 'partialfractions', name: 'Partial fractions', stage: 'University',
    topics: ['partialFractions'] },
  { key: 'limits', name: 'Limits', stage: 'University',
    topics: ['limit'] },
  { key: 'maclaurin', name: 'Maclaurin series', stage: 'University',
    topics: ['maclaurin'] },
];

export function topicGroupFor(key) {
  return TOPIC_GROUPS.find(g => g.key === key) || null;
}

// ── levels of education ────────────────────────────────────────────────────

const groupsAtStage = stage =>
  TOPIC_GROUPS.filter(g => g.stage === stage).flatMap(g => g.topics);

export const LEVELS = [
  {
    key: 'primary',
    name: 'Primary',
    blurb: 'Addition, subtraction, multiplication and division',
    topics: groupsAtStage('Primary'),
  },
  {
    key: 'olevel',
    name: 'O-level',
    blurb: 'S1–S4: fractions, percentages, algebra, surds, logs, sequences',
    topics: groupsAtStage('O-level'),
  },
  {
    key: 'alevel',
    name: 'A-level',
    blurb: 'S5–S6: trigonometry, coordinate geometry, calculus, vectors',
    topics: groupsAtStage('A-level'),
  },
  {
    key: 'university',
    name: 'University',
    blurb: 'Year 1: matrices, differential equations, limits, series',
    topics: groupsAtStage('University'),
  },
];

export function levelFor(key) {
  return LEVELS.find(l => l.key === key) || null;
}

/** Every topic the app can ask, for the Random button. */
export const ALL_TOPICS = TOPIC_GROUPS.flatMap(g => g.topics);

/**
 * Build the pool a practice run should draw from.
 *
 * @param {'topic'|'level'|'random'} kind
 * @param {string|null} key            topic-group key, or level key
 * @param {string} difficultyKey
 * @returns {{topics: string[], tier: number, seconds: number, label: string,
 *            practice: true}|null}    null when the key is unknown
 */
export function buildPool(kind, key, difficultyKey) {
  const d = difficultyFor(difficultyKey);
  let topics = null;
  let label = '';

  if (kind === 'random') {
    topics = ALL_TOPICS;
    label = 'Random practice';
  } else if (kind === 'topic') {
    const group = topicGroupFor(key);
    if (!group) return null;
    topics = group.topics;
    label = group.name;
  } else if (kind === 'level') {
    const level = levelFor(key);
    if (!level) return null;
    topics = level.topics;
    label = level.name;
  } else {
    return null;
  }

  if (!topics.length) return null;
  return {
    topics: [...topics],
    tier: d.tier,
    seconds: d.seconds,
    difficulty: d.key,
    label: `${label} · ${d.label}`,
    practice: true,
  };
}

/**
 * Guard against a group naming a topic that has no generator. Exported so the
 * tests can assert it rather than a player discovering it mid-run.
 */
export function unknownTopics(basicGeneratorKeys) {
  const known = new Set([...basicGeneratorKeys, ...Object.keys(ADVANCED_GENERATORS)]);
  const missing = [];
  for (const group of TOPIC_GROUPS) {
    for (const t of group.topics) if (!known.has(t)) missing.push(`${group.key}:${t}`);
  }
  return missing;
}
