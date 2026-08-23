# mathleague

## What this is
_(describe this project in a sentence)_

## Status
Phase: Complete + Pages-ready — awaiting Benjamin to create the GitHub repo and push
Last worked on: 2026-08-23

## Done
- Full app built: core scoring/streak/league/power-up logic, offline explanation engine (arithmetic, fractions, percentages, powers/roots, algebra), Apple-like black/sky-blue UI, PWA (manifest + service worker), generated icon set (favicon.ico + PNGs 16-512 + maskable + apple-touch-icon) via tools/generate-icons.mjs, Electron desktop wrapper with no visible console. 100 unit tests pass (node --test). Windows installer built successfully: dist\MathLeague-Setup-1.0.0.exe (~78 MB, NSIS, unsigned) after fixing a winCodeSign symlink-extraction failure by setting win.signAndEditExecutable/verifyUpdateCodeSignature to false in package.json build config. UI manually verified end-to-end in a browser: run flow, scoring (+15 with speed bonus), penalty (-5), streak reset, step-by-step working panel, all 5 power-ups priced, all 6 leagues with correct thresholds. INSTALL.md written covering Windows/Android/iPhone install, free hosting for off-network phones, update process, and offline limitations.
- GitHub Pages prep complete (local only, nothing pushed): .gitignore written (excludes node_modules 559MB / dist 347MB / build / logs / .env); git repo initialised on main with 4 clean commits (45 source files, ~471 KB); created src/sw.js service worker (was missing) with fully relative precache paths and relative registration in index.html so the app works under a subpath; verified via tools/test-subpath.mjs which serves src/ under /mathleague/ and checks all 50 asset/manifest/sw paths resolve (all pass); added .github/workflows/deploy-pages.yml deploying src/ to Pages on push to main (no build step needed); INSTALL.md gained a 'Play in a browser' section with URL placeholder.

## Next
- Optional polish only: consider code-signing the Windows installer (currently unsigned, triggers SmartScreen) if a certificate is ever available; could add a real hosted deployment (Netlify/GitHub Pages) so the app has a permanent public URL instead of relying on local network serving.
- Published to GitHub Pages as the PUBLIC repo `mathleague` under the account `namarabenjaminkamugisha-arch`. Live at https://namarabenjaminkamugisha-arch.github.io/mathleague/ . Pages source is GitHub Actions (.github/workflows/deploy-pages.yml), so any push to main redeploys it automatically - no manual step.

## Ideas
- _(ideas for later)_

## Key files
- _(the files that matter most)_

## Notes
- _(anything worth remembering)_
