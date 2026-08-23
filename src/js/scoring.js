// scoring.js — points, penalties, leagues, streak multipliers.
// Pure functions only, so they are trivially testable.

import { round } from './util.js';

/** Base points awarded for a correct answer, by topic difficulty tier. */
export const BASE_POINTS = {
  1: 10,  // arithmetic
  2: 14,  // fractions / percentages
  3: 18,  // powers & roots
  4: 24,  // algebra
};

export const PENALTY_CLOSE = 2;   // wrong, but within 10% of the true value
export const PENALTY_FAR = 5;     // wrong, and not close
export const CLOSE_FRACTION = 0.10;

export const LEAGUES = [
  { key: 'bronze',    name: 'Bronze',    min: 0,    tier: 1, colour: '#c98f5a' },
  { key: 'silver',    name: 'Silver',    min: 250,  tier: 1, colour: '#c7d2da' },
  { key: 'gold',      name: 'Gold',      min: 700,  tier: 2, colour: '#f2c14e' },
  { key: 'diamond',   name: 'Diamond',   min: 1500, tier: 3, colour: '#7ee0ff' },
  { key: 'platinum',  name: 'Platinum',  min: 3000, tier: 3, colour: '#dfe9f5' },
  { key: 'vibranium', name: 'Vibranium', min: 6000, tier: 4, colour: '#38bdf8' },
];

/** The league a given score sits in. Never returns null. */
export function leagueForScore(score) {
  const s = Math.max(0, Number(score) || 0);
  let current = LEAGUES[0];
  for (const l of LEAGUES) if (s >= l.min) current = l;
  return current;
}

/** The next league up, or null at the top. */
export function nextLeague(score) {
  const i = LEAGUES.indexOf(leagueForScore(score));
  return i >= 0 && i < LEAGUES.length - 1 ? LEAGUES[i + 1] : null;
}

/**
 * Progress toward the next league, 0..1.
 * At the top league this is always 1.
 */
export function leagueProgress(score) {
  const s = Math.max(0, Number(score) || 0);
  const cur = leagueForScore(s);
  const nxt = nextLeague(s);
  if (!nxt) return 1;
  const span = nxt.min - cur.min;
  return Math.min(1, Math.max(0, (s - cur.min) / span));
}

/**
 * Is `given` within CLOSE_FRACTION of `correct`?
 * Uses a relative band around the correct value. When the correct answer is 0
 * a relative band is meaningless, so we fall back to a small absolute band.
 */
export function isClose(given, correct) {
  const g = Number(given), c = Number(correct);
  if (!isFinite(g) || !isFinite(c)) return false;
  if (c === 0) return Math.abs(g) <= CLOSE_FRACTION;
  return Math.abs(g - c) <= Math.abs(c) * CLOSE_FRACTION;
}

/** Penalty for a wrong answer: 2 if close, else 5. */
export function penaltyFor(given, correct) {
  return isClose(given, correct) ? PENALTY_CLOSE : PENALTY_FAR;
}

/**
 * Streak multiplier. Grows in clear steps so the player can feel it,
 * and caps so the score cannot run away.
 *   0-2   -> 1.0
 *   3-4   -> 1.25
 *   5-7   -> 1.5
 *   8-11  -> 1.75
 *   12-19 -> 2.0
 *   20+   -> 2.5
 */
export function streakMultiplier(streak) {
  const s = Math.max(0, Math.floor(Number(streak) || 0));
  if (s >= 20) return 2.5;
  if (s >= 12) return 2;
  if (s >= 8) return 1.75;
  if (s >= 5) return 1.5;
  if (s >= 3) return 1.25;
  return 1;
}

/**
 * Daily-play-streak bonus multiplier, applied on top of the answer streak.
 * +2% per consecutive day, capped at +30%.
 */
export function dailyMultiplier(dailyStreak) {
  const d = Math.max(0, Math.floor(Number(dailyStreak) || 0));
  return 1 + Math.min(0.30, Math.max(0, d - 1) * 0.02);
}

/**
 * Points earned for a correct answer.
 * @returns {number} integer points, always >= 1.
 */
export function pointsForCorrect({ tier = 1, streak = 0, dailyStreak = 1, timeBonus = 0 } = {}) {
  const base = BASE_POINTS[tier] ?? BASE_POINTS[1];
  const raw = base * streakMultiplier(streak) * dailyMultiplier(dailyStreak) + timeBonus;
  return Math.max(1, Math.round(raw));
}

/**
 * Resolve one answer into a full score delta plus new streak state.
 * This is the single place the core loop's rules live.
 *
 * @param {object} o
 * @param {number} o.score        current score
 * @param {boolean} o.correct     was the answer right
 * @param {number|null} o.given   what the player typed (numeric), null if skipped/blank
 * @param {number} o.answerValue  the true numeric value
 * @param {number} o.tier         difficulty tier of the question
 * @param {number} o.streak       current answer streak
 * @param {number} o.dailyStreak  consecutive days played
 * @param {boolean} o.shield      streak shield active
 * @param {number} o.timeBonus    extra points for answering fast
 */
export function resolveAnswer({
  score = 0, correct, given, answerValue,
  tier = 1, streak = 0, dailyStreak = 1,
  shield = false, timeBonus = 0,
} = {}) {
  const before = Math.max(0, Math.round(Number(score) || 0));

  if (correct) {
    const delta = pointsForCorrect({ tier, streak, dailyStreak, timeBonus });
    return {
      delta,
      score: before + delta,
      streak: streak + 1,
      shieldUsed: false,
      shieldRemains: shield,
      close: false,
      multiplier: round(streakMultiplier(streak) * dailyMultiplier(dailyStreak), 4),
    };
  }

  const close = given === null || given === undefined || !isFinite(Number(given))
    ? false
    : isClose(Number(given), Number(answerValue));
  const penalty = close ? PENALTY_CLOSE : PENALTY_FAR;

  // A score must never fall below zero.
  const after = Math.max(0, before - penalty);
  const delta = after - before; // negative or 0

  // The shield eats the streak loss (but not the points penalty).
  const keptStreak = shield ? streak : 0;

  return {
    delta,
    score: after,
    streak: keptStreak,
    shieldUsed: !!shield,
    shieldRemains: false,
    close,
    multiplier: 1,
  };
}

/** Power-ups, priced against a ~10-24 point correct answer. */
export const POWERUPS = {
  skip:    { key: 'skip',    name: 'Skip',          cost: 15, icon: 'skip',   blurb: 'Move on with no penalty.' },
  fifty:   { key: 'fifty',   name: '50 / 50',       cost: 20, icon: 'fifty',  blurb: 'Removes two wrong options.' },
  freeze:  { key: 'freeze',  name: 'Freeze Timer',  cost: 25, icon: 'freeze', blurb: 'Stops the clock for this question.' },
  shield:  { key: 'shield',  name: 'Streak Shield', cost: 40, icon: 'shield', blurb: 'Protects your streak from one miss.' },
  reveal:  { key: 'reveal',  name: 'Reveal Step',   cost: 12, icon: 'reveal', blurb: 'Shows the next line of working.' },
};

/** Can the player afford it? */
export function canAfford(score, key) {
  const p = POWERUPS[key];
  return !!p && (Number(score) || 0) >= p.cost;
}

/** Spend points on a power-up. Returns new score, or null if unaffordable. */
export function buyPowerup(score, key) {
  if (!canAfford(score, key)) return null;
  return Math.max(0, (Number(score) || 0) - POWERUPS[key].cost);
}
