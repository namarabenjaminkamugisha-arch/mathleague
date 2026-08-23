import test from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyProfile, today, daysBetween, registerPlay,
  checkAchievements, applyRun, ACHIEVEMENTS,
} from '../src/js/storage.js';
import { startSession, submitAnswer, nextQuestion, summarise } from '../src/js/session.js';

test('a fresh profile starts empty and safe', () => {
  const p = emptyProfile();
  assert.equal(p.score, 0);
  assert.equal(p.dailyStreak, 0);
  assert.equal(p.lastPlayed, null);
  assert.deepEqual(p.achievements, []);
});

test('today formats as YYYY-MM-DD in local time', () => {
  assert.equal(today(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(today(new Date(2026, 11, 31)), '2026-12-31');
});

test('daysBetween counts calendar days across month and year ends', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-02'), 1);
  assert.equal(daysBetween('2026-01-31', '2026-02-01'), 1);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(daysBetween('2026-03-01', '2026-03-01'), 0);
  assert.equal(daysBetween(null, '2026-03-01'), Infinity);
});

test('playing on consecutive days grows the daily streak', () => {
  let p = emptyProfile();
  p = registerPlay(p, '2026-01-01');
  assert.equal(p.dailyStreak, 1);
  p = registerPlay(p, '2026-01-02');
  assert.equal(p.dailyStreak, 2);
  p = registerPlay(p, '2026-01-03');
  assert.equal(p.dailyStreak, 3);
});

test('playing twice in one day does not double count', () => {
  let p = registerPlay(emptyProfile(), '2026-01-01');
  p = registerPlay(p, '2026-01-01');
  assert.equal(p.dailyStreak, 1);
});

test('missing a day resets the daily streak to 1', () => {
  let p = emptyProfile();
  p = registerPlay(p, '2026-01-01');
  p = registerPlay(p, '2026-01-02');
  p = registerPlay(p, '2026-01-05');
  assert.equal(p.dailyStreak, 1);
});

test('achievements unlock once and only once', () => {
  const p = { ...emptyProfile(), totalCorrect: 1 };
  const first = checkAchievements(p);
  assert.ok(first.unlocked.some(a => a.key === 'first-blood'));
  const second = checkAchievements(first.profile);
  assert.equal(second.unlocked.length, 0, 'should not re-unlock');
});

test('league achievements track the score thresholds', () => {
  const { profile } = checkAchievements({ ...emptyProfile(), score: 1500 });
  assert.ok(profile.achievements.includes('gold'));
  assert.ok(profile.achievements.includes('diamond'));
  assert.ok(!profile.achievements.includes('vibranium'));
});

test('every achievement has a key, name, blurb and a working test', () => {
  const keys = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.key && a.name && a.blurb, `incomplete achievement ${a.key}`);
    assert.equal(typeof a.test, 'function');
    assert.equal(keys.has(a.key), false, `duplicate key ${a.key}`);
    keys.add(a.key);
    assert.equal(typeof a.test(emptyProfile()), 'boolean');
  }
});

test('a finished run folds back into the profile', () => {
  let s = startSession(emptyProfile());
  let guard = 0;
  while (!s.finished && guard++ < 50) {
    s = submitAnswer(s, String(s.question.answer)).state;
    s = nextQuestion(s);
  }
  const sum = summarise(s);
  const { profile, unlocked } = applyRun(emptyProfile(), s, sum);

  assert.equal(profile.score, s.score);
  assert.equal(profile.totalCorrect, sum.correct);
  assert.equal(profile.totalRuns, 1);
  assert.ok(profile.bestRun > 0);
  assert.equal(profile.hadPerfectRun, true);
  assert.ok(unlocked.some(a => a.key === 'first-blood'));
  assert.ok(Object.keys(profile.topicStats).length > 0, 'topic stats recorded');
});

test('topic stats count correct and wrong per topic', () => {
  const session = {
    score: 50, streak: 0, bestStreak: 2,
    history: [
      { topic: 'Addition', correct: true },
      { topic: 'Addition', correct: false },
      { topic: 'Algebra', correct: true },
      { topic: 'Algebra', correct: null },   // a skip: ignored
    ],
  };
  const summary = { correct: 2, wrong: 1, skipped: 1, answered: 3, accuracy: 67, gained: 20 };
  const { profile } = applyRun(emptyProfile(), session, summary);
  assert.deepEqual(profile.topicStats.Addition, { correct: 1, wrong: 1 });
  assert.deepEqual(profile.topicStats.Algebra, { correct: 1, wrong: 0 });
});

test('a short perfect run does not count as flawless', () => {
  const session = { score: 20, streak: 2, bestStreak: 2, history: [{ topic: 'Addition', correct: true }] };
  const summary = { correct: 1, wrong: 0, skipped: 0, answered: 1, accuracy: 100, gained: 10 };
  const { profile } = applyRun(emptyProfile(), session, summary);
  assert.notEqual(profile.hadPerfectRun, true, 'needs at least 5 answers');
});
