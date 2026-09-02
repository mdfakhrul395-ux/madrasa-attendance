const CACHE_NAME = 'madrasa-attendance-v3';
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
  // Only handle our own app-shell files; let everything else (Firebase/Firestore) go straight to network.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request)
        .then(response => {
          caches.open(CACHE_NAME).then(c => c.put(e.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      // Cache-first: show cached immediately if available, update in background
      return cached || networkFetch;
    })
  );
});
