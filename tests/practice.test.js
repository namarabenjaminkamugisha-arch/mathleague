import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIFFICULTIES, DIFFICULTY_ORDER, difficultyFor, TOPIC_GROUPS, LEVELS,
  ALL_TOPICS, buildPool, unknownTopics, PRACTICE_LENGTH, topicGroupFor, levelFor,
} from '../src/js/practice.js';
import { generateQuestion, checkAnswer } from '../src/js/questions.js';
import { startSession, nextQuestion, submitAnswer, summarise, tick } from '../src/js/session.js';
import { applyRun } from '../src/js/storage.js';

const BASIC = ['add', 'sub', 'mul', 'div', 'fraction', 'percent',
               'percentChange', 'power', 'root', 'linear', 'simplify'];

const profile = (over = {}) => ({
  score: 0, streak: 0, bestStreak: 0, dailyStreak: 1, plays: 1,
  topicStats: {}, achievements: [], ...over,
});

const playOut = (s) => {
  let guard = 0;
  while (!s.finished && guard++ < 200) {
    const given = s.question.kind === 'choice'
      ? s.question.answerIndex : String(s.question.answer);
    s = submitAnswer(s, given).state;
    s = nextQuestion(s);
  }
  return s;
};

// ── configuration is sound ─────────────────────────────────────────────────

test('every topic named by a group has a generator behind it', () => {
  // Otherwise a student picks a subject and the run crashes on question one.
  assert.deepEqual(unknownTopics(BASIC), []);
});

test('every level names topics that exist', () => {
  const known = new Set(ALL_TOPICS);
  for (const level of LEVELS) {
    assert.ok(level.topics.length, `${level.key} has no topics`);
    for (const t of level.topics) {
      assert.ok(known.has(t), `${level.key} names unknown topic "${t}"`);
    }
  }
});

test('the levels between them cover every topic the app can ask', () => {
  const covered = new Set(LEVELS.flatMap(l => l.topics));
  for (const t of ALL_TOPICS) {
    assert.ok(covered.has(t), `"${t}" is in no level, so it is unreachable by level`);
  }
});

test('topic groups do not overlap', () => {
  const seen = new Map();
  for (const g of TOPIC_GROUPS) {
    for (const t of g.topics) {
      assert.ok(!seen.has(t),
        `"${t}" is in both ${seen.get(t)} and ${g.key}`);
      seen.set(t, g.key);
    }
  }
});

test('difficulty rises consistently: more time when easier', () => {
  const list = DIFFICULTY_ORDER.map(difficultyFor);
  assert.equal(list.length, 4);
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(list[i].seconds < list[i - 1].seconds,
      `${list[i].key} should allow less time than ${list[i - 1].key}`);
    assert.ok(list[i].tier >= list[i - 1].tier,
      `${list[i].key} should not be an easier tier than ${list[i - 1].key}`);
  }
});

test('an unknown difficulty falls back rather than breaking', () => {
  assert.equal(difficultyFor('nonsense').key, 'medium');
  assert.equal(difficultyFor(undefined).key, 'medium');
});

// ── pools ──────────────────────────────────────────────────────────────────

test('a topic pool draws only from that topic', () => {
  for (const g of TOPIC_GROUPS) {
    const pool = buildPool('topic', g.key, 'medium');
    assert.ok(pool, `no pool for ${g.key}`);
    const allowed = new Set(g.topics);
    for (let i = 0; i < 120; i += 1) {
      // Deliberately ask from bronze: the pool must override the league.
      const q = generateQuestion('bronze', [], pool);
      assert.ok(allowed.has(q.topicKey),
        `${g.key} produced an out-of-topic question: ${q.topicKey}`);
    }
  }
});

test('a level pool draws only from that level', () => {
  for (const level of LEVELS) {
    const pool = buildPool('level', level.key, 'hard');
    const allowed = new Set(level.topics);
    for (let i = 0; i < 200; i += 1) {
      const q = generateQuestion('vibranium', [], pool);
      assert.ok(allowed.has(q.topicKey),
        `${level.key} produced ${q.topicKey}, which is not in that level`);
    }
  }
});

test('random reaches every topic given enough draws', () => {
  const pool = buildPool('random', null, 'medium');
  const seen = new Set();
  for (let i = 0; i < 30000; i += 1) seen.add(generateQuestion('bronze', [], pool).topicKey);
  for (const t of ALL_TOPICS) {
    assert.ok(seen.has(t), `random never produced "${t}"`);
  }
});

test('an unknown key yields no pool rather than a broken run', () => {
  assert.equal(buildPool('topic', 'no-such-topic', 'easy'), null);
  assert.equal(buildPool('level', 'no-such-level', 'easy'), null);
  assert.equal(buildPool('nonsense', null, 'easy'), null);
  assert.equal(topicGroupFor('nope'), null);
  assert.equal(levelFor('nope'), null);
});

