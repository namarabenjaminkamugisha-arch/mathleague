# MathLeague handbook

Everything an agent needs to change this project safely. `PROJECT.md` is the
short orientation that gets loaded automatically; this is the detail, and it is
worth opening before any real change.

---

## 1. The three products, and which one matters

One codebase ships three ways. Confusing them wastes a lot of time.

| Product | What it is | Who gets it | How it updates |
|---|---|---|---|
| **Website** | `src/` served over HTTPS | Everyone, any device | Push to `main` — automatic |
| **PWA** | The same site, installed to a home screen | Phone/tablet/desktop users who tapped "Install" | Same push, *if* the service worker version changed |
| **Windows app** | Electron bundle in an NSIS installer | People who downloaded the `.exe` | **Manual.** They must download a new installer |

**The website is the real distribution.** It reaches every device, costs
nothing, and updates instantly. The `.exe` exists only for people who want a
native Windows program; it is 79 MB and unsigned. Do not treat it as the main
channel — when someone asks "how do others get the app", the answer is the URL.

---

## 2. Shipping an update so people actually receive it

This is the part that goes wrong silently.

An installed PWA is served **from its cache**, not the network. If you push new
files without changing the service worker's cache name, existing users keep
running the old version forever — the deploy looks successful and nothing
reaches them.

**Every user-visible release must:**

1. Bump `VERSION` in `src/sw.js` (e.g. `mathleague-v2` → `mathleague-v3`).
   This is what makes the browser fetch fresh files and bin the old cache.
2. Add any **new** file to the `ASSETS` array in `src/sw.js`, or it will not
   work offline.
3. Bump `version` in `package.json` if the desktop app is being rebuilt.

`src/index.html` listens for `controllerchange` and reloads once when a new
worker takes over, so an open app picks the update up immediately rather than
on some later visit. The `hadController` guard stops that firing on a first
ever visit — do not remove it, or every new visitor gets a pointless reload.

**Shipping the website:**

```bash
npm test && node tools/test-subpath.mjs
git add -A && git commit -m "..." && git push origin main
```

GitHub Actions does the rest. Confirm with `gh run list --limit 1`.

**Shipping the desktop app:**

```bash
npm run dist
gh release create vX.Y.Z "dist/MathLeague-Setup-X.Y.Z.exe" --title "..." --notes "..."
```

There is no auto-update in the Electron build. Existing desktop users only get
a new version by downloading it, which is another reason to point people at the
website instead.

---

## 3. Paths must always be relative

GitHub Pages serves this from **`/mathleague/`**, not the site root. A path
beginning with `/` resolves to `namarabenjaminkamugisha-arch.github.io/` and
404s. The symptom is a blank page with no obvious error — the classic broken
Pages deploy.

So: `./js/app.js`, never `/js/app.js`. This applies to the HTML, the CSS, the
manifest's `start_url` and `scope`, the icon list, and every entry in the
service worker's `ASSETS`.

`tools/test-subpath.mjs` serves the site under a subpath and asserts that every
asset, manifest entry and precache path resolves. **Run it after touching any
path, filename or the service worker.** It is the only check that catches this.

---

## 4. The league ladder

`curriculum.js` is the single source of truth for what each league asks, how
many questions a run is, and how long each question allows. Changing the game's
difficulty means editing `LEAGUE_PLAN` there — nothing else.

Two rules that are easy to break:

- **Every answer is one number, or one of four options.** Free-text algebra
  cannot be marked reliably, and telling a correct student they are wrong is
  worse than asking a narrower question. If a topic's answer is an expression
  (a derivative, an integral, a factorisation), make it multiple choice with
  `choiceQuestion()` rather than trying to parse what they typed.
- **Working is written as plain strings in `curriculum.js`**, and converted to
  the `{ text }` objects the UI renders by `normaliseSteps()` in `questions.js`.
  A generator returning a bare string straight to the UI renders a blank panel.

`seconds: null` means untimed. Everything downstream must test for `null`, not
for zero — `tick()` refuses to expire, and no speed bonus is awarded, because
rewarding haste on a question that needs a page of working is the wrong
incentive.

Distractors for multiple choice should be the mistakes students actually make
(a sign error, a forgotten chain rule), not random noise — otherwise the right
answer stands out and the question tests nothing. `choiceQuestion()` throws if
it cannot build four distinct options, so a generator producing collapsing
distractors fails loudly in the tests rather than silently shipping a
three-option question.

## 5. Practice runs are unranked, on purpose

`practice.js` powers the **More** section: pick a topic, pick a level of
education, or take anything at random, at one of four difficulties. Every
practice run is 20 questions.

