// app.js — the UI layer. All rules live in session.js / scoring.js / storage.js;
// this file only renders state and forwards intent.

import {
  startSession, nextQuestion, submitAnswer, tick, timeOut, usePowerup,
  summarise, QUESTION_SECONDS,
} from './session.js';
import {
  LEAGUES, POWERUPS, leagueForScore, nextLeague, leagueProgress, canAfford,
} from './scoring.js';
import {
  loadProfile, saveProfile, resetProfile, registerPlay, applyRun, ACHIEVEMENTS,
} from './storage.js';
import { fmt } from './util.js';
import { initCalculator, focusCalculator } from './calc-ui.js';
import { LEAGUE_ORDER, planFor } from './curriculum.js';
import { canWatch, watchRewarded } from './ads.js';
import {
  DIFFICULTIES, DIFFICULTY_ORDER, difficultyFor, TOPIC_GROUPS, LEVELS,
  buildPool, PRACTICE_LENGTH,
} from './practice.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const PU_ICON = { skip: '⏭', fifty: '½', freeze: '❄', shield: '🛡', reveal: '💡' };
const ACH_ICON = {
  'first-blood': '🎯', 'streak-5': '🔥', 'streak-12': '⚡', 'streak-20': '🚀',
  century: '💯', gold: '🥇', diamond: '💎', vibranium: '🛡', week: '📅', 'perfect-run': '✨',
};

let profile = loadProfile();

// The chosen practice difficulty, remembered between visits so a student who
// works at one level does not have to reset it every time.
const DIFFICULTY_KEY = 'mathleague.practice.difficulty';
let practiceDifficulty = (() => {
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY);
    return DIFFICULTIES[saved] ? saved : 'medium';
  } catch { return 'medium'; }
})();
let session = null;
let timerId = null;
let awaitingNext = false;   // showing feedback, waiting for the player to continue
let adPending = false;      // an advert is on screen; ignore taps until it ends

