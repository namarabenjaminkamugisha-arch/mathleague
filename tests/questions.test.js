import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion, checkAnswer, LEAGUE_TIER } from '../src/js/questions.js';
import { planFor } from '../src/js/curriculum.js';
import { LEAGUES } from '../src/js/scoring.js';
import { round } from '../src/js/util.js';

test('every league maps to a difficulty tier and a topic list', () => {
  for (const l of LEAGUES) {
    assert.ok(LEAGUE_TIER[l.key], `no tier for ${l.key}`);
    const plan = planFor(l.key);
    assert.ok(plan.topics && plan.topics.length, `no topics for ${l.key}`);
    assert.ok(plan.questions > 0, `no question count for ${l.key}`);
  }
});

test('difficulty rises: each league reaches beyond the one below it', () => {
  assert.ok(planFor('bronze').topics.every(t => ['add', 'sub', 'mul', 'div'].includes(t)),
    'bronze should be arithmetic only');
  assert.ok(planFor('silver').topics.includes('fraction'));
  assert.ok(planFor('gold').topics.includes('quadratic'));
  assert.ok(planFor('diamond').topics.includes('binomial'));
  assert.ok(planFor('platinum').topics.includes('differentiate'));
  assert.ok(planFor('vibranium').topics.includes('determinant'));
  assert.ok(!planFor('bronze').topics.includes('quadratic'), 'no algebra in bronze');
});

test('generated questions are complete and self-consistent, across every league', () => {
  for (const l of LEAGUES) {
    for (let i = 0; i < 250; i++) {
      const q = generateQuestion(l.key);
      assert.ok(q.prompt && q.prompt.length > 0, `${l.key}: empty prompt`);
      assert.ok(q.steps.length >= 1, `${l.key}: no working for "${q.prompt}"`);
      assert.ok(q.options.length === 4, `${l.key}: expected 4 options for "${q.prompt}"`);
      assert.equal(new Set(q.options).size, 4, `${l.key}: duplicate options for "${q.prompt}"`);
      assert.ok(q.tier >= 1 && q.tier <= 4);

      if (q.kind === 'choice') {
        // The answer is one of the options, not a number to parse.
        assert.equal(typeof q.answer, 'string', `${l.key}: "${q.prompt}"`);
        assert.equal(q.options[q.answerIndex], q.answer,
          `${l.key}: answer index disagrees with options for "${q.prompt}"`);
      } else {
        assert.equal(typeof q.answer, 'number', `${l.key}: non-numeric answer for "${q.prompt}"`);
        assert.ok(isFinite(q.answer), `${l.key}: non-finite answer for "${q.prompt}"`);
        assert.ok(
          q.options.some(o => Math.abs(o - round(q.answer, 4)) < 1e-9),
          `${l.key}: correct answer missing from options for "${q.prompt}"`
        );
      }
    }
  }
});

test('the correct answer always validates against its own question', () => {
  for (const l of LEAGUES) {
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion(l.key);
      const given = q.kind === 'choice' ? q.answerIndex : String(q.answer);
      const res = checkAnswer(q, given);
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

test('the top league asks university-level work, never arithmetic', () => {
  const topics = new Set();
  for (let i = 0; i < 600; i++) topics.add(generateQuestion('vibranium').topicKey);
  const advanced = ['substitution', 'byParts', 'determinant', 'diffEquation',
                    'partialFractions', 'limit', 'maclaurin'];
  assert.ok(advanced.some(t => topics.has(t)),
    'expected calculus or matrices at the top league');
  for (const basic of ['add', 'sub', 'mul', 'div']) {
    assert.ok(!topics.has(basic),
      `plain ${basic} should not appear at the top league`);
  }
});

test('every league eventually uses all of its topics', () => {
  // A topic listed but never drawn is a silent typo or an unreachable branch.
  for (const key of ['bronze', 'silver', 'gold', 'diamond', 'platinum', 'vibranium']) {
    const seen = new Set();
    for (let i = 0; i < 3000; i++) seen.add(generateQuestion(key).topicKey);
    for (const topic of planFor(key).topics) {
      assert.ok(seen.has(topic), `${key} never generated its "${topic}" topic`);
    }
  }
});

test('question ids are unique', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(generateQuestion('gold').id);
  assert.ok(ids.size > 490, 'ids should be effectively unique');
});
