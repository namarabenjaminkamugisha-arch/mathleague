// storage.js — the player profile, daily streak and achievements.
// The pure logic takes a plain object; the browser wrapper persists to
// localStorage. Keeping them apart means the rules are testable in node.

export const STORAGE_KEY = 'mathleague.profile.v1';

export function emptyProfile() {
  return {
    version: 1,
    name: 'Player',
    score: 0,
    streak: 0,
    bestStreak: 0,
    dailyStreak: 0,
    lastPlayed: null,      // 'YYYY-MM-DD'
    totalCorrect: 0,
    totalWrong: 0,
    totalRuns: 0,
    bestRun: 0,
    achievements: [],
    topicStats: {},        // topicKey -> {correct, wrong}
  };
}

/** Local calendar date as YYYY-MM-DD (not UTC — streaks are a human thing). */
export function today(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days between two YYYY-MM-DD strings. */
export function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

/**
 * Register a day of play. Consecutive days extend the streak,
 * a gap resets it, and the same day twice changes nothing.
 */
export function registerPlay(profile, date = today()) {
  const gap = daysBetween(profile.lastPlayed, date);
  let dailyStreak;
  if (gap === 0) dailyStreak = Math.max(1, profile.dailyStreak);
  else if (gap === 1) dailyStreak = (profile.dailyStreak || 0) + 1;
  else dailyStreak = 1;
  return { ...profile, dailyStreak, lastPlayed: date };
}

export const ACHIEVEMENTS = [
  { key: 'first-blood',  name: 'First Blood',    blurb: 'Answer your first question correctly.',
    test: p => p.totalCorrect >= 1 },
  { key: 'streak-5',     name: 'On a Roll',      blurb: 'Reach a streak of 5.',
    test: p => p.bestStreak >= 5 },
  { key: 'streak-12',    name: 'Unstoppable',    blurb: 'Reach a streak of 12.',
    test: p => p.bestStreak >= 12 },
  { key: 'streak-20',    name: 'Machine',        blurb: 'Reach a streak of 20.',
    test: p => p.bestStreak >= 20 },
  { key: 'century',      name: 'Century',        blurb: 'Answer 100 questions correctly.',
    test: p => p.totalCorrect >= 100 },
  { key: 'gold',         name: 'Going for Gold', blurb: 'Reach the Gold league.',
    test: p => p.score >= 700 },
  { key: 'diamond',      name: 'Diamond Hands',  blurb: 'Reach the Diamond league.',
    test: p => p.score >= 1500 },
  { key: 'vibranium',    name: 'Vibranium',      blurb: 'Reach the Vibranium league.',
    test: p => p.score >= 6000 },
  { key: 'week',         name: 'Seven Days',     blurb: 'Play seven days in a row.',
    test: p => p.dailyStreak >= 7 },
  { key: 'perfect-run',  name: 'Flawless',       blurb: 'Finish a run with 100% accuracy.',
    test: p => p.hadPerfectRun === true },
];

/** Returns {profile, unlocked:[achievement]} */
export function checkAchievements(profile) {
  const have = new Set(profile.achievements || []);
  const unlocked = ACHIEVEMENTS.filter(a => !have.has(a.key) && a.test(profile));
  if (!unlocked.length) return { profile, unlocked: [] };
  return {
    profile: { ...profile, achievements: [...have, ...unlocked.map(a => a.key)] },
    unlocked,
  };
}

/** Fold a finished run back into the profile. Returns {profile, unlocked}. */
export function applyRun(profile, session, summary) {
  const topicStats = { ...(profile.topicStats || {}) };
  for (const h of session.history) {
    if (h.correct === null) continue;
    const key = h.topic || 'Other';
    const cur = topicStats[key] || { correct: 0, wrong: 0 };
    topicStats[key] = {
      correct: cur.correct + (h.correct ? 1 : 0),
      wrong: cur.wrong + (h.correct ? 0 : 1),
    };
  }

  // A PRACTICE run is unranked. It still records how you are doing per topic
  // and counts towards your totals, but it must not move the score, the streak
  // or the league — otherwise twenty Easy additions would be the quickest way
  // to reach Vibranium, and the ladder would stop meaning anything.
  const ranked = !session.practice;

  const next = {
    ...profile,
    score: ranked ? session.score : profile.score,
    streak: ranked ? session.streak : profile.streak,
    bestStreak: ranked
      ? Math.max(profile.bestStreak || 0, session.bestStreak || 0)
      : profile.bestStreak || 0,
    totalCorrect: (profile.totalCorrect || 0) + summary.correct,
    totalWrong: (profile.totalWrong || 0) + summary.wrong,
    totalRuns: (profile.totalRuns || 0) + 1,
    practiceRuns: (profile.practiceRuns || 0) + (ranked ? 0 : 1),
    bestRun: ranked
      ? Math.max(profile.bestRun || 0, summary.gained)
      : profile.bestRun || 0,
    hadPerfectRun: profile.hadPerfectRun
      || (ranked && summary.answered >= 5 && summary.accuracy === 100),
    topicStats,
  };
  return checkAchievements(next);
}

// ── browser persistence ─────────────────────────────────────

function hasLocalStorage() {
  try { return typeof localStorage !== 'undefined'; } catch { return false; }
}

export function loadProfile() {
  if (!hasLocalStorage()) return emptyProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    return { ...emptyProfile(), ...parsed };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function resetProfile() {
  if (hasLocalStorage()) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
  return emptyProfile();
}
