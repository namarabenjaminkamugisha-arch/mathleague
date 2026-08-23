# Installing MathLeague

MathLeague works four ways: straight in a web browser, as a Windows desktop
app, as an installed app on an Android phone, and as an installed app on an
iPhone/iPad. Pick the one you need below. None of them need an app store
account, and all of them work fully offline once installed (see the note at
the very end for the one exception).

---

## 0. PLAY IN A BROWSER (easiest — nothing to install)

Once the project is published to GitHub Pages, the game has a permanent
public address that works on any device, anywhere — this PC does not need to
be switched on.

**The address is:**

```
https://namarabenjaminkamugisha-arch.github.io/mathleague/
```

*(Nothing to install. The page works on any modern browser — phone, tablet
or computer — and keeps working offline once you have opened it, because the
service worker stores it on the device.)*

Open that link in any browser and play immediately. From that same link you
can also install it to a phone's home screen — follow the Android or iPhone
sections below, but use this address instead of the `192.168...` one, and
skip the "start the server" and "find the IP address" steps entirely.

The site republishes itself automatically about a minute after any change is
pushed to the project's main branch on GitHub.

---

## THE CALCULATOR

Alongside the game there is a full scientific calculator, reached from the
**Use Calculator** button on the home screen, below the league ladder.

It handles brackets and proper operator precedence, powers and roots, logs,
trigonometry in degrees or radians (with inverse functions), factorial,
percent and remainder, and the constants pi and e. There are memory keys
(MC, MR, M+, M-), an ANS key that reuses your last answer, a running preview
of the result as you type, and a history of your last twenty calculations
that you can tap to reuse. It works offline like the rest of the app, and
the keyboard works as well as the buttons.

---

## 1. WINDOWS

**Where to get the installer:**
Download the latest `MathLeague-Setup-*.exe` from the
[Releases page](../../releases). It is about 79 MB.

If you are building it yourself, it appears in the `dist` folder after
running `npm run dist`.

**Steps:**

1. Open the downloaded file's folder in File Explorer.
2. Double-click the `MathLeague-Setup-*.exe` file.
3. Windows will show a blue **"Windows protected your PC"** screen. This
   happens because the app is not digitally signed with a paid certificate —
   it does not mean anything is wrong with it. Click the small grey text
   **"More info"**, then click the **"Run anyway"** button that appears.
4. The MathLeague setup wizard opens. Choose whether to let it change the
   install folder if you want (the default is fine), then click **Install**.
5. When it finishes, click **Finish**. MathLeague launches automatically in
   its own window — no browser, no console window.

**Where it appears afterwards:**
- A shortcut named **MathLeague** appears on the Desktop.
- It also appears in the Start Menu — click Start and type "MathLeague" to
  find it any time.

**To uninstall:**
Click Start → type "Add or remove programs" → press Enter → scroll to or
search for **MathLeague** → click it → click **Uninstall** → confirm. This
removes the app but keeps your saved scores unless you tick the option to
remove app data too.

---

## 2. ANDROID (phone or tablet on the same Wi‑Fi as this PC)

MathLeague is a web app you install straight from Chrome — no Play Store
needed.

**Step 1 — start the app server on this PC.**
Open a Command Prompt in the project folder and run:

```
npm run serve
```

Leave that window open — it prints `http://localhost:5173`. Keep it running
while you use the app on your phone (closing the window stops the server).

**Step 2 — find this PC's IP address.**
In a second Command Prompt window, run:

```
ipconfig
```

Look for **"IPv4 Address"** under your active Wi‑Fi adapter — it looks like
`192.168.1.23`. That number is this PC's address on your home network.

**Step 3 — open it on your phone.**
Make sure your phone is on the **same Wi‑Fi network** as this PC. Open
Chrome and type this into the address bar (using the number you just found):

```
http://192.168.1.23:5173
```

**Step 4 — add it to the home screen.**
1. Tap the **three-dot menu** (⋮) in the top-right corner of Chrome.
2. Tap **"Add to Home screen"** (on some versions it says **"Install app"**).
3. Confirm the name and tap **Add** (then **Add to Home screen** again if
   asked to confirm).

**What changes once installed:**
An icon named MathLeague appears on your home screen. Opening it launches
full-screen, with no address bar or browser buttons — it feels like a normal
app. It keeps working with the Wi‑Fi off, because the service worker cached
everything the first time it loaded.

---

## 3. IPHONE / IPAD

**Safari is required.** Chrome, Firefox and every other browser on iOS are
not allowed by Apple to install web apps — only Safari can do it, so make
sure you use Safari for this.

Follow steps 1–3 from the Android section above to start the server and find
the PC's IP address, then on the iPhone/iPad:

1. Open **Safari** (not Chrome) and go to `http://<the PC's IP address>:5173`,
   e.g. `http://192.168.1.23:5173`.
2. Tap the **Share button** — the square with an arrow pointing up, in the
   bottom toolbar (or top of the screen on iPad).
3. Scroll down the share sheet and tap **"Add to Home Screen"**.
4. Tap **Add** in the top-right corner.

**What changes once installed, and what does not:**
An icon appears on the home screen and opens full-screen with no Safari
address bar — it looks and feels like an installed app, works offline, and
keeps your scores saved locally. Be clear-eyed about what it is *not*: it is
a home-screen web app, not an App Store app. That means: no listing in the
App Store, no automatic App Store updates (updates happen by you reopening it
while online — see below), and no App Store review process. Everything about
gameplay, offline play, and how it looks is unaffected by that distinction.

---

## GETTING IT TO A PHONE THAT IS NOT ON YOUR HOME NETWORK

The `npm run serve` method above only works over the same Wi‑Fi. To let
someone anywhere install it, put the app on free hosting instead:

- **Netlify Drop** (`app.netlify.com/drop`) — drag the `src` folder onto the
  page in a browser; it gives you a public `https://something.netlify.app`
  link in seconds. No account needed for a quick drop.
- **GitHub Pages** — free if the project is pushed to a GitHub repository;
  turns it into `https://namarabenjaminkamugisha-arch.github.io/mathleague`.
- **Cloudflare Pages** or **Vercel** — also free tiers, similar drag-and-drop
  or connect-a-repo flow.

Once it's hosted, the phone just opens that public link in Chrome (Android)
or Safari (iPhone) and installs it exactly as described above — no shared
Wi‑Fi required.

---

## UPDATING THE APP LATER

- **Browser and home-screen app (Android, iPhone, computer):** nothing to do.
  Pushing to `main` redeploys the site automatically, and the app picks the
  update up the next time it is opened with an internet connection. It then
  reloads itself straight away, so the new version is in use immediately
  rather than on some later visit. Nothing needs reinstalling, and saved
  progress is untouched.

  One rule when releasing: **bump `VERSION` in `src/sw.js`** (for example
  `mathleague-v2` to `mathleague-v3`), and add any new file to the `ASSETS`
  list there. An installed app is served from its own cache, so without a new
  version string people keep running the old files and the update never
  reaches them.

- **Windows desktop:** there is no auto-update. Build a new installer
  (`npm run dist`), publish it on the Releases page, and people download and
  run it. It installs over the old version and keeps saved scores. This is
  another reason to point people at the website instead.

---

## WHAT DOES NOT WORK OFFLINE

Once the app has loaded successfully one time (desktop, Android or iPhone),
everything works offline: answering questions, scoring, streaks, leagues,
power-ups, and the step-by-step explanations are all generated on the device
with no network calls at all. The only thing that needs a connection is the
very first load (or loading a brand-new update) — after that, feel free to
turn on airplane mode.
