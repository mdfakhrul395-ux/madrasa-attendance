const CACHE_NAME = 'madrasa-attendance-v9';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// নেটওয়ার্ক রিকোয়েস্ট এত সময়ের মধ্যে (ms) সাড়া না দিলে সাথে সাথে ক্যাশ থেকে দেখানো হবে,
// যাতে দুর্বল নেটওয়ার্কেও অ্যাপ দ্রুত খোলে। ভালো নেটে এই টাইমআউট স্পর্শই হয় না — নেটওয়ার্ক
// রেসপন্সই আগে চলে আসে এবং সেটাই দেখানো হয় (তাই লেটেস্ট কোড পাওয়া নিশ্চিত থাকে)।
const NETWORK_TIMEOUT_MS = 1500;

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
    (async () => {
      const cachePromise = caches.match(e.request);

      // নেটওয়ার্ক রিকোয়েস্ট শুরু করা হয় — সফল হলে ক্যাশ আপডেট হয়, ব্যাকগ্রাউন্ডে চলতে থাকে
      // এমনকি যদি টাইমআউটের কারণে আমরা আগেই ক্যাশড কপি দিয়ে দিই।
      const networkPromise = fetch(e.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          return response;
        })
        .catch(() => null);

      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));

      // যেটা আগে সাড়া দেয় (নেটওয়ার্ক বা টাইমআউট) সেটাই আগে চেষ্টা করা হয়,
      // নেটওয়ার্ক ব্যর্থ/দেরি হলে ক্যাশড কপি, তাও না থাকলে নেটওয়ার্ক রেসপন্সের জন্য অপেক্ষা।
      const early = await Promise.race([networkPromise, timeoutPromise]);
      if (early) return early;

      const cached = await cachePromise;
      if (cached) return cached;

      const late = await networkPromise;
      if (late) return late;

      return new Response('অফলাইন — ইন্টারনেট সংযোগ পরীক্ষা করুন', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })()
  );
});