// ── screens ─────────────────────────────────────────────────
function show(name) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('is-active');
  $(`screen-${name}`).classList.add('is-active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(msg, kind = '') {
  const t = el('div', `toast ${kind}`, msg);
  $('toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, 2200);
}

function bump(node) {
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
}

// ── header ──────────────────────────────────────────────────
function renderHeader() {
  // A practice run keeps its own running score internally, but that score is
  // never banked. Showing it in the header made the display fall to 0 while
  // the results line correctly said the points were unchanged - the player
  // would reasonably think they had just lost everything. During practice the
  // header shows the real, untouched profile figures.
  const isPractice = !!(session && session.practice);
  const score = session && !isPractice ? session.score : profile.score;
  const streak = session && !isPractice ? session.streak : profile.streak;

  if ($('statScore').textContent !== String(score)) bump($('statScore'));
  $('statScore').textContent = score;
  $('statStreak').textContent = streak;
  $('statDaily').textContent = profile.dailyStreak || 0;

  const league = leagueForScore(score);
  $('leagueName').textContent = league.name;
  $('leagueDot').style.background = league.colour;
  $('leagueDot').style.color = league.colour;

  $('leagueFill').style.width = `${Math.round(leagueProgress(score) * 100)}%`;
  const nxt = nextLeague(score);
  $('leagueNext').textContent = nxt
    ? `${nxt.min - score} points to ${nxt.name}`
    : 'Top league reached';
}

function renderLadder() {
  const box = $('ladder');
  box.replaceChildren();
  const current = leagueForScore(profile.score);
  for (const l of LEAGUES) {
    const row = el('div', 'rung');
    if (l.key === current.key) row.classList.add('is-current');
    if (profile.score < l.min) row.classList.add('is-locked');
    const dot = el('span', 'rung-badge');
    dot.style.background = l.colour;
    row.append(dot, el('span', 'rung-name', l.name));
    row.append(el('span', 'rung-req',
      profile.score >= l.min ? 'unlocked' : `${l.min} pts`));
    box.appendChild(row);
  }
}

// ── quiz rendering ──────────────────────────────────────────
function renderDots() {
  const box = $('progressDots');
  box.replaceChildren();
  for (let i = 0; i < session.length; i++) {
    const d = el('span', 'pdot');
    const h = session.history[i];
    if (h) d.classList.add(h.correct === null ? 'is-skip' : h.correct ? 'is-correct' : 'is-wrong');
    else if (i === session.index) d.classList.add('is-current');
    box.appendChild(d);
  }
}

function renderTimer() {
  const total = session.questionSeconds;
  const left = session.secondsLeft;
  const CIRC = 2 * Math.PI * 17;
  $('timerArc').style.strokeDasharray = String(CIRC);

  // The top league is untimed: show a full, calm ring rather than a clock
  // counting down on a question that deserves a page of working.
  if (total === null || left === null) {
    $('timerArc').style.strokeDashoffset = '0';
    $('timerText').textContent = '∞';
    $('timer').classList.remove('is-low', 'is-frozen');
    $('timer').title = 'No time limit in this league — take as long as you need.';
    return;
  }

  $('timerArc').style.strokeDashoffset = String(CIRC * (1 - left / total));
  $('timerText').textContent = session.freeze ? '❄' : left;
  $('timer').classList.toggle('is-low', left <= 10 && !session.freeze);
  $('timer').classList.toggle('is-frozen', !!session.freeze);
  $('timer').title = `${left} seconds left`;
}

function renderPowerups() {
  const box = $('powerups');
  box.replaceChildren();
  // The advert offer only appears on power-ups the player cannot afford, and
  // only when the rules in ads.js allow one. It is never shown otherwise, so
  // a player with points never sees an advert at all.
  const offer = canWatch().ok;
  for (const key of ['reveal', 'skip', 'fifty', 'freeze', 'shield']) {
    const p = POWERUPS[key];
    const affordable = canAfford(session.score, key);
    const earnable = !affordable && offer;
    const b = el('button', 'pu');
    b.type = 'button';
    b.disabled = (!affordable && !earnable) || awaitingNext;
    if (earnable) b.classList.add('is-earnable');
    if ((key === 'freeze' && session.freeze) || (key === 'shield' && session.shield)) {
      b.classList.add('is-active');
      b.disabled = true;
    }
    b.title = earnable
      ? `${p.blurb} — watch a short advert to use it free`
      : p.blurb;
    b.append(
      el('span', 'pu-name', `${PU_ICON[key]} ${p.name}`),
      el('span', 'pu-cost', earnable ? '▶ free' : `${p.cost} pts`),
    );
    b.addEventListener('click', () => (earnable ? onEarnPowerup(key) : onPowerup(key)));
    box.appendChild(b);
  }
}

function renderSteps(container, steps, limit = Infinity) {
  const ol = el('ol');
  steps.slice(0, limit).forEach(s => {
    const li = el('li');
    li.appendChild(el('strong', null, s.text));
    if (s.detail) {
      for (const line of String(s.detail).split('\n')) {
        li.appendChild(document.createElement('br'));
        li.appendChild(el('span', 'step-math', line));
      }
    }
    ol.appendChild(li);
  });
  container.replaceChildren(ol);
}

/**
 * Multiple-choice questions replace the answer box with four buttons.
 * Tapping one submits it - there is no second "Submit" step, which would only
 * add a tap without adding a decision.
 */
function renderChoices(q) {
  const box = $('choices');
  box.replaceChildren();
  q.choices.forEach((text, i) => {
    const b = el('button', 'choice');
    b.type = 'button';
    b.dataset.index = String(i);
    b.append(el('span', 'choice-key', String.fromCharCode(65 + i)),
             el('span', 'choice-text', text));
    b.addEventListener('click', () => onChoice(i));
    box.appendChild(b);
  });
  box.hidden = false;
}

function renderQuestion() {
  const q = session.question;
  const isChoice = q.kind === 'choice';
  $('qTopic').textContent = q.topic;
  $('qPrompt').textContent = q.prompt;
  $('qHint').textContent = q.hint || '';
  $('feedback').hidden = true;
  $('reveal').hidden = true;
  $('options').hidden = true;
  $('answerInput').value = '';
  $('answerInput').disabled = false;
  $('btnSubmit').disabled = false;
  $('btnSubmit').textContent = 'Submit';

  // Hide the input, not the whole form: the form also carries the button that
  // becomes "Next question" after answering.
  $('answerInput').hidden = isChoice;
  $('btnSubmit').hidden = isChoice;
  $('choices').hidden = !isChoice;
  // Clear the old buttons when this question is not multiple choice. Leaving
  // the previous question's options in the DOM - hidden, and disabled from
  // their own feedback - is untidy and confusing to anything reading the page.
  if (isChoice) renderChoices(q); else $('choices').replaceChildren();

  renderDots();
  renderTimer();
  renderPowerups();
  renderHeader();
  if (!isChoice) $('answerInput').focus();
}

function onChoice(index) {
  if (awaitingNext || !session || !session.question) return;
  const { state, outcome } = submitAnswer(session, index);
  session = state;
  // Mark the picked option and the right one, so a miss is legible at a glance.
  for (const b of $('choices').querySelectorAll('.choice')) {
    const i = Number(b.dataset.index);
    b.disabled = true;
    if (i === session.question?.answerIndex) { /* already advanced */ }
    if (i === index) b.classList.add(outcome.correct ? 'is-right' : 'is-wrong');
    if (i === outcome.question.answerIndex) b.classList.add('is-right');
  }
  showFeedback(outcome, false);
}

// ── more: practice ──────────────────────────────────────────

function setDifficulty(key) {
  practiceDifficulty = DIFFICULTIES[key] ? key : 'medium';
  try { localStorage.setItem(DIFFICULTY_KEY, practiceDifficulty); } catch { /* private mode */ }
  renderMore();
}

function renderMore() {
  const row = $('modeRow');
  row.replaceChildren();
  for (const key of DIFFICULTY_ORDER) {
    const d = DIFFICULTIES[key];
    const b = el('button', 'mode-btn', d.label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(key === practiceDifficulty));
    if (key === practiceDifficulty) b.classList.add('is-on');
    b.addEventListener('click', () => setDifficulty(key));
    row.appendChild(b);
  }
  const d = difficultyFor(practiceDifficulty);
  $('modeBlurb').textContent = `${d.blurb} — ${d.seconds} seconds a question.`;
}

function renderTopicPicker() {
  const d = difficultyFor(practiceDifficulty);
  $('topicsNote').textContent =
    `${PRACTICE_LENGTH} questions from the topic you pick, at ${d.label}.`;
  const box = $('topicList2');
  box.replaceChildren();
  for (const g of TOPIC_GROUPS) {
    const b = el('button', 'pick');
    b.type = 'button';
    b.append(el('span', 'pick-name', g.name),
             el('span', 'pick-stage', g.stage));
    b.addEventListener('click', () => startPractice('topic', g.key));
    box.appendChild(b);
  }
}

function renderLevelPicker() {
  const d = difficultyFor(practiceDifficulty);
  $('levelsNote').textContent =
    `${PRACTICE_LENGTH} questions from across the level you pick, at ${d.label}.`;
  const box = $('levelList');
  box.replaceChildren();
  for (const l of LEVELS) {
    const b = el('button', 'pick pick-wide');
    b.type = 'button';
    b.append(el('span', 'pick-name', l.name),
             el('span', 'pick-blurb', l.blurb));
    b.addEventListener('click', () => startPractice('level', l.key));
    box.appendChild(b);
  }
}

function startPractice(kind, key) {
  const pool = buildPool(kind, key, practiceDifficulty);
  if (!pool) { toast('That set of questions is not available', 'is-bad'); return; }
  startRun({ pool });
}

// ── the loop ────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!session || awaitingNext) return;
    const r = tick(session);
    session = r.state;
    renderTimer();
    if (r.expired) handleTimeout();
  }, 1000);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

