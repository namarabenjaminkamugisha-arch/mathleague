# mathleague

## What this is
MathLeague — a maths practice game. Ten questions a run, speed bonus, streaks,
power-ups, six leagues, plus a scientific calculator. Plain HTML/CSS/JS, no
framework and no build step. Ships three ways: a website, an installable PWA,
and a Windows desktop app. Owner: Benjamin.

## Status
Phase: Live and published. Version 1.1.0.
Live: https://namarabenjaminkamugisha-arch.github.io/mathleague/
Repo: github.com/namarabenjaminkamugisha-arch/mathleague (PUBLIC)
Last worked on: 2026-08-23

## Done
- v1.0.0 — game, PWA, icons, Electron wrapper, Windows installer.
- Published to Pages; Actions redeploys on every push to main.
- v1.1.0 — scientific calculator. 129 tests.

## Next
- Nothing outstanding. Benjamin decides what comes next.

## Ideas
- Play Store listing via a TWA ($25 one-off). Code signing (~$300/yr, poor value).

## Key files
- `src/` IS the deployed site. No build step; what is there is what ships.
- `src/js/` logic: session, scoring, storage, questions, explain, calculator.
  Only `app.js` and `calc-ui.js` touch the DOM.
- `src/sw.js` service worker. `tests/` node --test. `electron/` desktop wrapper.

## Notes
- READ `.benji/HANDBOOK.md` BEFORE CHANGING ANYTHING. It holds the rules that
  are not visible in the code: how to ship an update so people who already
  installed the app actually receive it, why every path must stay relative,
  and why the calculator must never use eval().
- Two mistakes that break the app silently: forgetting to bump `VERSION` in
  `src/sw.js` on a release, and writing a path that starts with `/`.
- Always verify with `npm test` then `node tools/test-subpath.mjs`.
