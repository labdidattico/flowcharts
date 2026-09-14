/* Service worker: tiene una copia locale dell'applicazione cosi' apra anche senza rete. */
const CACHE = 'flowcharts-v1.0.0';
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
  'vendor/toastify.min.css'
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