/** Start a run. Pass a practice pool to run one of the "More" quizzes. */
function startRun({ pool = null } = {}) {
  profile = registerPlay(profile);
  saveProfile(profile);
  session = startSession(profile, { pool });
  awaitingNext = false;
  renderPracticeBanner();
  show('quiz');
  renderQuestion();
  startTimer();
}

/** A league run: follows your league, and counts towards it. */
function beginRun() {
  startRun();
}

function renderPracticeBanner() {
  const banner = $('practiceBanner');
  if (!session || !session.practice) { banner.hidden = true; return; }
  banner.replaceChildren(
    el('span', 'practice-tag', 'Practice'),
    el('span', 'practice-label', session.pool.label),
    el('span', 'practice-note', 'Your league is unaffected'),
  );
  banner.hidden = false;
}

function handleTimeout() {
  const { state, outcome } = timeOut(session);
  session = state;
  showFeedback(outcome, true);
}

function onSubmit(e) {
  e.preventDefault();
  if (!session || session.finished) return;

  if (awaitingNext) { continueRun(); return; }

  const raw = $('answerInput').value.trim();
  if (!raw) { $('answerInput').focus(); return; }

  const { state, outcome } = submitAnswer(session, raw);
  session = state;
  showFeedback(outcome, false);
}