test('difficulty changes the clock a pool carries', () => {
  const easy = buildPool('random', null, 'easy');
  const hard = buildPool('random', null, 'difficult');
  assert.ok(easy.seconds > hard.seconds);
  assert.equal(easy.difficulty, 'easy');
  assert.equal(hard.difficulty, 'difficult');
});

// ── practice runs ──────────────────────────────────────────────────────────

test('a practice run is 20 questions, whatever the league', () => {
  for (const score of [0, 900, 7000]) {
    const s = startSession(profile({ score }), { pool: buildPool('random', null, 'medium') });
    assert.equal(s.length, PRACTICE_LENGTH, `wrong length at score ${score}`);
    assert.equal(s.practice, true);
  }
});

test('a practice run uses the difficulty clock, not the league clock', () => {
  // A Vibranium player is untimed in a league run; practice must still be timed.
  const s = startSession(profile({ score: 7000 }),
    { pool: buildPool('topic', 'arithmetic', 'easy') });
  assert.equal(s.secondsLeft, DIFFICULTIES.easy.seconds);
  assert.equal(s.questionSeconds, DIFFICULTIES.easy.seconds);
  const r = tick(s);
  assert.equal(r.state.secondsLeft, DIFFICULTIES.easy.seconds - 1,
    'a practice clock must actually run down');
});

test('a practice run stays on topic for its whole length', () => {
  const pool = buildPool('topic', 'trigonometry', 'medium');
  let s = startSession(profile({ score: 5000 }), { pool });
  const allowed = new Set(pool.topics);
  let guard = 0;
  while (!s.finished && guard++ < 60) {
    assert.ok(allowed.has(s.question.topicKey),
      `strayed to ${s.question.topicKey} mid-run`);
    const given = s.question.kind === 'choice'
      ? s.question.answerIndex : String(s.question.answer);
    s = submitAnswer(s, given).state;
    s = nextQuestion(s);
  }
  assert.equal(s.finished, true);
});

test('a perfect practice run does NOT move the score, streak or league', () => {
  // The whole point: if it did, twenty Easy additions would be the fastest
  // route to the top league.
  const before = profile({ score: 240, streak: 3, bestStreak: 5 });
  const pool = buildPool('topic', 'arithmetic', 'easy');
  const s = playOut(startSession(before, { pool }));
  const sum = summarise(s);
  assert.equal(sum.correct, PRACTICE_LENGTH, 'expected a clean sweep');

  const { profile: after } = applyRun(before, s, sum);
  assert.equal(after.score, before.score, 'practice moved the score');
  assert.equal(after.streak, before.streak, 'practice moved the streak');
  assert.equal(after.bestStreak, before.bestStreak, 'practice moved the best streak');
  assert.equal(after.bestRun, before.bestRun || 0, 'practice moved the best run');
});

test('a practice run still records accuracy by topic', () => {
  const before = profile({ score: 100 });
  const pool = buildPool('topic', 'arithmetic', 'easy');
  const s = playOut(startSession(before, { pool }));
  const { profile: after } = applyRun(before, s, summarise(s));
  const topics = Object.keys(after.topicStats);
  assert.ok(topics.length > 0, 'practice recorded nothing about the topics');
  assert.equal(after.practiceRuns, 1);
  assert.ok(after.totalCorrect > 0, 'practice should still count towards totals');
});

test('a league run still moves the score, so ranking is not broken', () => {
  const before = profile({ score: 100 });
  const s = playOut(startSession(before));
  const { profile: after } = applyRun(before, s, summarise(s));
  assert.ok(after.score > before.score, 'a ranked run must still pay points');
  assert.equal(after.practiceRuns || 0, 0);
});

test('every practice question can be answered and marked', () => {
  for (const g of TOPIC_GROUPS) {
    const pool = buildPool('topic', g.key, 'difficult');
    for (let i = 0; i < 40; i += 1) {
      const q = generateQuestion('bronze', [], pool);
      const given = q.kind === 'choice' ? q.answerIndex : q.answer;
      assert.ok(checkAnswer(q, given).correct,
        `${g.key}: "${q.promptPlain}" rejected its own answer`);
    }
  }
});

test("the header must never show a practice run's internal score", () => {
  // The session keeps its own score during practice, but it is never banked.
  // Rendering it made the header fall to 0 after a bad practice run while the
  // results line said the points were unchanged - the player would think they
  // had lost everything. app.js must read profile.score during practice.
  const src = readFileSync(new URL('../src/js/app.js', import.meta.url), 'utf8');
  const fn = src.split('function renderHeader()')[1].split('\n}')[0];
  assert.ok(/session[.]practice/.test(fn),
    'renderHeader must check whether this is a practice run');
  assert.ok(/profile[.]score/.test(fn),
    'renderHeader must fall back to the real profile score');
});
