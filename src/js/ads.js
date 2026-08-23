// ads.js — rewarded adverts, and the rules around them.
//
// The only advert MathLeague shows is one the player asked for: "watch a short
// advert to earn this power-up". Nothing is forced, nothing interrupts a run,
// and if the advert fails to load the player simply carries on.
//
// The logic here is deliberately free of any DOM or network work so it can be
// tested: `canWatch()` decides whether the offer may appear, and the provider
// is swapped out for a stub in tests.

import { ADS } from './ads-config.js';

const STATE_KEY = 'mathleague.ads.v1';

/** Reasons the offer is not available. Returned so the UI can explain itself. */
export const BLOCKED = {
  OFF: 'off',                 // adverts disabled in config
  DAILY_LIMIT: 'daily',       // watched the day's allowance
  COOLDOWN: 'cooldown',       // watched one very recently
};

// ── the small amount of state we keep ──────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function loadState(storage = safeStorage()) {
  const blank = { day: today(), watched: 0, lastAt: 0 };
  if (!storage) return blank;
  try {
    const raw = storage.getItem(STATE_KEY);
    if (!raw) return blank;
    const s = JSON.parse(raw);
    // A new day resets the allowance.
    if (s.day !== today()) return blank;
    return {
      day: s.day,
      watched: Number(s.watched) || 0,
      lastAt: Number(s.lastAt) || 0,
    };
  } catch {
    return blank;
  }
}

export function saveState(state, storage = safeStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* private mode; the cap simply will not persist, which is acceptable */
  }
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// ── the rules ──────────────────────────────────────────────────────────────

/**
 * May the "watch an advert" offer be shown right now?
 *
 * @param {object} [options]
 * @param {object} [options.config] defaults to the shipped config
 * @param {object} [options.state]  defaults to what is stored
 * @param {number} [options.now]    epoch ms, injectable for tests
 * @returns {{ok: boolean, reason?: string, waitSeconds?: number, left?: number}}
 */
export function canWatch({ config = ADS, state = null, now = Date.now() } = {}) {
  if (!config || config.provider === 'off') {
    return { ok: false, reason: BLOCKED.OFF };
  }
  const s = state || loadState();
  const limit = Number(config.dailyLimit) || 0;
  if (limit > 0 && s.watched >= limit) {
    return { ok: false, reason: BLOCKED.DAILY_LIMIT, left: 0 };
  }
  const cooldownMs = (Number(config.cooldownSeconds) || 0) * 1000;
  const since = now - (s.lastAt || 0);
  if (cooldownMs > 0 && s.lastAt && since < cooldownMs) {
    return {
      ok: false,
      reason: BLOCKED.COOLDOWN,
      waitSeconds: Math.ceil((cooldownMs - since) / 1000),
    };
  }
  return { ok: true, left: limit > 0 ? limit - s.watched : Infinity };
}

/** Record that one advert was watched all the way through. */
export function recordWatched({ state = null, now = Date.now(), storage } = {}) {
  const s = state || loadState(storage);
  const next = { day: today(), watched: s.watched + 1, lastAt: now };
  saveState(next, storage);
  return next;
}

// ── providers ──────────────────────────────────────────────────────────────

/**
 * A provider shows an advert and resolves { watched: boolean }.
 * It must never throw, and must never reject: a broken advert should be a
 * shrug, not an error in the middle of someone's maths practice.
 */

const providers = {
  off: {
    async show() { return { watched: false, reason: 'adverts are switched off' }; },
  },

  // A visible stand-in for development, so the whole flow can be seen and
  // tested with no ad account and no network.
  test: {
    async show({ onProgress } = {}) {
      const seconds = 3;
      for (let i = seconds; i > 0; i -= 1) {
        if (onProgress) onProgress(i);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 1000));
      }
      return { watched: true };
    },
  },

  // Google H5 Games Ads (AdSense). The page-level script is loaded lazily, so
  // a player who never asks for an advert never downloads any advert code —
  // which also keeps the app fast and keeps the offline build clean.
  h5games: {
    async show() {
      try {
        const ok = await ensureH5Loaded();
        if (!ok) return { watched: false, reason: 'advert could not load' };
        return await new Promise(resolve => {
          let settled = false;
          const done = result => {
            if (settled) return;
            settled = true;
            resolve(result);
          };
          // If the network stalls, do not leave the player waiting.
          const timer = setTimeout(
            () => done({ watched: false, reason: 'advert timed out' }), 30000);

          window.adBreak({
            type: 'reward',
            name: 'powerup',
            beforeReward: showAdFn => showAdFn(),
            adDismissed: () => { clearTimeout(timer); done({ watched: false, reason: 'advert closed early' }); },
            adViewed: () => { clearTimeout(timer); done({ watched: true }); },
            adBreakDone: placement => {
              clearTimeout(timer);
              done({ watched: placement && placement.breakStatus === 'viewed' });
            },
          });
        });
      } catch {
        return { watched: false, reason: 'advert could not load' };
      }
    },
  },
};

let h5Promise = null;

function ensureH5Loaded() {
  if (h5Promise) return h5Promise;
  h5Promise = new Promise(resolve => {
    if (typeof document === 'undefined') { resolve(false); return; }
    if (typeof window.adBreak === 'function') { resolve(true); return; }
    if (!ADS.publisherId) { resolve(false); return; }

    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
      + `?client=${encodeURIComponent(ADS.publisherId)}`;
    s.dataset.adbreakTest = 'off';
    s.onerror = () => resolve(false);
    s.onload = () => {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = function (...args) {
        window.adsbygoogle.push(...args);
      };
      window.adConfig({
        preloadAdBreaks: 'on',
        // Children use this app; ask for non-personalised adverts.
        npa: ADS.nonPersonalisedOnly ? '1' : '0',
      });
      resolve(true);
    };
    document.head.appendChild(s);
  });
  return h5Promise;
}

export function providerFor(name = ADS.provider) {
  return providers[name] || providers.off;
}

/**
 * Show a rewarded advert, if the rules allow one.
 *
 * Resolves { watched, reason? }. `watched: true` means the advert was seen to
 * the end and the reward is owed. Anything else means no reward, and the
 * caller should carry on quietly — never with an error.
 */
export async function watchRewarded({ config = ADS, onProgress, now = Date.now() } = {}) {
  const gate = canWatch({ config, now });
  if (!gate.ok) return { watched: false, reason: gate.reason };

  const provider = providerFor(config.provider);
  let result;
  try {
    result = await provider.show({ onProgress });
  } catch {
    result = { watched: false, reason: 'advert could not load' };
  }

  if (result && result.watched) recordWatched({ now });
  return result || { watched: false };
}