function showFeedback(outcome, timedOut) {
  awaitingNext = true;
  const q = outcome.question;
  const fb = $('feedback');
  fb.hidden = false;
  fb.className = `feedback ${outcome.correct ? 'is-good' : 'is-bad'}`;
  fb.replaceChildren();

  const head = el('div');
  if (outcome.correct) {
    let msg = `Correct  +${outcome.delta}`;
    if (outcome.timeBonus > 0) msg += `  (incl. +${outcome.timeBonus} speed)`;
    if (outcome.multiplier > 1) msg += `  ×${outcome.multiplier} streak`;
    head.textContent = msg;
  } else {
    const why = timedOut ? 'Time up' : outcome.close ? 'So close' : 'Not quite';
    const shown = q.kind === 'choice' ? q.answer : fmt(q.answer);
    head.textContent = `${why}  ${outcome.delta}  ·  answer: ${shown}`;
    $('questionCard').classList.remove('shake');
    void $('questionCard').offsetWidth;
    $('questionCard').classList.add('shake');
  }
  fb.appendChild(head);

  if (outcome.shieldUsed) toast('Streak shield absorbed that one', 'is-good');

  // Always show the working on a miss; it is the point of the app.
  if (!outcome.correct) {
    const working = el('div', 'working');
    working.appendChild(el('div', null, 'Here is the working:'));
    const holder = el('div');
    renderSteps(holder, q.steps);
    working.appendChild(holder);
    fb.appendChild(working);
  }

  $('answerInput').disabled = true;
  $('btnSubmit').hidden = false;           // becomes "Next question"
  $('btnSubmit').disabled = false;
  $('btnSubmit').textContent = session.index >= session.length ? 'See results' : 'Next question';
  $('btnSubmit').focus();
  $('options').hidden = true;
  renderDots();
  renderPowerups();
  renderHeader();
}

function continueRun() {
  awaitingNext = false;
  $('questionCard').classList.remove('shake');

  if (session.index >= session.length) { finishRun(); return; }
  session = nextQuestion(session);
  renderQuestion();
}

