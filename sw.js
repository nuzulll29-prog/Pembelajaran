// Kelas Madin — service worker
// Dua cache terpisah:
//  - APP_CACHE (ikut versi, `kelas-madin-vN`): file aplikasi (html/css/js/ikon). Dibersihkan
//    setiap update supaya aplikasi selalu pakai versi terbaru.
//  - QURAN_CACHE (nama tetap, TIDAK ikut naik versi): data mushaf per juz/halaman yang
//    diunduh saat surat dibuka. Sengaja tidak pernah dihapus saat update aplikasi, supaya
//    surat yang sudah pernah dibuka tetap tersedia offline — guru tidak perlu unduh ulang
//    Al-Qur'an hanya karena ada pembaruan aplikasi.
const CACHE_NAME = 'kelas-madin-v12';
const QURAN_CACHE = 'kelas-madin-quran-data';
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
];
// Data mushaf (dasar): daftar surat/juz + font sizing. Diprakuat ke QURAN_CACHE (bukan
// APP_SHELL) supaya tidak pernah ikut terhapus saat versi aplikasi naik.
const QURAN_SHELL = [
  './vendor/quran-madina-html/assets/db/Madina05-Hafs-16px/manifest.json',
];
// Request yang termasuk "data mushaf" (per juz/halaman) dan harus disimpan permanen.
function isQuranDataRequest(url){
  return url.pathname.includes('/vendor/quran-madina-html/assets/db/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
      caches.open(QURAN_CACHE).then((cache) => cache.addAll(QURAN_SHELL)),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Hapus cache lama, TAPI selalu sisakan QURAN_CACHE apa pun nama versi APP_CACHE saat ini.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== QURAN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only handle same-origin requests (our own app + vendored mushaf assets);
  // let everything else (e.g. Google Fonts) go straight to the network as normal.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const cacheName = isQuranDataRequest(url) ? QURAN_CACHE : CACHE_NAME;
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(cacheName).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
