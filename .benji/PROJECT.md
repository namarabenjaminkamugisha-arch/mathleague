# mathleague

## What this is
MathLeague — a maths game running from mental arithmetic to university maths.
Six leagues, streaks, power-ups, a scientific calculator, and a practice
section. Plain HTML/CSS/JS, no framework, no build step. Ships as a website,
an installable PWA, and a Windows app. Owner: Benjamin.

## Status
Phase: Live and published. Version 1.3.0.
Live: https://namarabenjaminkamugisha-arch.github.io/mathleague/
Repo: github.com/namarabenjaminkamugisha-arch/mathleague (public)
Last worked on: 2026-08-23

## Done
- v1.0.0 game + PWA + installer. Pages redeploys on each push to main.
- v1.1.x calculator (+ phone keyboard fix).
- v1.2.0 syllabus ladder, multiple choice, desktop icon fix.
- v1.3.0 More: practice by topic/level/random at 4 difficulties. 186 tests.

## Next
- Nothing outstanding.

## Ideas
- Play Store listing via a TWA. See HANDBOOK.

## Key files
- `src/` IS the deployed site. No build step; what is there ships.
- `src/js/` logic modules. Only `app.js` and `calc-ui.js` touch the DOM.
- `curriculum.js` owns what each league asks, its run length and its clock.
- `practice.js` owns More. Practice is UNRANKED - never let it move the
  score, or the ladder becomes farmable.
- `src/sw.js` service worker. `tests/` node --test. `electron/` wrapper.

## Notes
- READ `.benji/HANDBOOK.md` BEFORE CHANGING ANYTHING. It holds the rules the
  code does not show: how to ship an update so people who already installed
  the app receive it, why paths must stay relative, why the calculator must
  never use eval(), and why practice must stay unranked.
- Two mistakes that break the app silently: forgetting to bump `VERSION` in
  `src/sw.js` on a release, and writing a path that starts with `/`.
- Verify with `npm test` then `node tools/test-subpath.mjs`.