function finishRun() {
  stopTimer();
  const sum = summarise(session);
  const { profile: updated, unlocked } = applyRun(profile, session, sum);
  profile = updated;
  saveProfile(profile);

  const isPractice = !!session.practice;

  $('resultBadge').textContent = isPractice
    ? `${session.pool.label} complete`
    : sum.promoted ? `Promoted to ${sum.league.name}!` : 'Run complete';
  $('resultBadge').classList.toggle('is-promo', !isPractice && sum.promoted);

  $('resultScore').textContent = isPractice
    ? `${sum.accuracy}%`
    : `${sum.gained >= 0 ? '+' : ''}${sum.gained}`;
  $('resultScore').className = `result-score ${
    isPractice ? '' : sum.gained > 0 ? 'is-up' : sum.gained < 0 ? 'is-down' : ''}`;

  // A practice run shows accuracy rather than points, because points were
  // never applied - saying "+180" and then leaving the score untouched would
  // read as a bug.
  // For practice, quote the profile's REAL score, not the run's internal
  // tally. sum.score includes points the run notionally earned but never
  // applied, so quoting it would claim a total the player does not have.
  $('resultSub').textContent = isPractice
    ? `${sum.correct} of ${sum.answered} correct · your ${profile.score} points and your league are unchanged`
    : `${sum.correct} of ${sum.answered} correct · ${sum.accuracy}% accuracy · now ${sum.score} points`;

  const grid = $('resultGrid');
  grid.replaceChildren();
  const cells = [
    ['Correct', sum.correct], ['Missed', sum.wrong], ['Skipped', sum.skipped],
    ['Best streak', sum.bestStreak], ['League', sum.league.name],
  ];
  for (const [label, value] of cells) {
    const c = el('div', 'rstat');
    c.append(el('div', 'rstat-value', String(value)), el('div', 'rstat-label', label));
    grid.appendChild(c);
  }

  const rev = $('review');
  rev.replaceChildren();
  session.history.forEach(h => {
    const row = el('div', 'rev');
    const mark = h.correct === null ? 'sk' : h.correct ? 'ok' : 'no';
    row.append(
      el('span', `rev-mark ${mark}`, h.correct === null ? '–' : h.correct ? '✓' : '✕'),
      el('span', 'rev-prompt', h.prompt),
      el('span', 'rev-answer', `= ${fmt(h.answer)}`),
    );
    rev.appendChild(row);
  });

  renderHeader();
  renderLadder();
  show('result');

  unlocked.forEach((a, i) =>
    setTimeout(() => toast(`Achievement: ${a.name}`, 'is-ach'), 400 + i * 700));
}

/**
 * Earn a power-up by watching a rewarded advert.
 *
 * Nothing is forced: this only runs because the player tapped a power-up they
 * cannot afford and chose to watch. If the advert fails, is closed early, or
 * never loads, the run carries on untouched — a broken advert must never cost
 * anyone their place in a quiz.
 */
async function onEarnPowerup(key) {
  if (!session || awaitingNext || adPending) return;
  const p = POWERUPS[key];
  const ok = window.confirm(
    `Watch a short advert to use ${p.name} free?

`
    + 'Your points and your league are not affected either way.');
  if (!ok) return;

  adPending = true;
  const clock = $('timerText');
  const before = clock.textContent;
  // Freeze the visible clock while an advert plays, so nobody loses a question
  // to an advert they agreed to watch.
  const wasFrozen = session.freeze;
  session = { ...session, freeze: true };
  try {
    toast('Loading advert…');
    const result = await watchRewarded({
      onProgress: left => { clock.textContent = String(left); },
    });
    clock.textContent = before;
    session = { ...session, freeze: wasFrozen };
    if (!result.watched) {
      toast(result.reason ? `No advert: ${result.reason}` : 'No advert available', 'is-bad');
      renderPowerups();
      return;
    }
    onPowerup(key, { free: true });
  } catch {
    clock.textContent = before;
    session = { ...session, freeze: wasFrozen };
    toast('Advert could not load', 'is-bad');
  } finally {
    adPending = false;
    renderPowerups();
  }
}

function onPowerup(key, { free = false } = {}) {
  if (!session || awaitingNext) return;
  const r = usePowerup(session, key, { free });
  session = r.state;
  if (!r.ok) { toast(r.message, 'is-bad'); return; }
  toast(r.message, 'is-good');

  if (key === 'skip') { renderQuestion(); return; }

  if (key === 'fifty') {
    const box = $('options');
    box.replaceChildren();
    box.hidden = false;
    for (const opt of session.fiftyOptions) {
      const b = el('button', 'opt', fmt(opt));
      b.type = 'button';
      b.addEventListener('click', () => {
        $('answerInput').value = fmt(opt);
        onSubmit(new Event('submit'));
      });
      box.appendChild(b);
    }
  }

  if (key === 'reveal') {
    const box = $('reveal');
    box.hidden = false;
    renderSteps(box, session.question.steps, session.revealed);
  }

  renderTimer();
  renderPowerups();
  renderHeader();
}

