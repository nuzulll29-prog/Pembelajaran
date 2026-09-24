// Kelas Madin — service worker
// Precaches the app shell + the mushaf reader's core assets on install, then uses a
// cache-first (network-fallback, background-refresh) strategy for everything else —
// so any surah a teacher has opened once keeps working with no internet afterwards.
const CACHE_NAME = 'kelas-madin-v7';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-180.png',
  './icons/icon-32.png',
  './vendor/quran-madina-html/dist/quran-madina-html.min.js',
  './vendor/quran-madina-html/dist/quran-madina-html.min.css',
  './vendor/quran-madina-html/assets/fonts/Hafs.woff2',
  './vendor/quran-madina-html/assets/db/Madina05-Hafs-16px/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only handle same-origin requests (our own app + vendored mushaf assets);
  // let everything else (e.g. Google Fonts) go straight to the network as normal.
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
