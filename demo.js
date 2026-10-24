/* ShikkhaOS — ডেমো মাদ্রাসা (ধাপ ১)
 *
 * index.html এ সবার শেষে (fees-quick.js এর নিচে) যোগ করুন:
 *   <script defer src="demo.js"></script>
 *
 * app.js, dashboard.js ও firestore.rules একটুও বদলাতে হয় না।
 *
 * কীভাবে কাজ করে:
 *  - "আপনি কে?" পাতায় "🎬 ডেমো দেখুন" বাটন আসে।
 *  - ডেমোর নিজস্ব মাদ্রাসা-আইডি: m_demo_school (আপনার আসল মাদ্রাসার ডেটার সাথে মেশে না)।
 *  - প্রথমবার "শিক্ষক হিসেবে" চাপলে ডেমো শিক্ষক অ্যাকাউন্ট ও নকল ডেটা নিজে তৈরি হয় (প্রায় ১৫-২০ সেকেন্ড)।
 *    এটা বিদ্যমান "নতুন মাদ্রাসা নিবন্ধন" নিয়মেই হয়, তাই নতুন rule লাগে না।
 *  - "শিক্ষার্থী হিসেবে" ডেমো শিক্ষার্থীর আসল PIN-লগইনের নিয়মেই ঢোকে।
 *  - ডেমো থেকে বের হলে (বা ট্যাব বন্ধ করলে) ফোনের আগের মাদ্রাসা/রোল/লগইন-অবস্থা ফিরে আসে।
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof setScreen !== 'function') {
    console.error('[demo] app.js এর পরে demo.js লোড করুন');
    return;
  }

  const DEMO_ID = 'm_demo_school';
  const DEMO_NAME = 'দারুল ইলম ডেমো মাদ্রাসা';
  const EMAIL = 'demo@shikkhaos.app';
  const PASS = 'ShikkhaDemo#2026';
  const PIN = '1234';
  const STUDENT_ID = 'demo_s01';
  const STUDENT_NAME = 'মুহাম্মাদ আব্দুল্লাহ';

  // ---------- সহায়ক ----------
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del: k => { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const inDemo = () => ss.get('demoSession') === '1';
  const bn = n => toBanglaNumeral(n);
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayOff = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- ফোনের আগের অবস্থা সংরক্ষণ / পুনরুদ্ধার ----------
  const KEYS = ['madrasaId', 'role', 'myStudentId', 'nonAdminTeacherDevice'];
  function savePrev() {
    if (ls.get('demoPrev')) return;
    const p = {};
    KEYS.forEach(k => { p[k] = ls.get(k); });
    ls.set('demoPrev', JSON.stringify(p));
  }
  function restorePrev() {
    const raw = ls.get('demoPrev');
    if (!raw) return;
    let p = {};
    try { p = JSON.parse(raw) || {}; } catch (e) { /* ignore */ }
    KEYS.forEach(k => { if (p[k] === null || p[k] === undefined) ls.del(k); else ls.set(k, p[k]); });
    ls.del('demoPrev');
  }

  // আগের ডেমো ঠিকমতো বন্ধ না হয়ে থাকলে (ট্যাব বন্ধ করা হয়েছিল) আগের অবস্থা ফিরিয়ে আনা
  if (ls.get('demoPrev') && !inDemo()) {
    const done = () => { restorePrev(); location.reload(); };
    auth.signOut().then(done, done);
  }

  // ---------- ডেমো লিংক: শুধু ?demo=1 দিয়ে খুললে ডেমো বাটন দেখা যায় ----------
  let autoOpenUntil = 0;
  (function readDemoLink() {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('demo') !== '1') return;
      ls.set('demoLinkOk', '1');             // এই ফোনে বাটন থেকে যাবে
      autoOpenUntil = Date.now() + 8000;     // এখন সরাসরি ডেমোর পাতা খুলবে
      params.delete('demo');
      const qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (e) { /* ignore */ }
  })();

  // ---------- স্ক্রিন ----------
  let lastKind = 'teacher';

  function demoLoading(msg) {
    setScreen('<div class="card" style="margin-top:60px;text-align:center;"><h2>🎬 ডেমো</h2><p id="demoProg" class="muted">' + esc(msg) + '</p></div>');
    if (typeof hideNav === 'function') hideNav();
  }
  function prog(msg) { const e = document.getElementById('demoProg'); if (e) e.textContent = msg; }

  function fail(e) {
    console.error('[demo]', e);
    const msg = (e && (e.message || e.code)) || String(e);
    setScreen('<div class="card" style="margin-top:40px;"><h2>ডেমো চালু করা যায়নি</h2>'
      + '<p class="muted" style="color:#dc2626;">' + esc(msg) + '</p>'
      + '<button onclick="demoRetry()">আবার চেষ্টা করুন</button>'
      + '<button class="secondary" onclick="demoExit()" style="margin-top:8px;">ফিরে যান</button></div>');
    if (typeof hideNav === 'function') hideNav();
  }

  window.showDemoChoice = function () {
    setScreen('<div class="card" style="margin-top:40px;text-align:center;"><h2>🎬 ShikkhaOS ডেমো</h2>'
      + '<p class="muted">নকল তথ্য দিয়ে সাজানো একটি মাদ্রাসা। যা খুশি দেখুন, আপনার আসল তথ্যে কোনো প্রভাব পড়বে না।</p>'
      + '<button onclick="demoEnter(\'teacher\')">👨‍🏫 শিক্ষক হিসেবে দেখুন</button>'
      + '<button class="secondary" onclick="demoEnter(\'student\')" style="margin-top:8px;">🎓 শিক্ষার্থী হিসেবে দেখুন</button>'
      + '<button class="secondary" onclick="showRoleSelect()" style="margin-top:8px;">ফিরে যান</button></div>');
    if (typeof hideNav === 'function') hideNav();
  };

  // ---------- ডেমো বার ----------
  function showDemoBar(kind) {
    ss.set('demoKind', kind);
    let bar = document.getElementById('demoBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demoBar';
      bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:#fff7e0;border-bottom:1px solid #f0d58a;font-size:12.5px;color:#8a5a00;position:sticky;top:0;z-index:60;';
      const app = document.getElementById('app');
      app.parentNode.insertBefore(bar, app);
    }
    const b = 'width:auto;margin:0;padding:5px 10px;font-size:12px;';
    bar.innerHTML = '<b style="flex:1;">🎬 ডেমো মোড (নকল তথ্য)</b>'
      + (kind === 'teacher' ? '<button class="small secondary" style="' + b + '" onclick="demoRefresh()">🔄 রিসেট</button>' : '')
      + '<button class="small" style="' + b + '" onclick="demoExit()">বের হোন</button>';
  }
  if (inDemo()) showDemoBar(ss.get('demoKind') || 'teacher');

  // ---------- প্রবেশ ----------
  function stopAll() {
    try { stopStudentContactsListener(); } catch (e) { /* ignore */ }
    try { stopTeachersListener(); } catch (e) { /* ignore */ }
    try { stopMadrasasListener(); } catch (e) { /* ignore */ }
    try { stopUnreadListeners(); } catch (e) { /* ignore */ }
  }

  window.demoEnter = function (kind) {
    lastKind = kind;
    if (kind === 'student') enterStudent(); else enterTeacher();
  };
  window.demoRetry = function () { window.demoEnter(lastKind); };

  async function teacherSignIn() {
    try {
      return (await auth.signInWithEmailAndPassword(EMAIL, PASS)).user;
    } catch (e) {
      const missing = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'];
      if (missing.indexOf(e.code) === -1) throw e;
      try {
        return (await auth.createUserWithEmailAndPassword(EMAIL, PASS)).user;
      } catch (e2) {
        if (e2.code === 'auth/email-already-in-use') throw new Error('ডেমো অ্যাকাউন্টের পাসওয়ার্ড মেলেনি');
        throw e2;
      }
    }
  }

  // ডেমো শিক্ষক-ডক, মাদ্রাসা-ডক ও নকল ডেটা তৈরি (যা নেই শুধু তাই)
  async function ensureDemoReady(user) {
    const tRef = db.collection('teachers').doc(user.uid);
    const t = await tRef.get();
    if (!t.exists) {
      prog('ডেমো অ্যাকাউন্ট তৈরি হচ্ছে...');
      await tRef.set({ madrasaId: DEMO_ID, email: EMAIL, name: 'ডেমো অ্যাডমিন', isAdmin: true, active: true, createdAt: Date.now() });
    }
    const mRef = db.collection('madrasas').doc(DEMO_ID);
    const m = await mRef.get();
    if (!m.exists) {
      await mRef.set({ madrasaName: DEMO_NAME, isDemo: true, weeklyOff: [5], createdAt: Date.now() });
    }
    const seededOn = m.exists ? m.data().demoSeededOn : null;
    if (seededOn !== todayLocal()) {
      prog('ডেমো আজকের তারিখ অনুযায়ী সাজানো হচ্ছে...');
      await seedAll();
    }
  }

  async function enterTeacher() {
    demoLoading('ডেমো প্রস্তুত হচ্ছে...');
    savePrev();
    ss.set('demoSession', '1');
    ls.set('madrasaId', DEMO_ID); ls.set('role', 'teacher'); ls.del('myStudentId');
    madrasaId = DEMO_ID; role = 'teacher'; myStudentId = null;
    signupInProgress = true;
    try {
      stopAll();
      const user = await teacherSignIn();
      lockUser(user);
      await ensureDemoReady(user);
      await ensureTeacherDoc(user);
      signupInProgress = false;
      listenStudents(); listenSettings(); listenStudentContacts();
      showDemoBar('teacher');
      showTeacherApp();
    } catch (e) {
      signupInProgress = false;
      fail(e);
    }
  }

  async function enterStudent() {
    demoLoading('শিক্ষার্থী ডেমো প্রস্তুত হচ্ছে...');
    savePrev();
    ss.set('demoSession', '1');
    signupInProgress = true;
    try {
      stopAll();
      let u = auth.currentUser;
      if (!u || u.providerData.length > 0) {
        if (u) await auth.signOut();
        u = (await auth.signInAnonymously()).user;
      }
      const m = await db.collection('madrasas').doc(DEMO_ID).get();
      if (!m.exists || !m.data().demoSeededOn) throw new Error('ডেমো এখনো তৈরি হয়নি। আগে একবার "শিক্ষক হিসেবে দেখুন" চালান।');
      await db.collection('sessions').doc(u.uid).set({
        studentId: STUDENT_ID, madrasaId: DEMO_ID, name: STUDENT_NAME, pin: PIN, updatedAt: Date.now()
      }, { merge: true });
      ls.set('madrasaId', DEMO_ID); ls.set('role', 'student'); ls.set('myStudentId', STUDENT_ID);
      madrasaId = DEMO_ID; role = 'student'; myStudentId = STUDENT_ID;
      signupInProgress = false;
      listenStudents(); listenSettings();
      showDemoBar('student');
      showStudentApp();
    } catch (e) {
      signupInProgress = false;
      fail(e);
    }
  }

  window.demoExit = function () {
    ss.del('demoSession'); ss.del('demoKind');
    stopAll();
    const bar = document.getElementById('demoBar');
    if (bar) bar.remove();
    const done = () => { restorePrev(); location.reload(); };
    auth.signOut().then(done, done);
  };

  async function delAll(refs, label) {
    for (let i = 0; i < refs.length; i += 8) {
      const b = db.batch();
      refs.slice(i, i + 8).forEach(r => b.delete(r));
      await b.commit();
      prog(label + ' মোছা হচ্ছে ' + bn(Math.min(i + 8, refs.length)) + '/' + bn(refs.length));
    }
  }

  // ডেমো মাদ্রাসার সব তথ্য মোছা (শিক্ষার্থী সবার শেষে, কারণ rule শিক্ষার্থী-ডক দেখে PIN/রেজাল্ট মুছতে দেয়)
  async function wipeDemo() {
    const q = n => db.collection(n).where('madrasaId', '==', DEMO_ID).get();
    const cols = ['attendance', 'leaves', 'results', 'fees_monthly', 'fees_onetime', 'notices', 'diary', 'homework', 'examRoutines', 'student_contacts'];
    for (const n of cols) {
      const snap = await q(n);
      await delAll(snap.docs.map(d => d.ref), n);
    }
    const st = await q('students');
    await delAll(st.docs.map(d => db.collection('student_pins').doc(d.id)), 'PIN');
    await delAll(st.docs.map(d => d.ref), 'শিক্ষার্থী');
  }

  window.demoRefresh = async function () {
    if (!confirm('ডেমোর সব তথ্য (সবার করা পরিবর্তনসহ) মুছে নতুন করে সাজানো হবে। এগিয়ে যাবেন?')) return;
    demoLoading('ডেমো রিসেট হচ্ছে...');
    try {
      await wipeDemo();
      await seedAll();
      teacherTab('home');
    } catch (e) { fail(e); }
  };

  // ---------- নকল ডেটা ----------
  const CLASSES = [
    { name: 'প্রথম শ্রেণি', fee: 500, list: ['মুহাম্মাদ আব্দুল্লাহ', 'আব্দুর রহমান', 'ইব্রাহীম খলীল', 'উমার ফারুক', 'ইউসুফ আলী', 'হামযা আহমাদ', 'সালমান ফারেসী', 'বিলাল হোসাইন'] },
    { name: 'দ্বিতীয় শ্রেণি', fee: 600, list: ['ইসমাঈল হোসেন', 'ইদরীস আহমাদ', 'আনাস মাহমুদ', 'তালহা জুবায়ের', 'রাফি আহমাদ', 'নাঈম হাসান', 'ফাহিম তামীম', 'আরিফ বিল্লাহ'] }
  ];
  const ABILITY = [0.9, 0.78, 0.7, 0.84, 0.6, 0.74, 0.66, 0.8, 0.88, 0.72, 0.64, 0.8, 0.58, 0.76, 0.7, 0.82];
  const ABS_RATE = [0.05, 0.1, 0.15, 0.05, 0.2, 0.08, 0.12, 0.06];

  function buildStudents() {
    const out = [];
    CLASSES.forEach(c => {
      c.list.forEach((name, j) => {
        const idx = out.length;
        out.push({ idx, id: 'demo_s' + pad(idx + 1), name, roll: String(j + 1), className: c.name, fee: c.fee, ability: ABILITY[idx], absRate: ABS_RATE[idx % 8] });
      });
    });
    return out;
  }

  async function write(ops, label) {
    for (let i = 0; i < ops.length; i += 8) {
      const b = db.batch();
      ops.slice(i, i + 8).forEach(o => b.set(o.ref, o.data, { merge: true }));
      await b.commit();
      prog(label + ' ' + bn(Math.min(i + 8, ops.length)) + '/' + bn(ops.length));
    }
  }

  async function seedAll() {
    const now = Date.now(), today = todayLocal(), year = new Date().getFullYear();
    const col = n => db.collection(n);
    const ST = buildStudents();
    const MID = DEMO_ID;

    // ১) শিক্ষার্থী (বাকি সব এর ওপর নির্ভর করে, তাই আগে)
    await write(ST.map(s => ({
      ref: col('students').doc(s.id),
      data: { madrasaId: MID, name: s.name, roll: s.roll, className: s.className, hasPinSet: true, createdAt: now + s.idx }
    })), 'শিক্ষার্থী');

    // ২) PIN ও ফোন
    await write(ST.map(s => ({ ref: col('student_pins').doc(s.id), data: { pin: PIN } })), 'PIN');
    await write(ST.map(s => ({
      ref: col('student_contacts').doc(s.id),
      data: { madrasaId: MID, phone: '017000000' + pad(s.idx + 1), hasWhatsapp: s.idx % 2 === 0 }
    })), 'যোগাযোগ');

    // ৩) হাজিরা: গত ৯ দিন (শুক্রবার বাদ) ও আজ
    const R = mulberry(20260);
    const reasons = ['অসুস্থতা', 'পারিবারিক কাজ', 'জ্বর', 'আত্মীয়ের বাড়িতে'];
    const att = [];
    for (let off = 9; off >= 0; off--) {
      const d = dayOff(off);
      if (off > 0 && d.getDay() === 5) continue;
      const ds = fmt(d);
      ST.forEach(s => {
        let status;
        if (off === 0) {
          if (s.idx % 8 === 7) return; // প্রতি শ্রেণির শেষজনের হাজিরা বাকি রাখা হয়েছে
          status = (s.idx === 4 || s.idx === 12) ? 'absent' : 'present';
        } else {
          status = R() < s.absRate ? 'absent' : 'present';
        }
        const data = { studentId: s.id, date: ds, status, madrasaId: MID };
        if (status === 'absent' && (off === 0 || R() < 0.6)) data.reason = reasons[Math.floor(R() * reasons.length)];
        att.push({ ref: col('attendance').doc(s.id + '_' + ds), data });
      });
    }
    await write(att, 'হাজিরা');

    // ৪) রেজাল্ট: দুটি পরীক্ষা (GPA-র ধারা দেখানোর জন্য)
    const EXAMS = [
      { name: 'প্রথম সাময়িক পরীক্ষা ' + bn(year), off: 70, bias: -0.05, seed: 7 },
      { name: 'অর্ধবার্ষিক পরীক্ষা ' + bn(year), off: 0, bias: 0, seed: 11 }
    ];
    const SUBJ = ['আরবি', 'বাংলা', 'ইংরেজি', 'গণিত', 'আকাঈদ ও ফিকহ', 'কুরআন'];
    const results = [];
    EXAMS.forEach(ex => {
      const rows = ST.map(s => {
        const r = mulberry(ex.seed * 100 + s.idx);
        const subjects = SUBJ.map(n => {
          const p = Math.max(0.36, Math.min(0.98, s.ability + ex.bias + (r() - 0.5) * 0.2));
          return { name: n, full: 100, obtained: Math.round(100 * p) };
        });
        return { s, subjects, t: computeMarksheetTotals(subjects) };
      });
      const rank = {};
      CLASSES.forEach(c => {
        const passed = rows.filter(x => x.s.className === c.name && x.t.grade !== 'F')
          .sort((a, b) => Number(b.t.gpa) - Number(a.t.gpa) || b.t.totalObtained - a.t.totalObtained || Number(a.s.roll) - Number(b.s.roll));
        passed.forEach((x, i) => { rank[x.s.id] = { r: i + 1, n: passed.length }; });
      });
      rows.forEach(x => {
        const data = {
          madrasaId: MID, studentId: x.s.id, examName: ex.name, academicYear: String(year),
          subjects: x.subjects, totalObtained: x.t.totalObtained, totalFull: x.t.totalFull,
          percentage: x.t.percentage, grade: x.t.grade, gpa: x.t.gpa, published: true,
          date: ex.off ? fmt(dayOff(ex.off)) : today
        };
        if (rank[x.s.id]) { data.meritRank = rank[x.s.id].r; data.meritTotal = rank[x.s.id].n; }
        results.push({ ref: col('results').doc(x.s.id + '_' + ex.name + '_' + year), data });
      });
    });
    await write(results, 'রেজাল্ট');

    // ৫) বেতন: এ মাস ও গত মাস, সাথে কয়েকটি এককালীন ফি
    const thisM = today.slice(0, 7);
    const pd = new Date(); pd.setDate(1); pd.setMonth(pd.getMonth() - 1);
    const prevM = fmt(pd).slice(0, 7);
    const fees = [];
    ST.forEach(s => {
      const paidNow = s.idx % 3 !== 0, paidPrev = s.idx % 5 !== 4;
      fees.push({ ref: col('fees_monthly').doc(s.id + '_' + thisM), data: { studentId: s.id, month: thisM, madrasaId: MID, amount: s.fee, status: paidNow ? 'paid' : 'due', paidDate: paidNow ? fmt(dayOff(1 + s.idx % 5)) : '' } });
      fees.push({ ref: col('fees_monthly').doc(s.id + '_' + prevM), data: { studentId: s.id, month: prevM, madrasaId: MID, amount: s.fee, status: paidPrev ? 'paid' : 'due', paidDate: paidPrev ? fmt(dayOff(20 + s.idx % 6)) : '' } });
    });
    [['demo_f1', 2, 'পরীক্ষার ফি', 200], ['demo_f2', 6, 'পরীক্ষার ফি', 200], ['demo_f3', 9, 'ভর্তি ফি', 1000]].forEach(f => {
      fees.push({ ref: col('fees_onetime').doc(f[0]), data: { madrasaId: MID, studentId: ST[f[1]].id, feeType: f[2], amount: f[3], status: 'due', date: today, createdAt: now } });
    });
    await write(fees, 'বেতন');

    // ৬) নোটিশ, ডায়েরি, হোমওয়ার্ক, ছুটি
    const DAY = 86400000;
    const more = [];
    [['demo_n1', 'বার্ষিক পরীক্ষার রুটিন প্রকাশিত হয়েছে', 'আগামী সপ্তাহ থেকে পরীক্ষা শুরু। শিক্ষার্থীরা রুটিন দেখে প্রস্তুতি নিন।', 0],
     ['demo_n2', 'অভিভাবক সমাবেশ', 'আগামী বৃহস্পতিবার সকাল ১০টায় মাদ্রাসা মিলনায়তনে অভিভাবক সমাবেশ অনুষ্ঠিত হবে।', 1],
     ['demo_n3', 'শীতকালীন নির্দেশনা', 'শীত শুরু হয়েছে। শিক্ষার্থীরা পরিষ্কার ও পর্যাপ্ত গরম কাপড় পরে আসবে।', 3]
    ].forEach(n => more.push({ ref: col('notices').doc(n[0]), data: { madrasaId: MID, title: n[1], body: n[2], createdAt: now - n[3] * DAY } }));

    const dName = banglaWeekdayFromDate(today);
    const noFile = { attachmentDataUrl: '', attachmentName: '', attachmentType: '' };
    more.push({ ref: col('diary').doc('demo_d1'), data: Object.assign({ madrasaId: MID, date: today, dayName: dName, className: CLASSES[0].name, createdAt: now, subjects: { 'কুরআন': 'সূরা আন-নাস মুখস্থ ও তাজবীদসহ পড়া', 'আরবি ১ম': 'পৃষ্ঠা ১২ ও ১৩ পড়া ও লেখা', 'গণিত': 'যোগ অনুশীলনী ২.১', 'বাংলা ১ম পত্র': 'স্বরবর্ণ লেখা ও মুখস্থ' } }, noFile) });
    more.push({ ref: col('diary').doc('demo_d2'), data: Object.assign({ madrasaId: MID, date: today, dayName: dName, className: CLASSES[1].name, createdAt: now, subjects: { 'আকাঈদ': 'ঈমানের মৌলিক বিষয় পড়া', 'ফিকহ': 'ওযুর ফরজ ও সুন্নত মুখস্থ', 'ইংরেজি ১ম পত্র': 'Unit 3 পড়া ও শব্দার্থ', 'দোয়া': 'খাওয়ার আগের ও পরের দোয়া' } }, noFile) });

    more.push({ ref: col('homework').doc('demo_h1'), data: { madrasaId: MID, className: CLASSES[0].name, subject: 'আরবি', text: 'আরবি বর্ণমালা ২০ বার করে লিখে আনবে।', imageDataUrl: '', imageType: '', date: today, createdAt: now } });
    more.push({ ref: col('homework').doc('demo_h2'), data: { madrasaId: MID, className: CLASSES[1].name, subject: 'গণিত', text: 'অনুশীলনী ৩.২ এর ১ থেকে ১০ নম্বর সমাধান করবে।', imageDataUrl: '', imageType: '', date: today, createdAt: now } });

    [['demo_l1', 0, 1, 'পারিবারিক অনুষ্ঠানে যোগদানের জন্য', 'pending'],
     ['demo_l2', 4, 2, 'জ্বর থাকায় এক দিনের ছুটি প্রয়োজন', 'pending'],
     ['demo_l3', 2, 6, 'অসুস্থতার কারণে ছুটি', 'approved']
    ].forEach(l => more.push({ ref: col('leaves').doc(l[0]), data: { madrasaId: MID, studentId: ST[l[1]].id, date: fmt(dayOff(-l[2] + 2)), reason: l[3], status: l[4], createdAt: now - l[2] * 3600000 } }));
    await write(more, 'নোটিশ ও অন্যান্য');

    await col('madrasas').doc(DEMO_ID).set({ demoSeededOn: today }, { merge: true });
  }

  // ---------- ডেমোতে বন্ধ রাখা কাজ ----------
  const DEMO_MSG = 'ডেমো মোডে এটি বন্ধ আছে';
  const demoErr = () => new Error(DEMO_MSG);

  // সেটিংস, বন্ধের দিন, শিক্ষক-ব্যবস্থাপনা ও সুপার অ্যাডমিনের কাজ
  ['saveSettings', 'removeLogo', 'saveWeeklyOff', 'addHolidays', 'removeHoliday', 'saveHolidayPatch',
   'addTeacherAccount', 'toggleTeacherAdmin', 'toggleTeacherActive', 'approveTeacher', 'toggleMadrasaActive'
  ].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (inDemo()) { alert(DEMO_MSG); return; }
      return orig.apply(this, arguments);
    };
  });

  // পেমেন্ট: ডেমোতে payment_requests / payment_settings এ কোনো লেখা চলবে না
  const LOCKED_COLLECTIONS = ['payment_requests', 'payment_settings'];
  const origCollection = db.collection.bind(db);
  db.collection = function (name) {
    const c = origCollection(name);
    if (!inDemo() || LOCKED_COLLECTIONS.indexOf(name) === -1) return c;
    const rej = () => Promise.reject(demoErr());
    c.add = rej;
    const origDoc = c.doc.bind(c);
    c.doc = function () {
      const d = origDoc.apply(c, arguments);
      d.set = rej; d.update = rej; d.delete = rej;
      return d;
    };
    return c;
  };

  // ডেমো অ্যাকাউন্টের পাসওয়ার্ড/ইমেইল বদল বা মোছা বন্ধ (যেন কেউ ডেমো আটকে দিতে না পারে)
  function lockUser(u) {
    if (!u) return;
    ['updatePassword', 'updateEmail', 'verifyBeforeUpdateEmail', 'delete'].forEach(m => {
      if (typeof u[m] === 'function') u[m] = () => Promise.reject(demoErr());
    });
  }
  const origReset = auth.sendPasswordResetEmail.bind(auth);
  auth.sendPasswordResetEmail = function (email) {
    if (inDemo() || email === EMAIL) return Promise.reject(demoErr());
    return origReset.apply(auth, arguments);
  };
  auth.onAuthStateChanged(u => { if (u && u.email === EMAIL) lockUser(u); });

  // ---------- app.js এর সাথে জোড়া লাগানো ----------
  const prevRoleSelect = window.showRoleSelect;
  window.showRoleSelect = function () {
    const r = prevRoleSelect.apply(this, arguments);
    if (inDemo()) return r;
    if (Date.now() < autoOpenUntil) { autoOpenUntil = 0; window.showDemoChoice(); return r; }
    if (ls.get('demoLinkOk') !== '1') return r; // ডেমো লিংক না খুললে বাটন দেখাবে না
    const card = document.querySelector('#app .card');
    if (card && !card.querySelector('[data-demo-btn]')) {
      card.insertAdjacentHTML('beforeend',
        '<button data-demo-btn="1" class="secondary" onclick="showDemoChoice()" style="margin-top:14px;background:#fff7e0;color:#8a5a00;">🎬 ডেমো দেখুন</button>');
    }
    return r;
  };

  const prevLogout = window.logout;
  window.logout = function () {
    if (inDemo()) { window.demoExit(); return; }
    return prevLogout.apply(this, arguments);
  };
})();
