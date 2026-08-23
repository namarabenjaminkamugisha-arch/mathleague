import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion, checkAnswer } from '../src/js/questions.js';
import {
  LEAGUE_PLAN, LEAGUE_ORDER, ADVANCED_GENERATORS, planFor,
} from '../src/js/curriculum.js';

const SAMPLES = 150;

// ── the plan itself ────────────────────────────────────────────────────────

test('every league names topics that actually have a generator', () => {
  // A typo in a topic name would only surface as a crash mid-run, for whoever
  // happened to reach that league.
  const known = new Set([
    ...Object.keys(ADVANCED_GENERATORS),
    'add', 'sub', 'mul', 'div', 'fraction', 'percent', 'percentChange',
    'power', 'root', 'linear', 'simplify',
  ]);
  for (const key of LEAGUE_ORDER) {
    for (const topic of planFor(key).topics) {
      assert.ok(known.has(topic), `${key} asks for unknown topic "${topic}"`);
    }
  }
});

test('the ladder gets longer to think about and shorter to answer', () => {
  const plans = LEAGUE_ORDER.map(planFor);
  for (let i = 1; i < plans.length; i += 1) {
    assert.ok(plans[i].questions <= plans[i - 1].questions,
      `${LEAGUE_ORDER[i]} should not ask more questions than the league below`);
    if (plans[i].seconds !== null && plans[i - 1].seconds !== null) {
      assert.ok(plans[i].seconds > plans[i - 1].seconds,
        `${LEAGUE_ORDER[i]} should allow more time than the league below`);
    }
  }
  assert.equal(LEAGUE_PLAN.bronze.questions, 20, 'Bronze is a 20-question run');
  assert.equal(LEAGUE_PLAN.vibranium.seconds, null, 'Vibranium is untimed');
});

test('Bronze stays plain arithmetic', () => {
  assert.deepEqual(LEAGUE_PLAN.bronze.topics.sort(),
    ['add', 'div', 'mul', 'sub']);
});

// ── every question, every league ───────────────────────────────────────────

for (const league of LEAGUE_ORDER) {
  test(`${league}: every generated question is well formed`, () => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const q = generateQuestion(league);
      const where = `${league}/${q.topicKey}: ${q.promptPlain}`;

      assert.ok(q.prompt && String(q.prompt).trim(), `empty prompt — ${where}`);
      assert.ok(q.topic && String(q.topic).trim(), `no topic — ${where}`);
      assert.ok(Array.isArray(q.steps) && q.steps.length >= 1,
        `no working shown — ${where}`);
      for (const step of q.steps) {
        // The UI renders step.text; a bare string would come out blank.
        assert.equal(typeof step.text, 'string', `step has no .text — ${where}`);
        assert.ok(step.text.trim(), `blank step — ${where}`);
        assert.ok(!/undefined|NaN|\[object/.test(step.text),
          `broken working "${step.text}" — ${where}`);
      }
      assert.ok(!/undefined|NaN|\[object/.test(q.prompt),
        `broken prompt — ${where}`);

      if (q.kind === 'choice') {
        assert.equal(q.choices.length, 4, `needs 4 options — ${where}`);
        assert.equal(new Set(q.choices).size, 4,
          `duplicate options — ${where}`);
        assert.ok(q.answerIndex >= 0 && q.answerIndex < 4,
          `answer index out of range — ${where}`);
        assert.equal(q.choices[q.answerIndex], q.answer,
          `answer index points at the wrong option — ${where}`);
      } else {
        assert.ok(Number.isFinite(q.answer), `answer is not a number — ${where}`);
        assert.ok(Math.abs(q.answer) < 1e12, `answer absurdly large — ${where}`);
      }
    }
  });

  test(`${league}: the stated answer is marked correct`, () => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const q = generateQuestion(league);
      const given = q.kind === 'choice' ? q.answerIndex : q.answer;
      assert.ok(checkAnswer(q, given).correct,
        `own answer rejected — ${q.topicKey}: ${q.promptPlain} → ${q.answer}`);
    }
  });

  test(`${league}: a wrong answer is marked wrong`, () => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const q = generateQuestion(league);
      if (q.kind === 'choice') {
        const wrong = (q.answerIndex + 1) % 4;
        assert.ok(!checkAnswer(q, wrong).correct,
          `wrong option accepted — ${q.promptPlain}`);
      } else {
        assert.ok(!checkAnswer(q, q.answer + 7.31).correct,
          `wrong number accepted — ${q.promptPlain}`);
      }
    }
  });
}

// ── the maths itself, checked independently of the generator ───────────────
//
// Expectations below are written `... + 0`. JavaScript produces -0 from things
// like (-1)*0, assert.equal compares with Object.is, and Object.is(-0, 0) is
// false. The app normalises -0 to 0 before storing an answer (a student should
// never be shown "-0"), so these checks must normalise the same way or they
// fail at random depending on the numbers drawn.

const sampleUntil = (league, topicKey, tries = 4000) => {
  for (let i = 0; i < tries; i += 1) {
    const q = generateQuestion(league);
    if (q.topicKey === topicKey) return q;
  }
  throw new Error(`never generated ${topicKey} in ${league}`);
};

