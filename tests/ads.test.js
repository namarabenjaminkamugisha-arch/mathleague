import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canWatch, recordWatched, loadState, saveState, providerFor, watchRewarded,
  BLOCKED,
} from '../src/js/ads.js';
import { ADS } from '../src/js/ads-config.js';

// A stand-in for localStorage so the rules can be tested without a browser.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
  };
}

const cfg = (over = {}) => ({
  provider: 'test', publisherId: '', nonPersonalisedOnly: true,
  dailyLimit: 5, cooldownSeconds: 60, ...over,
});

const freshState = () => ({ day: new Date().toISOString().slice(0, 10), watched: 0, lastAt: 0 });

// ── the shipped configuration ──────────────────────────────────────────────

test('adverts ship switched OFF', () => {
  // A fresh install must show nothing to anybody until Benjamin turns it on.
  assert.equal(ADS.provider, 'off',
    'the shipped config must not have adverts enabled');
});

test('children are protected by default', () => {
  // Students use this app. Personalised adverts to under-13s breach COPPA and
  // Google Play's Families Policy.
  assert.equal(ADS.nonPersonalisedOnly, true,
    'non-personalised adverts must be the default');
});

test('there is a daily cap and a cooldown', () => {
  assert.ok(ADS.dailyLimit > 0, 'an uncapped app becomes an advert machine');
  assert.ok(ADS.cooldownSeconds > 0, 'without a cooldown the offer can be spammed');
});

test('only rewarded adverts exist — no banner or interstitial provider', () => {
  // Guards the decision recorded in the plan. Adding a forced format would
  // risk a Families Policy strike and close the school route.
  for (const name of ['banner', 'interstitial', 'popup', 'preroll']) {
    assert.equal(providerFor(name), providerFor('off'),
      `a "${name}" provider must not exist`);
  }
});

// ── the rules about when an advert may be offered ──────────────────────────

test('no offer at all when adverts are off', () => {
  const r = canWatch({ config: cfg({ provider: 'off' }), state: freshState() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, BLOCKED.OFF);
});

test('the offer appears when enabled and nothing has been watched', () => {
  const r = canWatch({ config: cfg(), state: freshState(), now: 1_000_000 });
  assert.equal(r.ok, true);
  assert.equal(r.left, 5);
});

test('the daily cap stops the offer', () => {
  const state = { ...freshState(), watched: 5 };
  const r = canWatch({ config: cfg(), state, now: 1_000_000 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, BLOCKED.DAILY_LIMIT);
});

test('the cooldown stops the offer, and says how long is left', () => {
  const now = 1_000_000;
  const state = { ...freshState(), watched: 1, lastAt: now - 20_000 };
  const r = canWatch({ config: cfg({ cooldownSeconds: 60 }), state, now });
  assert.equal(r.ok, false);
  assert.equal(r.reason, BLOCKED.COOLDOWN);
  assert.equal(r.waitSeconds, 40);
});

test('the offer returns once the cooldown has passed', () => {
  const now = 1_000_000;
  const state = { ...freshState(), watched: 1, lastAt: now - 61_000 };
  assert.equal(canWatch({ config: cfg(), state, now }).ok, true);
});

// ── the daily allowance resets ─────────────────────────────────────────────

test('yesterday\'s watches do not count against today', () => {
  const storage = fakeStorage();
  saveState({ day: '2020-01-01', watched: 99, lastAt: 1 }, storage);
  const s = loadState(storage);
  assert.equal(s.watched, 0, 'a new day starts with a full allowance');
  assert.equal(s.day, new Date().toISOString().slice(0, 10));
});

test('watching is counted', () => {
  const storage = fakeStorage();
  const first = recordWatched({ state: freshState(), now: 5000, storage });
  assert.equal(first.watched, 1);
  assert.equal(first.lastAt, 5000);
  const second = recordWatched({ state: first, now: 9000, storage });
  assert.equal(second.watched, 2);
});

test('a broken storage never breaks the app', () => {
  const hostile = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => loadState(hostile));
  assert.equal(loadState(hostile).watched, 0);
  assert.doesNotThrow(() => saveState({ day: 'x', watched: 1, lastAt: 0 }, hostile));
});

// ── showing one ────────────────────────────────────────────────────────────

test('a refused advert pays no reward', async () => {
  const r = await watchRewarded({ config: cfg({ provider: 'off' }) });
  assert.equal(r.watched, false);
  assert.equal(r.reason, BLOCKED.OFF);
});

test('a provider that throws is a shrug, not a crash', async () => {
  // A failed advert must never interrupt someone in the middle of maths.
  const broken = { async show() { throw new Error('network gone'); } };
  const original = providerFor('test').show;
  try {
    providerFor('test').show = broken.show;
    const r = await watchRewarded({ config: cfg({ provider: 'test' }) });
    assert.equal(r.watched, false);
    assert.ok(r.reason, 'a reason should be given');
  } finally {
    providerFor('test').show = original;
  }
});

test('a provider that reports "not watched" pays nothing', async () => {
  const original = providerFor('test').show;
  try {
    providerFor('test').show = async () => ({ watched: false, reason: 'closed early' });
    const r = await watchRewarded({ config: cfg({ provider: 'test' }) });
    assert.equal(r.watched, false);
  } finally {
    providerFor('test').show = original;
  }
});

test('a watched advert pays exactly one reward', async () => {
  const original = providerFor('test').show;
  try {
    providerFor('test').show = async () => ({ watched: true });
    const r = await watchRewarded({ config: cfg({ provider: 'test' }) });
    assert.equal(r.watched, true);
  } finally {
    providerFor('test').show = original;
  }
});
