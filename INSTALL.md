# Installing MathLeague

MathLeague works three ways: as a Windows desktop app, as an installed app on
an Android phone, and as an installed app on an iPhone/iPad. Pick the one you
need below. None of them need an app store account, and all of them work
fully offline once installed (see the note at the very end for the one
exception).

---

## 1. WINDOWS

**Where the installer is:**
`dist\MathLeague-Setup-1.0.0.exe` inside the project folder
`C:\Users\LENOVO\Projects\mathleague-benji`
It is about 78 MB.

**Steps:**

1. Open File Explorer and go to that `dist` folder.
2. Double-click `MathLeague-Setup-1.0.0.exe`.
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
  turns it into `https://yourname.github.io/mathleague`.
- **Cloudflare Pages** or **Vercel** — also free tiers, similar drag-and-drop
  or connect-a-repo flow.

Once it's hosted, the phone just opens that public link in Chrome (Android)
or Safari (iPhone) and installs it exactly as described above — no shared
Wi‑Fi required.

---

## UPDATING THE APP LATER

- **Windows desktop:** build a new installer (`npm run dist`) and have people
  run the new `.exe` — it installs over the old version and keeps saved
  scores.
- **Android / iPhone home-screen app:** just update the files on whichever
  server or hosting you used. The service worker checks for a new version
  each time the app is opened with an internet connection, downloads it
  quietly, and the new version is used the next time the app is closed and
  reopened. Nothing needs reinstalling.

---

## WHAT DOES NOT WORK OFFLINE

Once the app has loaded successfully one time (desktop, Android or iPhone),
everything works offline: answering questions, scoring, streaks, leagues,
power-ups, and the step-by-step explanations are all generated on the device
with no network calls at all. The only thing that needs a connection is the
very first load (or loading a brand-new update) — after that, feel free to
turn on airplane mode.
