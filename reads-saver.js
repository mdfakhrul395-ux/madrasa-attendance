/* ShikkhaOS — Firestore রিড কমানোর প্যাচ (অ্যাপের কাজ বা চেহারা একটুও বদলায় না)
 * index.html এ সবার শেষে লোড হবে। app.js ও dashboard.js বদলাতে হয় না।
 * বন্ধ করতে: index.html থেকে এই ফাইলের লাইনটি মুছে দিলেই আগের অবস্থা।
 *
 * ১) একই কোয়েরির লাইভ লিসেনার শেয়ার: ট্যাব বদলে ফিরলে বা পাতা আবার খুললে সব ডেটা নতুন করে পড়া হয় না।
 *    (আগে রেজাল্ট, ছুটি, নোটিশ, ডায়েরী ইত্যাদি পাতা প্রতিবার খুললে আগের লিসেনার না থামিয়ে নতুন একটি যোগ করত।)
 *    ছেড়ে গেলেও ১০ মিনিট লিসেনার জীবিত থাকে, তাই ফিরে এলে ০ রিড।
 * ২) শিক্ষক: হাজিরা ও মাসিক বেতনের প্রতিটি ছাত্রের আলাদা রিড বদলে পুরো দিন/মাসের একটি কোয়েরি
 *    (হাজিরা: আজ ১৫ সেকেন্ড, পুরনো দিন ৫ মিনিট; অতীত দিন ফোনে ১ ঘণ্টা মনে রাখে)।
 *    নিজের লেখা সাথে সাথে ক্যাশে বসে যায়।
 * ৩) শিক্ষার্থী: নিজের হাজিরার পুরো ইতিহাসের বদলে সর্বশেষ ৬২টি রেকর্ড (এক মাসের ক্যালেন্ডার ও তালিকার জন্য যথেষ্ট)।
 */
