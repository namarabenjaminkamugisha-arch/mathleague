// sw.js — MathLeague service worker.
// Everything is cached relative to the service worker's own scope, so the app
// works whether it is served from the site root or a subpath such as
// GitHub Pages' /repo-name/.

const VERSION = 'mathleague-v3';

// All app assets, listed relative to this file's location.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/session.js',
  './js/scoring.js',
  './js/storage.js',
  './js/questions.js',
  './js/explain.js',
  './js/explain-advanced.js',
  './js/calculator.js',
  './js/calc-ui.js',
  './js/util.js',
  './icons/favicon.ico',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-48.png',
  './icons/icon-64.png',
  './icons/icon-128.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/splash.svg',
  './icons/splash-1242x2688.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin requests, falling back to the network.
// Navigations fall back to the cached index.html so the app opens offline.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match(new URL('./index.html', self.registration.scope).href);
          }
          throw new Error('offline and not cached');
        });
    })
  );
});
