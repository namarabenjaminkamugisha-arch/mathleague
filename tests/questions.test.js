import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion, checkAnswer, LEAGUE_TIER, TIER_TOPICS } from '../src/js/questions.js';
import { LEAGUES } from '../src/js/scoring.js';
import { round } from '../src/js/util.js';

test('every league maps to a defined difficulty tier', () => {
  for (const l of LEAGUES) {
    const tier = LEAGUE_TIER[l.key];
    assert.ok(tier, `no tier for ${l.key}`);
    assert.ok(TIER_TOPICS[tier], `no topics for tier ${tier}`);
  }
});

test('difficulty rises: higher leagues unlock strictly harder topics', () => {
  assert.ok(TIER_TOPICS[1].every(t => ['add', 'sub', 'mul', 'div'].includes(t)),
    'bronze should be arithmetic only');
  assert.ok(TIER_TOPICS[2].includes('fraction') && TIER_TOPICS[2].includes('percent'));
  assert.ok(TIER_TOPICS[3].includes('power') && TIER_TOPICS[3].includes('root'));
  assert.ok(TIER_TOPICS[4].includes('linear') && TIER_TOPICS[4].includes('simplify'));
  assert.ok(!TIER_TOPICS[1].includes('linear'), 'no algebra in bronze');
});

test('generated questions are complete and self-consistent, across every league', () => {
  for (const l of LEAGUES) {
    for (let i = 0; i < 250; i++) {
      const q = generateQuestion(l.key);
      assert.ok(q.prompt && q.prompt.length > 0, `${l.key}: empty prompt`);
      assert.equal(typeof q.answer, 'number', `${l.key}: non-numeric answer for "${q.prompt}"`);
      assert.ok(isFinite(q.answer), `${l.key}: non-finite answer for "${q.prompt}"`);
      assert.ok(q.steps.length >= 2, `${l.key}: too few steps for "${q.prompt}"`);
      assert.ok(q.options.length === 4, `${l.key}: expected 4 options for "${q.prompt}"`);
      assert.ok(
        q.options.some(o => Math.abs(o - round(q.answer, 4)) < 1e-9),
        `${l.key}: correct answer missing from options for "${q.prompt}"`
      );
      assert.equal(new Set(q.options).size, 4, `${l.key}: duplicate options for "${q.prompt}"`);
      assert.ok(q.tier >= 1 && q.tier <= 4);
    }
  }
});

test('the correct answer always validates against its own question', () => {
  for (const l of LEAGUES) {
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion(l.key);
      const res = checkAnswer(q, String(q.answer));
      assert.equal(res.correct, true,
        `"${q.prompt}" (${q.topic}) rejected its own answer ${q.answer}`);
    }
  }
});

test('checkAnswer accepts fraction notation', () => {
  const q = { answer: 0.75, acceptText: ['3/4'] };
  assert.equal(checkAnswer(q, '3/4').correct, true);
  assert.equal(checkAnswer(q, '0.75').correct, true);
  assert.equal(checkAnswer(q, ' 6/8 ').correct, true, 'unreduced fractions still evaluate');
});

test('checkAnswer rejects blanks and nonsense', () => {
  const q = { answer: 42 };
  assert.equal(checkAnswer(q, '').correct, false);
  assert.equal(checkAnswer(q, '   ').correct, false);
  assert.equal(checkAnswer(q, 'banana').correct, false);
  assert.equal(checkAnswer(q, '4 2 x').correct, false);
});

test('checkAnswer returns the parsed value so the penalty rule can use it', () => {
  const q = { answer: 100 };
  const r = checkAnswer(q, '95');
  assert.equal(r.correct, false);
  assert.equal(r.value, 95);
});

test('checkAnswer tolerates trailing percent signs and commas', () => {
  assert.equal(checkAnswer({ answer: 25 }, '25%').correct, true);
  assert.equal(checkAnswer({ answer: 1200 }, '1,200').correct, true);
});

test('checkAnswer handles negative answers', () => {
  assert.equal(checkAnswer({ answer: -25 }, '-25').correct, true);
  assert.equal(checkAnswer({ answer: -25 }, '25').correct, false);
});

test('division by zero in typed fractions does not crash', () => {
  assert.equal(checkAnswer({ answer: 5 }, '5/0').correct, false);
});

test('bronze questions stay in comfortable arithmetic range', () => {
  for (let i = 0; i < 300; i++) {
    const q = generateQuestion('bronze');
    assert.ok(['Addition', 'Subtraction', 'Multiplication', 'Division'].includes(q.topic));
  }
});

test('vibranium questions include algebra over a large sample', () => {
  const topics = new Set();
  for (let i = 0; i < 400; i++) topics.add(generateQuestion('vibranium').topicKey);
  assert.ok(topics.has('linear') || topics.has('simplify'), 'expected algebra at the top league');
});

test('question ids are unique', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(generateQuestion('gold').id);
  assert.ok(ids.size > 490, 'ids should be effectively unique');
});
