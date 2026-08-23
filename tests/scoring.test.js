import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isClose, penaltyFor, resolveAnswer, leagueForScore, nextLeague, leagueProgress,
  streakMultiplier, dailyMultiplier, pointsForCorrect, LEAGUES,
  POWERUPS, canAfford, buyPowerup, PENALTY_CLOSE, PENALTY_FAR,
} from '../src/js/scoring.js';

// ── the closeness rule ──────────────────────────────────────
test('isClose: exactly 10% away counts as close', () => {
  assert.equal(isClose(110, 100), true);
  assert.equal(isClose(90, 100), true);
});

test('isClose: just beyond 10% is not close', () => {
  assert.equal(isClose(110.01, 100), false);
  assert.equal(isClose(89.99, 100), false);
});

test('isClose: works for negative correct values', () => {
  assert.equal(isClose(-105, -100), true);
  assert.equal(isClose(-80, -100), false);
});

test('isClose: zero target uses an absolute band', () => {
  assert.equal(isClose(0.05, 0), true);
  assert.equal(isClose(5, 0), false);
});

test('isClose: rejects non-numbers', () => {
  assert.equal(isClose(NaN, 100), false);
  assert.equal(isClose(10, Infinity), false);
});

test('penaltyFor: 2 when close, 5 when far', () => {
  assert.equal(penaltyFor(96, 100), PENALTY_CLOSE);
  assert.equal(penaltyFor(96, 100), 2);
  assert.equal(penaltyFor(40, 100), PENALTY_FAR);
  assert.equal(penaltyFor(40, 100), 5);
});

// ── score floor ─────────────────────────────────────────────
test('score never falls below zero on a far miss', () => {
  const r = resolveAnswer({ score: 3, correct: false, given: 1, answerValue: 100 });
  assert.equal(r.score, 0);
  assert.equal(r.delta, -3, 'delta is clamped to what was actually lost');
});

test('score never falls below zero on a close miss', () => {
  const r = resolveAnswer({ score: 1, correct: false, given: 99, answerValue: 100 });
  assert.equal(r.score, 0);
  assert.equal(r.delta, -1);
});

test('score at zero stays at zero', () => {
  const r = resolveAnswer({ score: 0, correct: false, given: 0, answerValue: 500 });
  assert.equal(r.score, 0);
  assert.equal(r.delta, 0);
});

test('close miss deducts 2, far miss deducts 5', () => {
  assert.equal(resolveAnswer({ score: 100, correct: false, given: 95, answerValue: 100 }).score, 98);
  assert.equal(resolveAnswer({ score: 100, correct: false, given: 20, answerValue: 100 }).score, 95);
});

test('a blank answer is treated as a far miss', () => {
  const r = resolveAnswer({ score: 50, correct: false, given: null, answerValue: 100 });
  assert.equal(r.score, 45);
  assert.equal(r.close, false);
});

// ── streaks ─────────────────────────────────────────────────
test('a wrong answer resets the streak', () => {
  const r = resolveAnswer({ score: 100, correct: false, given: 1, answerValue: 100, streak: 9 });
  assert.equal(r.streak, 0);
});

test('a streak shield preserves the streak but not the points', () => {
  const r = resolveAnswer({ score: 100, correct: false, given: 1, answerValue: 100, streak: 9, shield: true });
  assert.equal(r.streak, 9);
  assert.equal(r.score, 95);
  assert.equal(r.shieldUsed, true);
  assert.equal(r.shieldRemains, false, 'the shield is consumed');
});

test('a correct answer increments the streak', () => {
  const r = resolveAnswer({ score: 0, correct: true, tier: 1, streak: 4 });
  assert.equal(r.streak, 5);
  assert.ok(r.delta > 0);
});

test('streak multiplier steps up at the documented thresholds', () => {
  assert.equal(streakMultiplier(0), 1);
  assert.equal(streakMultiplier(2), 1);
  assert.equal(streakMultiplier(3), 1.25);
  assert.equal(streakMultiplier(5), 1.5);
  assert.equal(streakMultiplier(8), 1.75);
  assert.equal(streakMultiplier(12), 2);
  assert.equal(streakMultiplier(20), 2.5);
  assert.equal(streakMultiplier(999), 2.5, 'and it caps');
});

