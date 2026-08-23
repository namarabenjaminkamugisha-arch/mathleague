import test from 'node:test';
import assert from 'node:assert/strict';

import {
  startSession, nextQuestion, submitAnswer, tick, timeOut, usePowerup,
  summarise, timeBonusFor, QUESTION_SECONDS, RUN_LENGTH,
} from '../src/js/session.js';
import { planFor } from '../src/js/curriculum.js';
import { POWERUPS } from '../src/js/scoring.js';
import { emptyProfile } from '../src/js/storage.js';

const profile = (over = {}) => ({ ...emptyProfile(), ...over });

test('a new session starts with a question and a full clock', () => {
  const s = startSession(profile());
  assert.ok(s.question, 'expected a question');
  assert.equal(s.secondsLeft, planFor(s.league).seconds);
  assert.equal(s.index, 0);
  assert.equal(s.finished, false);
  assert.equal(s.length, planFor(s.league).questions);
});

test('answering correctly raises the score and the streak', () => {
  const s = startSession(profile());
  const { state, outcome } = submitAnswer(s, String(s.question.answer));
  assert.equal(outcome.correct, true);
  assert.ok(outcome.delta > 0);
  assert.equal(state.streak, 1);
  assert.equal(state.correct, 1);
  assert.equal(state.score, s.score + outcome.delta);
});

test('answering wrongly costs points and resets the streak', () => {
  let s = startSession(profile({ score: 500 }));
  s = { ...s, streak: 4 };
  const wrong = Number(s.question.answer) + 1000;
  const { state, outcome } = submitAnswer(s, String(wrong));
  assert.equal(outcome.correct, false);
  assert.ok(outcome.delta < 0);
  assert.equal(state.streak, 0);
  assert.equal(state.wrong, 1);
});

test('the score can never go negative through a whole bad run', () => {
  let s = startSession(profile({ score: 3 }));
  for (let i = 0; i < s.length; i++) {
    if (!s.question) break;
    s = submitAnswer(s, '-99999').state;
    if (!s.finished) s = nextQuestion(s);
  }
  assert.ok(s.score >= 0, `score went negative: ${s.score}`);
});

test('a run finishes after exactly as many questions as its league plans', () => {
  let s = startSession(profile());
  const planned = s.length;
  let guard = 0;
  while (!s.finished && guard++ < 60) {
    s = submitAnswer(s, s.question.kind === 'choice'
        ? s.question.answerIndex : String(s.question.answer)).state;
    s = nextQuestion(s);
  }
  assert.equal(s.finished, true);
  assert.equal(s.index, planned);
  assert.equal(s.correct, planned);
});

test('the clock ticks down and expiry is reported once', () => {
  let s = startSession(profile());
  s = { ...s, secondsLeft: 2 };
  let r = tick(s);
  assert.equal(r.expired, false);
  assert.equal(r.state.secondsLeft, 1);
  r = tick(r.state);
  assert.equal(r.expired, true);
  assert.equal(r.state.secondsLeft, 0);
});

test('a frozen clock does not tick', () => {
  const s = { ...startSession(profile()), freeze: true, secondsLeft: 10 };
  const r = tick(s);
  assert.equal(r.state.secondsLeft, 10);
  assert.equal(r.expired, false);
});

test('running out of time counts as a wrong answer', () => {
  const s = startSession(profile({ score: 100 }));
  const { state, outcome } = timeOut(s);
  assert.equal(outcome.correct, false);
  assert.equal(state.wrong, 1);
  assert.ok(state.score < 100);
});

test('the time bonus rewards speed and never goes negative', () => {
  assert.equal(timeBonusFor(QUESTION_SECONDS), 5);
  assert.equal(timeBonusFor(0), 0);
  assert.equal(timeBonusFor(QUESTION_SECONDS / 2), 0);
  assert.ok(timeBonusFor(QUESTION_SECONDS * 0.75) > 0);
  assert.ok(timeBonusFor(-10) >= 0);
});

test('power-ups are refused when the player cannot afford them', () => {
  const s = startSession(profile({ score: 0 }));
  const r = usePowerup(s, 'shield');
  assert.equal(r.ok, false);
  assert.equal(r.state.score, 0);
  assert.match(r.message, /Need/);
});

test('skip moves on, costs its price and adds no wrong answer', () => {
  const s = startSession(profile({ score: 300 }));
  const r = usePowerup(s, 'skip');
  assert.equal(r.ok, true);
  assert.equal(r.state.score, 300 - POWERUPS.skip.cost);
  assert.equal(r.state.skipped, 1);
  assert.equal(r.state.wrong, 0);
  assert.equal(r.state.index, 1);
});

test('50/50 leaves two options, one of which is correct', () => {
  const s = startSession(profile({ score: 300 }));
  const r = usePowerup(s, 'fifty');
  assert.equal(r.ok, true);
  assert.equal(r.state.fiftyOptions.length, 2);
  assert.ok(r.state.fiftyOptions.includes(s.question.answer));
});

test('freeze stops the clock, shield survives one miss', () => {
  let s = startSession(profile({ score: 300 }));
  s = usePowerup(s, 'freeze').state;
  assert.equal(s.freeze, true);

  s = { ...s, streak: 6 };
  s = usePowerup(s, 'shield').state;
  assert.equal(s.shield, true);

  const { state, outcome } = submitAnswer(s, '-424242');
  assert.equal(outcome.correct, false);
  assert.equal(state.streak, 6, 'shield should preserve the streak');
  assert.equal(state.shield, false, 'shield is consumed');
});

test('a shield cannot be bought twice over', () => {
  let s = startSession(profile({ score: 300 }));
  s = usePowerup(s, 'shield').state;
  const again = usePowerup(s, 'shield');
  assert.equal(again.ok, false);
  assert.equal(again.state.score, s.score, 'no double charge');
});

test('reveal walks the steps and then stops', () => {
  let s = startSession(profile({ score: 5000 }));
  const total = s.question.steps.length;
  for (let i = 0; i < total; i++) {
    const r = usePowerup(s, 'reveal');
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(s.revealed, total);
  const over = usePowerup(s, 'reveal');
  assert.equal(over.ok, false);
});

test('the summary adds up and detects promotion', () => {
  let s = startSession(profile({ score: 240 }));   // just under Silver
  let guard = 0;
  while (!s.finished && guard++ < 50) {
    s = submitAnswer(s, s.question.kind === 'choice'
        ? s.question.answerIndex : String(s.question.answer)).state;
    s = nextQuestion(s);
  }
  const sum = summarise(s);
  assert.equal(sum.correct + sum.wrong, sum.answered);
  assert.equal(sum.accuracy, 100);
  assert.ok(sum.gained > 0);
  assert.equal(sum.promoted, true, 'should have climbed out of Bronze');
});

test('questions do not repeat the same topic three times running', () => {
  let s = startSession(profile());
  const topics = [];
  for (let i = 0; i < 8; i++) {
    topics.push(s.question.topicKey);
    s = submitAnswer(s, s.question.kind === 'choice'
        ? s.question.answerIndex : String(s.question.answer)).state;
    if (s.finished) break;
    s = nextQuestion(s);
  }
  for (let i = 2; i < topics.length; i++) {
    const three = topics.slice(i - 2, i + 1);
    assert.ok(new Set(three).size > 1, `topic repeated 3x: ${three.join(',')}`);
  }
});

test('a finished session ignores further answers', () => {
  const s = { ...startSession(profile()), finished: true };
  const r = submitAnswer(s, '1');
  assert.equal(r.outcome, null);
  assert.equal(r.state, s);
});
