/* ShikkhaOS — রিড কমানোর স্তর (reads-cut.js)
 *
 * app.js, dashboard.js, homework.js বা অন্য কোনো ফাইল বদলাতে হয় না। এই ফাইল db.collection(...) এর ওপর
 * বসে নির্দিষ্ট কয়েকটি "ভারী" কোয়েরি চিনে সেগুলো হালকা করে দেয়। অন্য সব কোয়েরি হুবহু আগের মতো চলে।
 *
 * index.html এ reads-saver.js এর পরে (icons.js এর আগে) লোড করুন:
 *   <script defer src="reads-cut.js"></script>
 *
 * কী কী কমে:
 * ১) শিক্ষকের হোম: ছুটি শুধু "অপেক্ষমাণ" (আগে সর্বশেষ ১০০টি), ভর্তি/পরীক্ষার ফি শুধু "বকেয়া" (আগে ২০০টি)
 *    — ফলাফল হুবহু একই, শুধু অপ্রয়োজনীয় ডকুমেন্ট পড়া হয় না
 * ২) শিক্ষার্থীর উপস্থিতি: শুধু শেষ ১০০ দিন (আগে সারা জীবনের সব হাজিরা, যা প্রতিদিন বাড়ত)
 * ৩) নোটিশ / ডায়েরি / হোমওয়ার্ক (শিক্ষার্থীর পাশ): সর্বশেষ ৫০টি (আগে সব, যা প্রতিদিন বাড়ত)
 * ৪) আগের দিনগুলোর হাজিরা (হোমের ৭ দিনের চার্ট, মাসিক সারাংশ, বের হওয়ার সময় রিপোর্ট):
 *    ৩০ মিনিট ফোনে জমা রাখা হয়। আজকের হাজিরা কখনোই জমা রাখা হয় না, আর এই ডিভাইসে কোনো
 *    হাজিরা লিখলেই জমা মুছে যায়। হোমের ↻ বাটনেও মুছে যায়।
 *
 * সেবা নিরাপদ রাখার ব্যবস্থা:
 * - নতুন কোয়েরির জন্য ইনডেক্স না থাকলে (শুধু শিক্ষার্থীর উপস্থিতি) অ্যাপ নিজে থেকে আগের কোয়েরিতে ফিরে যায়,
 *   কিছু ভাঙে না। ডিবাগ মোড চালু থাকলে ইনডেক্সের লিংক ব্যানারে দেখা যায়।
 * - এই ফাইলে কোনো সমস্যা হলে (try/catch) আগের আচরণই চলে।
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || !db || typeof db.collection !== 'function') return;
  if (db.__readsCut) return;
  db.__readsCut = true;

  const origCollection = db.collection.bind(db);
  const HOT = { leaves: 1, fees_onetime: 1, attendance: 1, notices: 1, diary: 1, homework: 1 };
  const SEP = '|';

  const pad2 = n => String(n).padStart(2, '0');
  const localYmd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const todayStr = () => localYmd(new Date());
  const ymdDaysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return localYmd(d); };

  // ---------------------------------------------------------------
  // কোয়েরির "ছাপ": যেমন  where:madrasaId,==,m1|orderBy:createdAt,desc|limit:100
  // ---------------------------------------------------------------
  const sig = ops => ops.map(o => o.m + ':' + o.a.join(',')).join(SEP);

  const RULES = {
    leaves: [
      // হোম ড্যাশবোর্ড: সর্বশেষ ১০০টি ছুটি থেকে অপেক্ষমাণগুলো বাছা হতো → সরাসরি অপেক্ষমাণগুলোই আনা
      { re: /^where:madrasaId,==,[^|]+\|orderBy:createdAt,desc\|limit:100$/,
        to: ops => [ops[0], { m: 'where', a: ['status', '==', 'pending'] }, { m: 'limit', a: [50] }] }
    ],
    fees_onetime: [
      // হোম ড্যাশবোর্ড: সর্বশেষ ২০০টি ফি থেকে বকেয়াগুলো বাছা হতো → সরাসরি বকেয়াগুলোই আনা
      { re: /^where:madrasaId,==,[^|]+\|orderBy:createdAt,desc\|limit:200$/,
        to: ops => [ops[0], { m: 'where', a: ['status', '==', 'due'] }] }
    ],
    attendance: [
      // শিক্ষার্থীর নিজের উপস্থিতি: শুধু শেষ ১০০ দিন (প্রয়োজন: studentId + date ইনডেক্স; না থাকলে নিজে ফিরে যায়)
      { re: /^where:studentId,==,[^|]+$/,
        to: ops => [ops[0], { m: 'where', a: ['date', '>=', ymdDaysAgo(100)] }] }
    ],
    notices: [
      { re: /^where:madrasaId,==,[^|]+\|orderBy:createdAt,desc$/,
        to: ops => ops.concat([{ m: 'limit', a: [50] }]) }
    ],
    diary: [
      // শুধু শিক্ষার্থীর পাশের কোয়েরি (শ্রেণি দিয়ে ছাঁকা)। শিক্ষকের তালিকা অপরিবর্তিত।
      { re: /^where:madrasaId,==,[^|]+\|where:className,==,[^|]+\|orderBy:createdAt,desc$/,
        to: ops => ops.concat([{ m: 'limit', a: [50] }]) }
    ],
    homework: [
      { re: /^where:madrasaId,==,[^|]+\|where:className,==,[^|]+\|orderBy:createdAt,desc$/,
        to: ops => ops.concat([{ m: 'limit', a: [50] }]) }
    ]
  };

  function rewrite(name, ops) {
    const rules = RULES[name];
    if (!rules) return null;
    const s = sig(ops);
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].re.test(s)) {
        try { return rules[i].to(ops); } catch (e) { return null; }
      }
    }
    return null;
  }

  function makeQuery(name, ops) {
    let q = origCollection(name);
    ops.forEach(o => { q = q[o.m].apply(q, o.a); });
    return q;
  }

  // ---------------------------------------------------------------
  // আগের দিনের হাজিরার ক্যাশ (শুধু attendance: madrasaId + date == আগের তারিখ)
  // ---------------------------------------------------------------
  const CACHE_PREFIX = 'rc:att:';
  const CACHE_TTL = 30 * 60 * 1000;
  const CACHE_MAX_KEYS = 45;
  const ATT_DAY_RE = /^where:madrasaId,==,([^|]+)\|where:date,==,(\d{4}-\d{2}-\d{2})$/;
  let cacheOn = false;

  function cacheKeyFor(name, ops) {
    if (!cacheOn || name !== 'attendance') return null;
    const m = ATT_DAY_RE.exec(sig(ops));
    if (!m) return null;
    if (m[2] >= todayStr()) return null; // আজ ও ভবিষ্যৎ কখনো জমা রাখা হয় না
    return CACHE_PREFIX + m[1] + '|' + m[2];
  }

  function cacheRead(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const e = JSON.parse(raw);
      if (!e || !Array.isArray(e.docs) || Date.now() - e.t > CACHE_TTL) { localStorage.removeItem(key); return null; }
      return e;
    } catch (err) { return null; }
  }

  function cacheWrite(key, snap) {
    try {
      const docs = snap.docs.map(d => ({ id: d.id, d: d.data() }));
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), docs }));
      const keys = Object.keys(localStorage).filter(k => k.indexOf(CACHE_PREFIX) === 0);
      if (keys.length > CACHE_MAX_KEYS) {
        keys.map(k => { let t = 0; try { t = JSON.parse(localStorage.getItem(k)).t || 0; } catch (e) { /* ignore */ } return { k, t }; })
          .sort((a, b) => a.t - b.t)
          .slice(0, keys.length - CACHE_MAX_KEYS)
          .forEach(x => localStorage.removeItem(x.k));
      }
    } catch (err) { /* জায়গা ফুরালে বা ব্লক হলে ক্যাশ ছাড়াই চলবে */ }
  }

  function clearAttCache() {
    try {
      Object.keys(localStorage).forEach(k => { if (k.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(k); });
    } catch (err) { /* ignore */ }
  }

  function fakeSnap(entry) {
    const docs = entry.docs.map(x => ({ id: x.id, exists: true, data: () => x.d, get: f => x.d[f] }));
    return {
      docs, empty: docs.length === 0, size: docs.length,
      forEach: fn => docs.forEach(fn),
      docChanges: () => [],
      metadata: { fromCache: true, hasPendingWrites: false }
    };
  }

  // এই ডিভাইসে হাজিরায় কিছু লেখা হলেই ক্যাশ মুছে ফেলা (যাতে নিজের সংশোধন সাথে সাথে রিপোর্টে দেখা যায়)
  function installWriteHooks() {
    try {
      const F = firebase.firestore;
      const DR = F.DocumentReference.prototype;
      const WB = F.WriteBatch.prototype;
      const CR = F.CollectionReference.prototype;
      const isAtt = p => typeof p === 'string' && p.indexOf('attendance') === 0;
      ['set', 'update', 'delete'].forEach(m => {
        const o = DR[m];
        if (typeof o !== 'function') throw new Error('no DocumentReference.' + m);
        DR[m] = function () { if (isAtt(this && this.path)) clearAttCache(); return o.apply(this, arguments); };
        const b = WB[m];
        if (typeof b !== 'function') throw new Error('no WriteBatch.' + m);
        WB[m] = function (ref) { if (ref && isAtt(ref.path)) { this.__rcAtt = true; clearAttCache(); } return b.apply(this, arguments); };
      });
      const oc = WB.commit;
      if (typeof oc !== 'function') throw new Error('no WriteBatch.commit');
      WB.commit = function () {
        const flagged = this.__rcAtt;
        const p = oc.apply(this, arguments);
        if (flagged && p && typeof p.then === 'function') p.then(clearAttCache, clearAttCache);
        return p;
      };
      const oa = CR.add;
      if (typeof oa === 'function') {
        CR.add = function () { if (isAtt(this && this.path)) clearAttCache(); return oa.apply(this, arguments); };
      }
      return true;
    } catch (err) {
      console.warn('[reads-cut] হাজিরা ক্যাশ বন্ধ (লেখার হুক বসানো যায়নি):', err && err.message);
      return false;
    }
  }
  cacheOn = installWriteHooks();

  // ---------------------------------------------------------------
  // onSnapshot / get
  // ---------------------------------------------------------------
  function runSnapshot(name, ops, args) {
    const alt = rewrite(name, ops);
    if (!alt || typeof args[0] !== 'function') return makeQuery(name, ops).onSnapshot.apply(makeQuery(name, ops), args);

    const next = args[0], errCb = args[1];
    let unsub = null, stopped = false;
    const start = (useOps, onErr) => makeQuery(name, useOps).onSnapshot(next, onErr);

    unsub = start(alt, e => {
      if (stopped) return;
      if (e && e.code === 'failed-precondition') {
        // নতুন কোয়েরির ইনডেক্স এখনো নেই → আগের কোয়েরিতে ফিরে যাওয়া, যাতে সেবা না থামে
        try { unsub(); } catch (x) { /* ignore */ }
        console.warn('[reads-cut] ইনডেক্স দরকার, আগের কোয়েরিতে ফিরে গেছি (' + name + '):', e.message);
        if (typeof showDiagBanner === 'function') showDiagBanner('রিড-কমানো (' + name + ') এর জন্য ইনডেক্স দরকার: ' + e.message);
        unsub = start(ops, errCb);
      } else if (typeof errCb === 'function') {
        errCb(e);
      }
    });
    return function () { stopped = true; try { unsub(); } catch (x) { /* ignore */ } };
  }

  function runGet(name, ops, args) {
    const key = cacheKeyFor(name, ops);
    const q = makeQuery(name, ops);
    if (!key) return q.get.apply(q, args);
    const hit = cacheRead(key);
    if (hit) return Promise.resolve(fakeSnap(hit));
    return q.get.apply(q, args).then(snap => { cacheWrite(key, snap); return snap; });
  }

  function wrapChain(name, ops) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'where' || prop === 'orderBy' || prop === 'limit') {
          return function () { return wrapChain(name, ops.concat([{ m: prop, a: Array.prototype.slice.call(arguments) }])); };
        }
        if (prop === 'onSnapshot') return function () { return runSnapshot(name, ops, Array.prototype.slice.call(arguments)); };
        if (prop === 'get') return function () { return runGet(name, ops, Array.prototype.slice.call(arguments)); };
        const q = makeQuery(name, ops);
        const v = q[prop];
        return typeof v === 'function' ? v.bind(q) : v;
      }
    });
  }

  db.collection = function (name) {
    const col = origCollection(name);
    if (!HOT[name]) return col;
    try {
      return new Proxy(col, {
        get(target, prop) {
          if (prop === 'where' || prop === 'orderBy' || prop === 'limit') {
            return function () { return wrapChain(name, [{ m: prop, a: Array.prototype.slice.call(arguments) }]); };
          }
          const v = target[prop];
          return typeof v === 'function' ? v.bind(target) : v;
        }
      });
    } catch (e) {
      return col;
    }
  };

  // হোমের ↻ বাটনে চাপলে ক্যাশও মুছে যায়
  const prevRefresh = window.dashRefresh;
  window.dashRefresh = function () {
    clearAttCache();
    if (typeof prevRefresh === 'function') return prevRefresh.apply(this, arguments);
  };
})();