test('streak multiplier ignores rubbish input', () => {
  assert.equal(streakMultiplier(-5), 1);
  assert.equal(streakMultiplier(NaN), 1);
});

test('daily multiplier grows 2% a day and caps at +30%', () => {
  assert.equal(dailyMultiplier(1), 1);
  assert.equal(Math.round(dailyMultiplier(6) * 100) / 100, 1.1);
  assert.equal(dailyMultiplier(100), 1.3);
});

test('a longer streak earns strictly more points', () => {
  const low = pointsForCorrect({ tier: 1, streak: 0 });
  const high = pointsForCorrect({ tier: 1, streak: 12 });
  assert.ok(high > low, `${high} should beat ${low}`);
});

test('harder tiers pay more', () => {
  assert.ok(pointsForCorrect({ tier: 4 }) > pointsForCorrect({ tier: 1 }));
});

test('a correct answer always earns at least 1 point', () => {
  assert.ok(pointsForCorrect({ tier: 1, streak: 0, dailyStreak: 0 }) >= 1);
});

// ── leagues ─────────────────────────────────────────────────
test('league thresholds map exactly as specified', () => {
  assert.equal(leagueForScore(0).key, 'bronze');
  assert.equal(leagueForScore(249).key, 'bronze');
  assert.equal(leagueForScore(250).key, 'silver');
  assert.equal(leagueForScore(699).key, 'silver');
  assert.equal(leagueForScore(700).key, 'gold');
  assert.equal(leagueForScore(1499).key, 'gold');
  assert.equal(leagueForScore(1500).key, 'diamond');
  assert.equal(leagueForScore(2999).key, 'diamond');
  assert.equal(leagueForScore(3000).key, 'platinum');
  assert.equal(leagueForScore(5999).key, 'platinum');
  assert.equal(leagueForScore(6000).key, 'vibranium');
  assert.equal(leagueForScore(999999).key, 'vibranium');
});

test('there are exactly the six named leagues in ascending order', () => {
  assert.deepEqual(
    LEAGUES.map(l => l.name),
    ['Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Vibranium']
  );
  for (let i = 1; i < LEAGUES.length; i++) {
    assert.ok(LEAGUES[i].min > LEAGUES[i - 1].min, 'thresholds must ascend');
  }
});

test('negative scores are clamped into Bronze', () => {
  assert.equal(leagueForScore(-100).key, 'bronze');
});

test('nextLeague points one rung up, and is null at the top', () => {
  assert.equal(nextLeague(0).key, 'silver');
  assert.equal(nextLeague(2999).key, 'platinum');
  assert.equal(nextLeague(6000), null);
});

test('league progress runs 0..1 across the band', () => {
  assert.equal(leagueProgress(0), 0);
  assert.equal(leagueProgress(125), 0.5);
  assert.equal(leagueProgress(250), 0);
  assert.equal(leagueProgress(6000), 1, 'top league is always full');
});

// ── power-ups ───────────────────────────────────────────────
test('every power-up required by the brief exists and is priced', () => {
  for (const k of ['skip', 'fifty', 'freeze', 'shield', 'reveal']) {
    assert.ok(POWERUPS[k], `missing power-up: ${k}`);
    assert.ok(POWERUPS[k].cost > 0);
  }
});

test('power-up prices sit sensibly against a correct answer', () => {
  const base = pointsForCorrect({ tier: 1, streak: 0 }); // 10
  for (const p of Object.values(POWERUPS)) {
    assert.ok(p.cost >= base * 0.5, `${p.key} is too cheap`);
    assert.ok(p.cost <= base * 6, `${p.key} is too dear`);
  }
});

test('buying deducts the cost, and is refused when unaffordable', () => {
  assert.equal(buyPowerup(100, 'skip'), 100 - POWERUPS.skip.cost);
  assert.equal(canAfford(5, 'shield'), false);
  assert.equal(buyPowerup(5, 'shield'), null);
});

test('buying can never push the score negative', () => {
  const exact = POWERUPS.shield.cost;
  assert.equal(buyPowerup(exact, 'shield'), 0);
});
