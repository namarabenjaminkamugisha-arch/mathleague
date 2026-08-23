// session.js — the run/session state machine.
// Pure functions over a plain state object, so the whole game loop is testable
// without a DOM. The UI is a thin renderer on top of this.

import { generateQuestion, checkAnswer } from './questions.js';
import {
  resolveAnswer, leagueForScore, POWERUPS, buyPowerup, canAfford,
} from './scoring.js';

export const QUESTION_SECONDS = 45;
export const RUN_LENGTH = 10;          // questions per run
export const TIME_BONUS_MAX = 5;       // extra points for answering fast

/** Points for speed: full bonus instantly, nothing at half time. */
export function timeBonusFor(secondsLeft, total = QUESTION_SECONDS) {
  const frac = Math.max(0, Math.min(1, Number(secondsLeft) / total));
  const scaled = (frac - 0.5) / 0.5;          // 1 at full clock, 0 at half
  return Math.max(0, Math.round(scaled * TIME_BONUS_MAX));
}

/** A brand-new session for a player profile. */
export function startSession(profile, { length = RUN_LENGTH } = {}) {
  const league = leagueForScore(profile.score);
  const s = {
    score: profile.score,
    startScore: profile.score,
    streak: profile.streak || 0,
    bestStreak: profile.bestStreak || 0,
    dailyStreak: profile.dailyStreak || 1,
    league: league.key,
    index: 0,
    length,
    correct: 0,
    wrong: 0,
    skipped: 0,
    recentTopics: [],
    history: [],
    shield: false,
    freeze: false,
    fiftyOptions: null,
    revealed: 0,
    question: null,
    secondsLeft: QUESTION_SECONDS,
    finished: false,
  };
  return nextQuestion(s);
}

/** Advance to the next question (or finish the run). */
export function nextQuestion(s) {
  if (s.index >= s.length) return { ...s, finished: true, question: null };
  const league = leagueForScore(s.score).key;
  const q = generateQuestion(league, s.recentTopics.slice(-3));
  return {
    ...s,
    league,
    question: q,
    secondsLeft: QUESTION_SECONDS,
    freeze: false,
    fiftyOptions: null,
    revealed: 0,
    recentTopics: [...s.recentTopics, q.topicKey].slice(-6),
  };
}

/**
 * Submit a typed answer. Returns {state, outcome}.
 * outcome: {correct, close, delta, value, question, timeBonus}
 */
export function submitAnswer(s, raw) {
  if (!s.question || s.finished) return { state: s, outcome: null };
  const q = s.question;
  const { correct, value } = checkAnswer(q, raw);
  const timeBonus = correct ? timeBonusFor(s.secondsLeft) : 0;

  const r = resolveAnswer({
    score: s.score,
    correct,
    given: value,
    answerValue: q.answer,
    tier: q.tier,
    streak: s.streak,
    dailyStreak: s.dailyStreak,
    shield: s.shield,
    timeBonus,
  });

  const state = {
    ...s,
    score: r.score,
    streak: r.streak,
    bestStreak: Math.max(s.bestStreak, r.streak),
    shield: r.shieldRemains,
    correct: s.correct + (correct ? 1 : 0),
    wrong: s.wrong + (correct ? 0 : 1),
    index: s.index + 1,
    history: [...s.history, {
      prompt: q.promptPlain, topic: q.topic, correct,
      given: raw, answer: q.answer, delta: r.delta,
    }],
  };

  return {
    state,
    outcome: {
      correct, close: r.close, delta: r.delta, value,
      question: q, timeBonus, shieldUsed: r.shieldUsed,
      multiplier: r.multiplier,
    },
  };
}

/** Timer tick. Returns {state, expired}. */
export function tick(s) {
  if (s.finished || !s.question || s.freeze) return { state: s, expired: false };
  const secondsLeft = s.secondsLeft - 1;
  if (secondsLeft <= 0) return { state: { ...s, secondsLeft: 0 }, expired: true };
  return { state: { ...s, secondsLeft }, expired: false };
}

/** Time ran out: counts as a far miss, no shield mercy on points. */
export function timeOut(s) {
  return submitAnswer(s, '');
}

/**
 * Use a power-up. Returns {state, ok, message}.
 * Costs are deducted from the live score.
 */
export function usePowerup(s, key) {
  const p = POWERUPS[key];
  if (!p) return { state: s, ok: false, message: 'Unknown power-up.' };
  if (!canAfford(s.score, key)) {
    return { state: s, ok: false, message: `Need ${p.cost} points for ${p.name}.` };
  }
  const score = buyPowerup(s.score, key);

  switch (key) {
    case 'skip': {
      const spent = { ...s, score, skipped: s.skipped + 1, index: s.index + 1,
        history: [...s.history, { prompt: s.question.promptPlain, topic: s.question.topic,
          correct: null, given: null, answer: s.question.answer, delta: -p.cost }] };
      return { state: nextQuestion(spent), ok: true, message: 'Skipped.' };
    }
    case 'fifty': {
      const q = s.question;
      const wrong = q.options.filter(o => o !== q.answer);
      const keepWrong = wrong.slice(0, 1);
      const opts = [q.answer, ...keepWrong].sort(() => Math.random() - 0.5);
      return { state: { ...s, score, fiftyOptions: opts }, ok: true, message: 'Two options left.' };
    }
    case 'freeze':
      return { state: { ...s, score, freeze: true }, ok: true, message: 'Clock frozen.' };
    case 'shield':
      if (s.shield) return { state: s, ok: false, message: 'Shield already active.' };
      return { state: { ...s, score, shield: true }, ok: true, message: 'Streak shielded.' };
    case 'reveal': {
      const total = s.question.steps?.length || 0;
      if (s.revealed >= total) return { state: s, ok: false, message: 'No more steps.' };
      return { state: { ...s, score, revealed: s.revealed + 1 }, ok: true, message: 'Step revealed.' };
    }
    default:
      return { state: s, ok: false, message: 'Unknown power-up.' };
  }
}

/** End-of-run summary. */
export function summarise(s) {
  const answered = s.correct + s.wrong;
  return {
    correct: s.correct,
    wrong: s.wrong,
    skipped: s.skipped,
    answered,
    accuracy: answered ? Math.round((s.correct / answered) * 100) : 0,
    gained: s.score - s.startScore,
    score: s.score,
    bestStreak: s.bestStreak,
    league: leagueForScore(s.score),
    promoted: leagueForScore(s.score).min > leagueForScore(s.startScore).min,
  };
}
