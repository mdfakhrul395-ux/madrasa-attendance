// ShikkhaOS service worker v33 — "আগে ক্যাশ, পরে নেটওয়ার্ক" (stale-while-revalidate)
// অ্যাপ আইকনে চাপলে সব ফাইল সাথে সাথে ক্যাশ থেকে আসে, আর ব্যাকগ্রাউন্ডে নতুন কপি নেমে ক্যাশ হালনাগাদ হয়।
// ফাইল বদলালে এই CACHE_NAME-এর সংখ্যা বাড়িয়ে দিন: তাহলে অ্যাপ খোলার কয়েক সেকেন্ডের মধ্যেই নিজে একবার রিফ্রেশ হয়ে নতুন কোড নেবে।
// না বাড়ালেও নতুন কোড পরের বার অ্যাপ খুললে চলে আসবে।
const CACHE_NAME = 'madrasa-attendance-v33';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './NotoSansBengali-Regular.woff',
  './NotoSansBengali-Bold.woff',
  './firebase-config.js',
  './batch-chunk.js',
  './usage-tracker.js',
  './app.js',
  './suggestion-patch.js',
  './dashboard.js',
  './leave-format.js',
  './diary-ict.js',
  './student-edit.js',
  './tenant-link.js',
  './homework.js',
  './exam-routine.js',
  './plans.js',
  './plans-gate.js',
  './plans-expiry.js',
  './payments.js',
  './reads-saver.js',
  './icons.js',
  './ui-polish.js',
  './final-result.js',
  './class-teacher.js',
  './fees-quick.js',
  './demo.js',
  './desktop.js'
];

// কোনো একটি ফাইল না পাওয়া গেলেও ইনস্টল ব্যর্থ হয় না (আগের addAll-এ একটি ফাইল না থাকলে সবকিছু ব্যর্থ হতো)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // শুধু অ্যাপের নিজের ফাইল; Firebase/Firestore সরাসরি নেটওয়ার্কে যায়
  if (url.origin !== self.location.origin) return;
  const isNav = req.mode === 'navigate';

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // ?m=কোড-সহ লিংকে খুললেও (মাদ্রাসার নিজস্ব লিংক) ক্যাশ থেকে index.html আসে
    let cached = await cache.match(req, { ignoreSearch: isNav });
    if (!cached && isNav) cached = await cache.match('./index.html');

    const update = fetch(req).then(async res => {
      if (res && res.ok && res.type === 'basic') await cache.put(isNav ? './index.html' : req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) { e.waitUntil(update); return cached; }
    const res = await update;
    return res || new Response('অফলাইন — ইন্টারনেট সংযোগ পরীক্ষা করুন', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