function quitRun() {
  if (!session) { show('home'); return; }
  stopTimer();
  if (session.index > 0) { finishRun(); return; }
  session = null;
  renderHeader();
  renderLadder();
  show('home');
}

// ── other screens ───────────────────────────────────────────
function renderStats() {
  const grid = $('statsGrid');
  grid.replaceChildren();
  const answered = (profile.totalCorrect || 0) + (profile.totalWrong || 0);
  const acc = answered ? Math.round((profile.totalCorrect / answered) * 100) : 0;
  const cells = [
    ['Points', profile.score], ['Runs', profile.totalRuns || 0],
    ['Correct', profile.totalCorrect || 0], ['Accuracy', `${acc}%`],
    ['Best streak', profile.bestStreak || 0], ['Daily streak', profile.dailyStreak || 0],
    ['Best run', `+${profile.bestRun || 0}`], ['League', leagueForScore(profile.score).name],
  ];
  for (const [label, value] of cells) {
    const c = el('div', 'rstat');
    c.append(el('div', 'rstat-value', String(value)), el('div', 'rstat-label', label));
    grid.appendChild(c);
  }

  const list = $('topicList');
  list.replaceChildren();
  const entries = Object.entries(profile.topicStats || {});
  if (!entries.length) {
    list.appendChild(el('p', 'prose', 'Play a run and your per-topic accuracy shows up here.'));
    return;
  }
  entries.sort((a, b) => (b[1].correct + b[1].wrong) - (a[1].correct + a[1].wrong));
  for (const [topic, st] of entries) {
    const total = st.correct + st.wrong;
    const pct = total ? Math.round((st.correct / total) * 100) : 0;
    const row = el('div', 'topic-row');
    const bar = el('div', 'topic-bar');
    const fill = el('div', 'topic-fill');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    row.append(el('span', 'topic-name', topic), bar, el('span', 'topic-pct', `${pct}%`));
    row.title = `${st.correct} right, ${st.wrong} wrong`;
    list.appendChild(row);
  }
}

function renderAchievements() {
  const box = $('achList');
  box.replaceChildren();
  const have = new Set(profile.achievements || []);
  for (const a of ACHIEVEMENTS) {
    const unlocked = have.has(a.key);
    const row = el('div', `ach ${unlocked ? 'is-unlocked' : 'is-locked'}`);
    row.append(el('div', 'ach-icon', unlocked ? (ACH_ICON[a.key] || '★') : '🔒'));
    const txt = el('div');
    txt.append(el('div', 'ach-name', a.name), el('div', 'ach-blurb', a.blurb));
    row.appendChild(txt);
    box.appendChild(row);
  }
}

