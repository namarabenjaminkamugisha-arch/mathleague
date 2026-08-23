// ads-config.js — the ONLY file to edit when switching adverts on.
//
// MathLeague shows **rewarded adverts only**: the player chooses to watch one
// in exchange for a power-up. There are no banners and no interstitials, and
// none should be added. Forced adverts pay less, put the app at risk under
// Google Play's Families Policy (this is an app children use), and would make
// it unsellable to schools.
//
// Shipped with provider 'off', so a fresh install shows nothing to anyone.

export const ADS = {
  // 'off'      — no adverts at all. The reward button never appears. (default)
  // 'test'     — a fake advert for development: a short countdown, no network.
  //              Use this to see and test the flow without an ad account.
  // 'h5games'  — Google H5 Games Ads (part of AdSense). The real one for a
  //              web app or a PWA wrapped for the Play Store.
  provider: 'off',

  // Your AdSense publisher ID, e.g. 'ca-pub-0000000000000000'.
  //
  // BOTH lines must change to switch adverts on: this one AND `provider`
  // above. Pasting the ID alone changes nothing, and setting the provider
  // without an ID is treated as 'off' rather than offering an advert that
  // could never load.
  publisherId: '',

  // Children use this app. Non-personalised adverts are required for them
  // under Google Play's Families Policy and COPPA, and requesting them for
  // everyone is the simple, safe choice. Do not set this to false without
  // taking proper advice.
  nonPersonalisedOnly: true,

  // How many rewarded adverts one person may watch per day. A cap keeps the
  // app feeling like a game rather than an advert delivery machine, and stops
  // anyone farming power-ups indefinitely.
  dailyLimit: 5,

  // Seconds to wait between adverts, so the offer cannot be spammed.
  cooldownSeconds: 60,
};
