#!/usr/bin/env node
// test-subpath.mjs — serves src/ under a subpath (like GitHub Pages does) and
// verifies every asset the app references resolves with HTTP 200.
// Run: node tools/test-subpath.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUBPATH = '/mathleague/';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const port = 8123;

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!url.startsWith(SUBPATH)) { res.writeHead(404).end('outside subpath'); return; }
  let rel = url.slice(SUBPATH.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(buf);
  });
});

const get = url => new Promise(resolve => {
  http.get(url, res => { res.resume(); resolve(res.statusCode); }).on('error', () => resolve(0));
});

server.listen(port, async () => {
  const base = `http://localhost:${port}${SUBPATH}`;
  let failures = 0;
  const check = async (label, u) => {
    const code = await get(u);
    const ok = code === 200;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${code})  ${u}`);
    return ok;
  };

  // 1. the page itself, with and without index.html
  await check('page /', base);
  await check('page index.html', base + 'index.html');

  // 2. everything index.html references (href/src)
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map(m => m[1])
    .filter(u => !u.startsWith('http') && !u.startsWith('#') && !u.startsWith('data:'));
  for (const r of refs) await check(`html ref ${r}`, base + r.replace(/^\.\//, ''));

  // 3. everything the manifest references, plus start_url resolution
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  await check('manifest start_url', new URL(man.start_url, base).href);
  for (const icon of man.icons) await check(`manifest icon ${icon.src}`, new URL(icon.src, base).href);

  // 4. everything the service worker precaches
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const assets = [...sw.matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]);
  for (const a of assets) await check(`sw asset ${a}`, new URL(a, base).href);

  // 5. sanity: no absolute-root references anywhere in the app
  const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'css/app.css'];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    const bad = text.match(/(?:href|src)="\/(?!\/)/) || text.match(/url\(\s*\/(?!\/)/);
    if (bad) { failures++; console.log(`FAIL  absolute root path found in ${f}`); }
    else console.log(`PASS  no absolute root paths in ${f}`);
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED — app works under a subpath.' : `\n${failures} CHECK(S) FAILED`);
  server.close();
  process.exit(failures === 0 ? 0 : 1);
});