function renderHelp() {
  $('helpBody').innerHTML = `
    <p>Each league sets its own run: the harder the maths, the fewer questions
       and the more time you get. Answer fast for a speed bonus, except in
       Vibranium, which has no clock at all.</p>
    <h3>What each league asks</h3>
    <table class="help-table"><tbody>${LEAGUE_ORDER.map(k => {
      const p = planFor(k);
      return `<tr><td><strong>${p.label}</strong></td><td>${p.stage}</td>`
        + `<td>${p.questions} questions</td>`
        + `<td>${p.seconds === null ? 'no time limit' : p.seconds + 's each'}</td></tr>`;
    }).join('')}</tbody></table>
    <p class="help-note">Topics follow the Ugandan syllabus, from UNEB O-level
       through A-level Pure Maths to first-year university, in the order used by
       Backhouse's <em>Pure Mathematics</em> and <em>Understanding Pure
       Mathematics</em>.</p>
    <h3>Scoring</h3>
    <ul>
      <li>A correct answer pays <strong>10–24 points</strong>, depending on how hard the topic is.</li>
      <li>Streaks multiply your points: <code>3→×1.25</code>, <code>5→×1.5</code>,
          <code>8→×1.75</code>, <code>12→×2</code>, <code>20→×2.5</code>.</li>
      <li>Playing on consecutive days adds up to <strong>+30%</strong> on top.</li>
      <li>A wrong answer costs <strong>5</strong> points — or just <strong>2</strong>
          if you were within 10% of the right value.</li>
      <li>Your score never falls below zero.</li>
    </ul>
    <h3>Answers</h3>
    <ul>
      <li>Type decimals (<code>2.5</code>) or fractions (<code>3/4</code>).</li>
      <li>Percent signs and commas are ignored, so <code>25%</code> and <code>1,200</code> are fine.</li>
      <li>Some questions are multiple choice — tap an option and it is submitted.
          These are used where the answer is an expression rather than a number,
          such as a derivative or an integral.</li>
      <li>Get one wrong and the full working is shown, line by line.</li>
    </ul>
    <h3>More practice</h3>
    <p>The <strong>More</strong> button on the home screen opens practice runs:
       twenty questions on one topic, twenty from a whole level of education,
       or twenty at random from anything. Pick Easy, Medium, Hard or Difficult
       first — that sets how big the numbers get and how long you have.</p>
    <p>Practice records how you are doing on each topic, and you will see it in
       Progress. It does <strong>not</strong> change your score or your league:
       otherwise twenty easy sums would be the quickest way to the top, and the
       leagues would stop meaning anything.</p>
    <h3>Power-ups</h3>
    <ul>${Object.values(POWERUPS).map(p =>
      `<li><strong>${p.name}</strong> (${p.cost} pts) — ${p.blurb}</li>`).join('')}</ul>
    <h3>Leagues</h3>
    <ul>${LEAGUES.map(l => `<li><strong>${l.name}</strong> — ${l.min} points</li>`).join('')}</ul>
    <p>Higher leagues unlock harder topics: fractions and percentages, then powers
       and roots, then algebra.</p>`;
}

// ── wiring ──────────────────────────────────────────────────
function init() {
  $('btnPlay').addEventListener('click', beginRun);
  // Repeat whatever was just played: another practice run of the same kind,
  // or another league run. Dropping a practice player into a ranked run
  // without saying so would be a nasty surprise.
  $('btnAgain').addEventListener('click', () => {
    const pool = session && session.practice ? session.pool : null;
    startRun({ pool });
  });
  $('btnHome').addEventListener('click', () => { session = null; renderHeader(); renderLadder(); show('home'); });
  $('btnQuit').addEventListener('click', quitRun);
  $('answerForm').addEventListener('submit', onSubmit);

  $('btnStats').addEventListener('click', () => { renderStats(); show('stats'); });
  $('btnStatsBack').addEventListener('click', () => show('home'));
  $('btnAchievements').addEventListener('click', () => { renderAchievements(); show('achievements'); });
  $('btnAchBack').addEventListener('click', () => show('home'));
  $('btnHelp').addEventListener('click', () => { renderHelp(); show('help'); });

  $('btnMore').addEventListener('click', () => { renderMore(); show('more'); });
  $('btnMoreBack').addEventListener('click', () => show('home'));
  $('btnByTopic').addEventListener('click', () => { renderTopicPicker(); show('topics'); });
  $('btnTopicsBack').addEventListener('click', () => { renderMore(); show('more'); });
  $('btnByLevel').addEventListener('click', () => { renderLevelPicker(); show('levels'); });
  $('btnLevelsBack').addEventListener('click', () => { renderMore(); show('more'); });
  $('btnRandom').addEventListener('click', () => startPractice('random', null));
  $('btnCalculator').addEventListener('click', () => { show('calc'); focusCalculator(); });
  $('btnCalcBack').addEventListener('click', () => show('home'));
  initCalculator();
  $('btnHelpBack').addEventListener('click', () => show('home'));

  $('btnReset').addEventListener('click', () => {
    if (!confirm('Erase all progress, points and achievements?')) return;
    profile = resetProfile();
    session = null;
    renderHeader(); renderLadder(); renderStats();
    toast('Progress reset');
  });

  // Keyboard: number keys pick 50/50 options, Escape leaves a run.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('screen-quiz').classList.contains('is-active')) quitRun();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer();
    else if (session && !session.finished) startTimer();
  });

  renderHeader();
  renderLadder();
  show('home');
}

document.addEventListener('DOMContentLoaded', init);
