// Cinetor service worker (docs/08 §Web side, T35): precache the shell, network-first for TMDB,
// cache-first for images. The cache name carries the build version (replaced at build).
const VERSION = '0.0.0-ci.66';
const SHELL = 'cinetor-shell-' + VERSION;
const IMAGES = 'cinetor-img-v1';
const API = 'cinetor-api-v1';
const PRECACHE = ['./', './index.html', './m/', './m/index.html', './d/', './d/index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('cinetor-shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.themoviedb.org') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(API).then((x) => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(caches.open(IMAGES).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => (r.ok && c.put(req, r.clone()), r)))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // media (video ranges, downloads), previews and update files are never cached
  if (/\/(media|preview)\//.test(url.pathname) || /latest\.json|version\.json/.test(url.pathname)) return;
  e.respondWith(
    caches.open(SHELL).then((c) =>
      c.match(req).then((hit) => {
        const net = fetch(req).then((r) => (r.ok && r.type === 'basic' && c.put(req, r.clone()), r)).catch(() => hit);
        return hit || net;
      }),
    ),
  );
});
