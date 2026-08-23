# MathLeague

A fast, offline-first maths practice game. Ten questions a run, a clock that
rewards speed, and a league you climb from Bronze to Vibranium.

**▶ [Play it now](https://namarabenjaminkamugisha-arch.github.io/mathleague/)** —
nothing to install, and it keeps working with no internet once you have opened it.

---

## What it does

- **Six leagues, six syllabuses.** Bronze is 20 questions of mental arithmetic;
  by Vibranium you are doing integration by substitution, matrices and limits.
  Topics follow the Ugandan syllabus, from UNEB O-level through A-level Pure
  Maths to first-year university.
- **The clock matches the maths.** 45 seconds a question at Bronze, five
  minutes at Platinum, and no time limit at all in Vibranium — rewarding haste
  on a question that needs a page of working would be the wrong incentive.
- **Multiple choice where it belongs.** Questions whose answer is an expression
  rather than a number — a derivative, an integral, a factorisation — are asked
  as four options, the way UNEB and university papers ask them.
- **Speed matters** — answer before the clock runs down for a bonus on top of the base score.
- **Streaks** build as you keep getting them right, and reset when you miss.
- **Five power-ups**, each costing points: reveal a step, skip, 50/50, freeze the
  timer, or shield your streak from one miss.
- **Every answer is explained.** A miss shows the working line by line, so a wrong
  answer teaches you something instead of just costing you points.
- **Six leagues** — Bronze, Silver, Gold, Diamond, Platinum, Vibranium.
- **Practice what you choose.** The *More* button opens twenty-question runs on
  a single topic, on a whole level of education (Primary, O-level, A-level,
  University), or at random — at Easy, Medium, Hard or Difficult. Practice
  tracks your accuracy by topic but leaves your league alone, so the ladder
  still means something.
- **No adverts, unless you ask for one.** No banners, nothing that interrupts.
  If you want a power-up you cannot afford, you may choose to watch a short
  advert for it — declining costs you nothing, and watching never affects your
  score or your league.
- **Your progress is saved on your device.** No account, no sign-up, no server.
- **A built-in scientific calculator**, from the *Use Calculator* button on the
  home screen: brackets, powers, roots, logs, trigonometry in degrees or
  radians, factorial, percent, memory keys and a history of your last 20
  calculations.

## Playing it

**On a phone or tablet.** Open the link, then add it to your home screen — on
Android that is Chrome's ⋮ menu → *Install app*; on iPhone it is Safari's Share
button → *Add to Home Screen*. You get an icon that opens fullscreen and works
offline.

**On a computer.** Open the link and use the install button in Chrome or Edge's
address bar, or just keep it as a tab.

**As a Windows program.** Download the installer from
[Releases](../../releases). It is unsigned, so Windows shows a blue SmartScreen
notice — choose *More info* → *Run anyway*. The browser install above does the
same job without the download.

Full details in [INSTALL.md](INSTALL.md).

## Running it yourself

```bash
npm install
npm test     # 202 tests
npm run serve
```

Then open the address it prints. The app is plain HTML, CSS and JavaScript with
no framework and no build step — `src/` is the whole site, and it is what gets
deployed.

```bash
npm run dist     # build the Windows installer into dist/
```

## How it is put together

| Path | What is in it |
|---|---|
| `src/` | The entire app. Deployed to GitHub Pages exactly as it is. |
| `src/js/` | Question generation, scoring, sessions, storage, explanations. |
| `src/js/curriculum.js` | What each league asks, how long it allows, and every advanced topic. |
| `src/js/practice.js` | The *More* section: topic groups, levels, difficulty, and unranked practice pools. |
| `src/js/ads.js` | Rewarded adverts only — opt-in, capped, and never worth points. Configured in `ads-config.js`. |
| `src/sw.js` | Service worker — precaches everything so it runs offline. |
| `tests/` | 202 tests over scoring, sessions, storage, questions, explanations, calculator, curriculum. |
| `electron/` | Wrapper that turns the same `src/` into a desktop app. |
| `tools/` | Icon generation, a dev server, and the subpath deployment check. |

Every path in the app is **relative**. GitHub Pages serves a project site from a
subpath (`/mathleague/`, not `/`), and absolute paths are the usual reason a
deployed PWA comes up blank. `tools/test-subpath.mjs` serves the site under a
subpath and asserts that all of it — assets, manifest, service worker precache
list — still resolves:

```bash
node tools/test-subpath.mjs
```

Pushing to `main` redeploys the site automatically via GitHub Actions.

## Licence

MIT — see [LICENSE](LICENSE).
