# mathleague

## What this is
MathLeague — a maths game from mental arithmetic to university maths. Six
leagues, streaks, power-ups, a calculator, a practice section. Plain HTML/CSS/JS,
no framework, no build step. Ships as a website, a PWA and a Windows app.

## Status
Phase: Live and published. Version 1.3.0.
Live: https://namarabenjaminkamugisha-arch.github.io/mathleague/
Repo: github.com/namarabenjaminkamugisha-arch/mathleague (public)
Last worked on: 2026-08-23

## Done
- v1.0.0 game + PWA + installer. Pages redeploys on each push to main.
- v1.1.x calculator (+ phone keyboard fix).
- v1.2.0 syllabus ladder, multiple choice, icon fix.
- v1.3.0 More: practice by topic/level/random, 4 difficulties. 186 tests.

## Next
- Monetisation: see BUSINESS.md step 9 before building anything.


## Key files
- `src/` IS the deployed site. No build step; what is there ships.
- `src/js/` logic modules; only `app.js`/`calc-ui.js` touch the DOM.
- `curriculum.js` = each league's topics, run length and clock.
- `practice.js` = More. Practice is UNRANKED; never let it move the score.
- `src/sw.js` worker. `tests/` node --test. `electron/` wrapper.

## Notes
- THIS REPO IS PUBLIC. The monetisation plan is `.benji/BUSINESS.md`, which is
  gitignored. Read it for context, but never copy pricing or strategy from it
  into any tracked file, commit message or release note.
- READ `.benji/HANDBOOK.md` BEFORE CHANGING ANYTHING. It holds the rules the
  code does not show: shipping updates people receive, why paths stay relative,
  why the calculator never uses eval(), why practice is unranked.
- Breaks the app silently: forgetting to bump `VERSION` in `src/sw.js` on a
  release, and writing a path that starts with `/`.
- Verify with `npm test` then `node tools/test-subpath.mjs`.