(function () {
  'use strict';
  try { if (localStorage.getItem('readsSaverOff') === '1') return; } catch (e) { /* ignore */ }
  if (typeof db === 'undefined' || typeof firebase === 'undefined' || !firebase.firestore || typeof auth === 'undefined') {
    console.error('[reads-saver] app.js এর পরে লোড করুন');
    return;
  }

  const GRACE_MS = 10 * 60 * 1000;
  const PERSIST_TTL = 1 * 3600 * 1000;
  const STU_LIMIT = 62;
  const stats = { listenersShared: 0, sliceHits: 0, sliceFetches: 0 };
  window.readsSaverStats = () => Object.assign({ activeListeners: Object.keys(shared).length }, stats);

  const todayStr = () => (typeof todayLocal === 'function' ? todayLocal() : new Date().toISOString().slice(0, 10));
  const curMadrasa = () => (typeof madrasaId !== 'undefined' ? madrasaId : null);
  const curUid = () => (auth.currentUser ? auth.currentUser.uid : 'anon');
  const isTeacher = () => {
    try { return typeof role !== 'undefined' && role === 'teacher' && auth.currentUser && auth.currentUser.providerData.length > 0; }
    catch (e) { return false; }
  };

  // ---------- ক্যাশের ধরন ----------
  const SLICES = {
    attendance:   { field: 'date',  re: /^(.+)_(\d{4}-\d{2}-\d{2})$/, valRe: /^\d{4}-\d{2}-\d{2}$/, ttl: s => (s >= todayStr() ? 15000 : 5 * 60000), persist: s => s < todayStr() },
    fees_monthly: { field: 'month', re: /^(.+)_(\d{4}-\d{2})$/,       valRe: /^\d{4}-\d{2}$/,       ttl: () => 30000, persist: () => false }
  };
  const slices = {};
  const skey = (c, m, s) => c + '|' + m + '|' + s;
  const PK = (c, m, s) => 'rs_' + c + '_' + m + '_' + s;

  function loadPersist(c, m, s) {
    try {
      const j = JSON.parse(localStorage.getItem(PK(c, m, s)) || 'null');
      if (j && j.map && Date.now() - j.ts < PERSIST_TTL) return { ts: Date.now(), map: j.map, p: null, gen: 0 };
    } catch (e) { /* ignore */ }
    return null;
  }
  function savePersist(c, m, s, map) {
    try {
      localStorage.setItem(PK(c, m, s), JSON.stringify({ ts: Date.now(), map }));
      const ks = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('rs_attendance_') === 0) ks.push(k); }
      if (ks.length > 45) { ks.sort(); ks.slice(0, ks.length - 45).forEach(k => localStorage.removeItem(k)); }
    } catch (e) { /* কোটা ভরে গেলে চুপচাপ বাদ */ }
  }
  function dropSlice(c, m, s) {
    delete slices[skey(c, m, s)];
    try { localStorage.removeItem(PK(c, m, s)); } catch (e) { /* ignore */ }
  }
  function clearAllSlices() {
    Object.keys(slices).forEach(k => { delete slices[k]; });
    try {
      const del = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.indexOf('rs_attendance_') === 0 || k.indexOf('rs_fees_monthly_') === 0)) del.push(k);
      }
      del.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }

  const realCollection = db.collection.bind(db);

  function fetchSlice(c, m, s, force) {
    const cfg = SLICES[c], k = skey(c, m, s);
    let e = slices[k];
    if (!force && e && e.map && Date.now() - e.ts < cfg.ttl(s)) { stats.sliceHits++; return Promise.resolve(e); }
    if (e && e.p) return e.p;
    if (!force && cfg.persist(s)) {
      const pe = loadPersist(c, m, s);
      if (pe) { slices[k] = pe; stats.sliceHits++; return Promise.resolve(pe); }
    }
    if (!e) e = slices[k] = { ts: 0, map: null, p: null, gen: 0 };
    const gen0 = e.gen;
    stats.sliceFetches++;
    e.p = realCollection(c).where('madrasaId', '==', m).where(cfg.field, '==', s).get().then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      e.map = map;
      e.ts = (e.gen === gen0) ? Date.now() : 0; // ফেচ চলাকালে লেখা হলে এটি আর তাজা ধরা হবে না
      e.p = null;
      if (e.gen === gen0 && cfg.persist(s)) savePersist(c, m, s, map);
      return e;
    }).catch(err => { e.p = null; throw err; });
    return e.p;
  }

  const fakeDoc = (id, data, ref) => ({ id, exists: true, ref, data: () => Object.assign({}, data), get: f => data[f], metadata: { fromCache: false, hasPendingWrites: false } });
  const fakeMissing = (id, ref) => ({ id, exists: false, ref, data: () => undefined, get: () => undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  function fakeSnap(entry) {
    const docs = Object.keys(entry.map).map(id => fakeDoc(id, entry.map[id], null));
    return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn), metadata: { fromCache: false, hasPendingWrites: false } };
  }

  // ---------- একটি ডকুমেন্টের get() (শিক্ষক) ----------
  try {
    const DR = firebase.firestore.DocumentReference.prototype;
    const oGet = DR.get;
    DR.get = function () {
      try {
        const col = this.parent && this.parent.id;
        const cfg = SLICES[col];
        if (cfg && isTeacher() && (arguments.length === 0 || arguments[0] == null) && curMadrasa()) {
          const mm = cfg.re.exec(this.id);
          if (mm) {
            const self = this, args = arguments;
            return fetchSlice(col, curMadrasa(), mm[2], false)
              .then(e => (e.map[self.id] ? fakeDoc(self.id, e.map[self.id], self) : fakeMissing(self.id, self)))
              .catch(() => oGet.apply(self, args));
          }
        }
      } catch (x) { /* সাধারণ পথে ফিরে যাও */ }
      return oGet.apply(this, arguments);
    };

    // ---------- নিজের লেখা সাথে সাথে ক্যাশে ----------
    const hasSentinel = d => !!d && typeof d === 'object' && Object.keys(d).some(k => { const v = d[k]; return v && typeof v === 'object' && !Array.isArray(v); });
    function applyWrite(ref, kind, data, opts) {
      try {
        const c = ref.parent && ref.parent.id, cfg = SLICES[c];
        if (!cfg) return;
        const mm = cfg.re.exec(ref.id);
        const m = curMadrasa();
        if (!mm || !m) return;
        const s = mm[2], e = slices[skey(c, m, s)];
        if (!e) return;
        e.gen++;
        if (!e.map) return;
        if (kind === 'set') {
          if (hasSentinel(data)) return dropSlice(c, m, s);
          e.map[ref.id] = (opts && opts.merge) ? Object.assign({}, e.map[ref.id] || {}, data) : Object.assign({}, data);
        } else if (kind === 'delete') {
          delete e.map[ref.id];
        } else {
          return dropSlice(c, m, s);
        }
        if (cfg.persist(s)) savePersist(c, m, s, e.map);
      } catch (x) { clearAllSlices(); }
    }
    const track = (p, ref, kind, data, opts) => {
      if (p && typeof p.then === 'function' && ref && ref.parent && SLICES[ref.parent.id]) p.then(() => applyWrite(ref, kind, data, opts)).catch(() => {});
      return p;
    };
    const oSet = DR.set;
    DR.set = function (data, opts) { return track(oSet.apply(this, arguments), this, 'set', data, opts); };
    const oUpd = DR.update;
    DR.update = function () { return track(oUpd.apply(this, arguments), this, 'update'); };
    const oDel = DR.delete;
    DR.delete = function () { return track(oDel.apply(this, arguments), this, 'delete'); };

    const WB = firebase.firestore.WriteBatch.prototype;
    ['set', 'update', 'delete'].forEach(kind => {
      const o = WB[kind];
      WB[kind] = function (ref, data, opts) {
        (this.__rsOps = this.__rsOps || []).push([ref, kind, data, opts]);
        return o.apply(this, arguments);
      };
    });
    const oCommit = WB.commit;
    WB.commit = function () {
      const ops = this.__rsOps; this.__rsOps = null;
      const p = oCommit.apply(this, arguments);
      if (ops && p && typeof p.then === 'function') p.then(() => ops.forEach(o => applyWrite(o[0], o[1], o[2], o[3]))).catch(() => {});
      return p;
    };
  } catch (e) {
    console.error('[reads-saver] ডকুমেন্ট-ক্যাশ বসানো যায়নি', e);
  }

  // ---------- শেয়ার করা লাইভ লিসেনার ----------
  const shared = {};

  function keyOf(desc) {
    for (let i = 0; i < desc.parts.length; i++) {
      const p = desc.parts[i];
      for (let j = 1; j < p.length; j++) {
        const t = typeof p[j];
        if (!(p[j] == null || t === 'string' || t === 'number' || t === 'boolean')) return null;
      }
    }
    return curUid() + '|' + desc.col + '|' + JSON.stringify(desc.parts);
  }

  function kill(key) {
    const e = shared[key];
    if (!e) return;
    delete shared[key];
    if (e.timer) clearTimeout(e.timer);
    try { if (e.unsub) e.unsub(); } catch (x) { /* ignore */ }
  }

  function isStudentAttQuery(desc) {
    return desc.col === 'attendance' && desc.parts.length === 1 && desc.parts[0][0] === 'w' &&
      desc.parts[0][1] === 'studentId' && desc.parts[0][2] === '==' &&
      typeof role !== 'undefined' && role === 'student';
  }

  function startReal(e, key, real, desc) {
    const emit = snap => {
      e.last = snap;
      Array.from(e.subs.values()).forEach(s => { try { s.next(snap); } catch (x) { console.error(x); } });
    };
    const fail = error => {
      if (shared[key] === e) delete shared[key];
      Array.from(e.subs.values()).forEach(s => { if (s.err) { try { s.err(error); } catch (x) { console.error(x); } } });
    };
    if (isStudentAttQuery(desc)) {
      let limited = null;
      try { limited = real.orderBy(firebase.firestore.FieldPath.documentId(), 'desc').limit(STU_LIMIT); } catch (x) { limited = null; }
      if (limited) {
        e.unsub = limited.onSnapshot(emit, error => {
          if (error && (error.code === 'failed-precondition' || error.code === 'invalid-argument')) {
            console.warn('[reads-saver] সীমিত কোয়েরি চলেনি, আগের নিয়মে ফিরে যাচ্ছি', error.code);
            e.unsub = real.onSnapshot(emit, fail);
          } else fail(error);
        });
        return;
      }
    }
    e.unsub = real.onSnapshot(emit, fail);
  }

  function sharedSnapshot(real, desc, args) {
    const next = typeof args[0] === 'function' ? args[0] : null;
    const key = next ? keyOf(desc) : null;
    if (!key) return real.onSnapshot.apply(real, args);
    const err = typeof args[1] === 'function' ? args[1] : null;
    let e = shared[key];
    if (!e) {
      e = shared[key] = { subs: new Map(), last: null, timer: null, unsub: null, uid: curUid() };
      startReal(e, key, real, desc);
    } else stats.listenersShared++;
    if (e.timer) { clearTimeout(e.timer); e.timer = null; }
    const sig = Function.prototype.toString.call(next);
    Array.from(e.subs.entries()).forEach(en => { if (en[1].sig === sig) e.subs.delete(en[0]); }); // একই জায়গার পুরনো (মৃত) সাবস্ক্রাইবার বাদ
    const token = {};
    e.subs.set(token, { next, err, sig });
    if (e.last) {
      const snap = e.last;
      setTimeout(() => { if (e.subs.has(token)) { try { next(snap); } catch (x) { console.error(x); } } }, 0);
    }
    return function () {
      e.subs.delete(token);
      if (shared[key] === e && e.subs.size === 0 && !e.timer) {
        e.timer = setTimeout(() => { if (e.subs.size === 0) kill(key); }, GRACE_MS);
      }
    };
  }

  // লগইন বদলালে (অন্য ব্যবহারকারী) আগের ব্যবহারকারীর লিসেনার বন্ধ
  try {
    auth.onAuthStateChanged(() => {
      const uid = curUid();
      Object.keys(shared).forEach(k => { if (shared[k].uid !== uid) kill(k); });
    });
  } catch (e) { /* ignore */ }

  // ---------- কোয়েরি প্রক্সি ----------
  function sliceQueryInfo(desc) {
    const cfg = SLICES[desc.col];
    if (!cfg || desc.parts.length !== 2) return null;
    let m = null, s = null;
    desc.parts.forEach(p => {
      if (p[0] !== 'w' || p[2] !== '==') return;
      if (p[1] === 'madrasaId') m = p[3];
      else if (p[1] === cfg.field && typeof p[3] === 'string' && cfg.valRe.test(p[3])) s = p[3];
    });
    return (m && s && m === curMadrasa()) ? { c: desc.col, m, s } : null;
  }

  function wrap(real, desc) {
    return new Proxy(real, {
      get(target, prop) {
        if (prop === 'where') return (...a) => wrap(target.where(...a), { col: desc.col, parts: desc.parts.concat([['w'].concat(a)]) });
        if (prop === 'orderBy') return (...a) => wrap(target.orderBy(...a), { col: desc.col, parts: desc.parts.concat([['o'].concat(a)]) });
        if (prop === 'limit') return (...a) => wrap(target.limit(...a), { col: desc.col, parts: desc.parts.concat([['l'].concat(a)]) });
        if (prop === 'onSnapshot') return (...a) => sharedSnapshot(target, desc, a);
        if (prop === 'get') {
          return (...a) => {
            const info = isTeacher() && a.length === 0 ? sliceQueryInfo(desc) : null;
            if (!info) return target.get(...a);
            const force = !!document.getElementById('tlWrap'); // "বের হওয়ার সময়" পাতায় সবসময় তাজা তথ্য
            return fetchSlice(info.c, info.m, info.s, force).then(fakeSnap).catch(() => target.get());
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
  }

  db.collection = function (name) {
    return wrap(realCollection(name), { col: name, parts: [] });
  };

  // ---------- নির্দিষ্ট কাজের আগে তাজা তথ্য নিশ্চিত ----------
  const oMark = window.markAllPresent;
  if (typeof oMark === 'function') {
    window.markAllPresent = function () {
      const el = document.getElementById('attDate');
      const m = curMadrasa();
      if (el && el.value && m) dropSlice('attendance', m, el.value); // কাকে উপস্থিত করা হবে সেই হিসাব সবসময় তাজা তথ্যে
      return oMark.apply(this, arguments);
    };
  }
  const oRefresh = window.dashRefresh;
  if (typeof oRefresh === 'function') {
    window.dashRefresh = function () { clearAllSlices(); return oRefresh.apply(this, arguments); };
  }
})();
