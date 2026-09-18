/* Service worker: tiene una copia locale dell'applicazione cosi' apra anche senza rete. */
const CACHE = 'flowcharts-v1.2.3';
const ASSETS = [
  './',
  'index.html',
  'main.css',
  'flowrun.css',
  'scripts/compiled/main.js',
  'vendor/graphviz.umd.js',
  'vendor/d3.min.js',
  'vendor/d3-graphviz.min.js',
  'vendor/material-icons.css',
  'vendor/materialicons.woff2',
  'vendor/prism.css',
  'vendor/prism.js',
  'vendor/toastify-js.js',
  'vendor/toastify.min.css',
  'vendor/recoding-file-picker.js',
  'favicon.ico',
  'icona.svg',
  'icona-192.png',
  'manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rete per prima: online si vede sempre la versione aggiornata, la copia
   locale serve solo come riserva quando la rete non c'e'. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