**A practice run must never move the score, streak or league.** `applyRun()` in
`storage.js` checks `session.practice` and skips those fields. If practice paid
league points, twenty Easy additions would be the fastest route to Vibranium and
the ladder would stop meaning anything. The banner on the quiz screen and the
line on the results screen both say so, because silently withholding points
would read as a bug.

Practice *does* record accuracy per topic and count towards lifetime totals —
that is the part students want, and it cannot be gamed into a rank.

The pool returned by `buildPool()` overrides both the league's topic list and
its clock, so a Vibranium player practising Arithmetic gets arithmetic on the
practice clock, not untimed calculus. `nextQuestion()` must not re-read the
league for a practice run, or a rising score would drag the questions away from
the topic the player chose.

Difficulty maps to a generator tier *and* a clock. The tier only widens number
ranges for topics that accept one — mostly arithmetic and early algebra. For
advanced topics difficulty is the clock alone, which is honest: "harder
integration by parts" is a different question, not a bigger one.

## 6. Architecture

Deliberate separation — keep it.

- **Logic modules** (`session.js`, `scoring.js`, `storage.js`, `questions.js`,
  `explain.js`, `explain-advanced.js`, `calculator.js`) are pure. No DOM, no
  globals. This is why they are testable.
- **UI modules** (`app.js`, `calc-ui.js`) render state and forward intent.
  They own all `document` access.

When adding a feature, put the rules in a logic module with tests, and let the
UI file only draw it. Do not reach into the DOM from a logic module.

Screens are `<main class="screen">` elements toggled by `show(name)` in
`app.js`, matching `id="screen-<name>"`. Adding a screen means adding that
element plus a `show('yourname')` call.

### The calculator

`calculator.js` is a hand-written tokenizer and recursive-descent parser.

**It must never use `eval()`.** This is a public page; `eval` would execute
whatever a user pasted. There is a test named "never runs arbitrary code" that
exists to stop anyone "simplifying" it back to `eval`.

Grammar, loosest binding first:

```
expr    := term (('+' | '-') term)*
term    := unary (('*' | '/' | '%mod') unary)*
unary   := ('-' | '+') unary | power      // looser than ^, so -2^2 = -4
power   := postfix ('^' unary)?           // right-associative: 2^3^2 = 512
postfix := atom ('!' | '%')*
atom    := number | constant | fn '(' expr ')' | '(' expr ')'
```

Two subtleties that were bugs before they were tests:

- **Unary minus binds looser than `^`.** `-2^2` is `-4`, not `4`. Putting
  `unary` below `power` in the grammar breaks this.
- **`%` is context-sensitive.** Trailing, it means percent (`50%` → `0.5`);
  between two values it means remainder (`10%3` → `1`). `isModulo()` decides.

Errors are thrown as `CalcError` with a sentence a person can act on, and the
UI shows that sentence. Do not replace them with `NaN`.

---

## 7. Testing

```bash
npm test                      # 186 tests, node's built-in runner
node tools/test-subpath.mjs   # deployment safety
npm run serve                 # dev server on :5173
```

Tests live beside the module they cover. Prefer testing a logic module directly
over testing through the DOM.

---

## 8. Facts worth not rediscovering

- **Repo owner is `namarabenjaminkamugisha-arch`.** Benjamin also has a
  `jusbenji-png` account, and the first five commits are attributed to it
  because git's local `user.email` was wrong at the time. Fixed since.
- **`dist/` and `node_modules/` are gitignored on purpose.** They are 347 MB
  and 559 MB; the tracked source is under 500 KB. Never commit them — publish
  binaries as release assets instead.
- **The installer is unsigned**, so Windows shows a SmartScreen notice.
  Certificates run $200-400/year. The browser install has no such warning, so
  this is not worth fixing.
- **Electron code signing is disabled** in `package.json`
  (`signAndEditExecutable`, `verifyUpdateCodeSignature` both false), because
  electron-builder's exe-editing step first extracts a `winCodeSign` bundle
  full of macOS symlinks, and Windows refuses to create those without
  elevation. Turning it back on will break `npm run dist`.
- **The exe icon is set by `electron/after-pack.cjs`, using rcedit.** That is
  the step the disabled flag above would otherwise perform. Without it the
  packaged exe silently keeps Electron's default atom, which is what the
  desktop shortcut shows — the app looks wrong on the desktop while looking
  right everywhere else. Do not remove the hook.
- **`isDev = !app.isPackaged`** in `electron/main.cjs` — that is what keeps
  DevTools and the console window out of the packaged app.
- **Progress is stored in `localStorage`** and never leaves the device. There
  is no account system, no server and no analytics. Keep it that way; it is
  why the app needs no privacy policy.
- **Theme:** black `#05070a` with sky blue `#38bdf8`. Tokens are CSS variables
  at the top of `src/css/app.css`. Use them rather than literal colours.