test('quadratic: the given root really solves the equation', () => {
  for (let i = 0; i < 60; i += 1) {
    const q = sampleUntil('gold', 'quadratic');
    // prompt looks like "Solve x² + bx + c = 0. Give the larger root."
    const m = q.prompt.match(/x² ([+−]) (\d+)x ([+−]) (\d+) = 0/);
    assert.ok(m, `could not read the equation back: ${q.prompt}`);
    const b = (m[1] === '−' ? -1 : 1) * Number(m[2]);
    const c = (m[3] === '−' ? -1 : 1) * Number(m[4]);
    const x = q.answer;
    assert.equal(x * x + b * x + c + 0, 0,
      `${q.prompt} — root ${x} does not satisfy it`);
  }
});

test('determinant: recomputed from the rows in the prompt', () => {
  for (let i = 0; i < 60; i += 1) {
    const q = sampleUntil('vibranium', 'determinant');
    const m = q.prompt.match(/\(([-\d]+), ([-\d]+)\) and \(([-\d]+), ([-\d]+)\)/);
    assert.ok(m, `could not read the matrix back: ${q.prompt}`);
    const [a, b, c, d] = m.slice(1, 5).map(Number);
    // + 0 turns -0 into 0; the app normalises it, so the check must too.
    assert.equal(q.answer, (a * d - b * c) + 0, q.prompt);
  }
});

test('binomial: the coefficient matches n choose k', () => {
  const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
  for (let i = 0; i < 60; i += 1) {
    const q = sampleUntil('diamond', 'binomial');
    const m = q.promptPlain.match(/coefficient of x\^(\d+) in \(1\+x\)\^(\d+)/);
    assert.ok(m, `could not read it back: ${q.promptPlain}`);
    const k = Number(m[1]), n = Number(m[2]);
    assert.equal(q.answer, fact(n) / (fact(k) * fact(n - k)), q.prompt);
  }
});

test('limit: (x² − a²)/(x − a) tends to 2a', () => {
  for (let i = 0; i < 40; i += 1) {
    const q = sampleUntil('vibranium', 'limit');
    const m = q.promptPlain.match(/approaches (\d+) /);
    assert.ok(m, q.promptPlain);
    assert.equal(q.answer, 2 * Number(m[1]), q.prompt);
  }
});

test('pythagoras: the answer completes a right-angled triangle', () => {
  for (let i = 0; i < 60; i += 1) {
    const q = sampleUntil('gold', 'pythagoras');
    const nums = (q.prompt.match(/\d+/g) || []).map(Number);
    assert.equal(nums.length, 2, q.prompt);
    const sides = [...nums, q.answer].sort((x, y) => x - y);
    assert.equal(sides[0] ** 2 + sides[1] ** 2, sides[2] ** 2,
      `${q.prompt} → ${q.answer} is not a right triangle`);
  }
});

test('sequences: the arithmetic nth term is right', () => {
  for (let i = 0; i < 80; i += 1) {
    const q = sampleUntil('gold', 'sequence');
    const m = q.prompt.match(/starts at (-?\d+) with common difference (-?\d+)\. Find the (\d+)th/);
    if (!m) continue;                       // the GP variant, checked below
    const [a, d, n] = m.slice(1, 4).map(Number);
    assert.equal(q.answer, a + (n - 1) * d + 0, q.prompt);
  }
});

test('sequences: the geometric sum is right', () => {
  let checked = 0;
  for (let i = 0; i < 400 && checked < 20; i += 1) {
    const q = sampleUntil('gold', 'sequence');
    const m = q.prompt.match(/starts at (-?\d+) with common ratio (\d+)\. Find the sum of the first (\d+)/);
    if (!m) continue;
    const [a, r, n] = m.slice(1, 4).map(Number);
    assert.equal(q.answer, (a * (r ** n - 1)) / (r - 1), q.prompt);
    checked += 1;
  }
  assert.ok(checked > 0, 'never saw a GP question');
});

test('logarithms: base to the answer gives the number', () => {
  for (let i = 0; i < 60; i += 1) {
    const q = sampleUntil('gold', 'logarithm');
    const m = q.promptPlain.match(/log base (\d+) of (\d+)/);
    assert.ok(m, q.promptPlain);
    const [base, value] = m.slice(1, 3).map(Number);
    assert.equal(base ** q.answer, value, q.prompt);
  }
});

test('vectors: the scalar product is recomputed', () => {
  for (let i = 0; i < 60; i += 1) {
    const q = sampleUntil('platinum', 'vectors');
    const m = q.prompt.match(/a = \(([-\d, ]+)\) and b = \(([-\d, ]+)\)/);
    assert.ok(m, q.prompt);
    const a = m[1].split(',').map(Number);
    const b = m[2].split(',').map(Number);
    assert.equal(q.answer, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) + 0, q.prompt);
  }
});

test('HCF and LCM agree with the two numbers given', () => {
  const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
  for (let i = 0; i < 80; i += 1) {
    const q = sampleUntil('silver', 'hcflcm');
    const [a, b] = (q.prompt.match(/\d+/g) || []).map(Number);
    const expected = q.topic === 'HCF' ? g(a, b) : (a * b) / g(a, b);
    assert.equal(q.answer, expected + 0, q.prompt);
  }
});

test('multiple-choice distractors are never secretly correct', () => {
  // A duplicate of the right answer among the wrong options would make a
  // correct student wrong, depending on which one they tapped.
  for (const league of LEAGUE_ORDER) {
    for (let i = 0; i < 200; i += 1) {
      const q = generateQuestion(league);
      if (q.kind !== 'choice') continue;
      const matches = q.choices.filter(c => c === q.answer).length;
      assert.equal(matches, 1,
        `"${q.answer}" appears ${matches} times — ${q.prompt}`);
    }
  }
});
