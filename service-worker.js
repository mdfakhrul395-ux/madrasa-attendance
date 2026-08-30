const CACHE_NAME = 'madrasa-attendance-v2';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for everything so Firestore data & app updates stay fresh;
  // falls back to cache when offline.
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
