/* ShikkhaOS — প্যাকেজ, ধাপ ২: প্যাকেজ অনুযায়ী ফিচার ও সংখ্যার সীমা
 * index.html এ plans.js এর ঠিক নিচে লোড হবে। app.js ও dashboard.js বদলাতে হয় না।
 * যে মাদ্রাসার কোনো প্যাকেজ ঠিক করা নেই, সেখানে এখনো সব সুবিধা খোলা (ধাপ ৩-এ ট্রায়াল আসবে)।
 * সুপার অ্যাডমিনের জন্য সবসময় সব খোলা। মেয়াদ শেষ হলে কী হবে সেটা ধাপ ৩-এ।
 * শিক্ষার্থী ও শিক্ষকের সংখ্যার সীমা অ্যাপের ভেতরে আটকায় (সার্ভারে নয়)।
 */
(function () {
  'use strict';
  if (typeof teacherTab !== 'function' || typeof getPlanInfo !== 'function' || !window.PLANS) {
    console.error('[plans-gate] plans.js এর নিচে plans-gate.js লোড করুন');
    return;
  }

  const SUPPORT_CONTACT = ''; // আপগ্রেডের জন্য আপনার নম্বর, যেমন '০১৭XXXXXXXX (হোয়াটসঅ্যাপ)'

  const BASIC = ['home', 'students', 'attendance', 'report', 'leaves', 'timeleft', 'notices', 'diary', 'suggestions', 'teachers', 'settings', 'super_admin'];
  const STANDARD = BASIC.concat(['results', 'fees', 'homework', 'parentmsg']);
  const FEATURES = { basic: BASIC, standard: STANDARD, premium: STANDARD.concat(['examroutine']) };
  const ORDER = ['basic', 'standard', 'premium'];
  const NAMES = { students: 'শিক্ষার্থী', attendance: 'উপস্থিতি', report: 'রিপোর্ট', results: 'রেজাল্ট', leaves: 'ছুটি', timeleft: 'বের হওয়ার সময়', fees: 'বেতন', notices: 'নোটিশ', diary: 'ডায়েরী', suggestions: 'পরামর্শ', teachers: 'শিক্ষকগণ', settings: 'সেটিংস', homework: 'হোমওয়ার্ক', examroutine: 'পরীক্ষার রুটিন', parentmsg: 'অভিভাবককে বার্তা' };

  const bn = n => toBanglaNumeral(n);
  // ট্রায়াল চললে (প্যাকেজ বসানো না থাকলে) সব সুবিধা খোলা; প্যাকেজ বসালে প্যাকেজই প্রাধান্য পায়
  const TRIAL_PLAN = 'premium';
  function planState() {
    if (typeof isSuperAdminUser !== 'undefined' && isSuperAdminUser) return { key: null, expired: false };
    const m = appSettings || {}, info = getPlanInfo(m);
    if (info.key) return { key: info.key, expired: info.expired, daysLeft: info.daysLeft, trial: false };
    const te = Number(m.trialEndsAt) || 0;
    if (te > 0) return { key: TRIAL_PLAN, expired: te <= Date.now(), daysLeft: Math.max(0, Math.ceil((te - Date.now()) / 86400000)), trial: true };
    return { key: null, expired: false };
  }
  window.planState = planState;
  window.PLAN_SUPPORT_CONTACT = SUPPORT_CONTACT;
  const planKey = () => planState().key;
  const allowed = f => { const k = planKey(); return !k || FEATURES[k].indexOf(f) > -1; };
  const minPlan = f => ORDER.find(k => FEATURES[k].indexOf(f) > -1) || 'premium';
  // সুপার অ্যাডমিন কোনো মাদ্রাসার জন্য আলাদা সীমা দিলে সেটাই চলে (০ = সীমাহীন), নইলে প্যাকেজের নিয়ম
  const limitFor = kind => {
    const k = planKey();
    if (!k) return null;
    const o = (appSettings || {})[kind === 'students' ? 'studentLimit' : 'teacherLimit'];
    if (typeof o === 'number' && o >= 0) return o > 0 ? o : null;
    return PLANS[k][kind];
  };
  const tabOf = s => { const m = /(?:teacherTab|studentTab)\('([a-z_]+)'\)/.exec(s || ''); return m ? m[1] : null; };
  const contactHtml = () => SUPPORT_CONTACT ? '<p class="muted">যোগাযোগ: <b>' + esc(SUPPORT_CONTACT) + '</b></p>' : '';

  // ---------- বন্ধ সুবিধার পাতা ----------
  function lockHtml(tab, isTeacher) {
    const k = planKey();
    const body = isTeacher
      ? '<b>' + esc(NAMES[tab] || tab) + '</b> সুবিধাটি <b>' + esc(PLANS[minPlan(tab)].label) + '</b> প্যাকেজ থেকে পাওয়া যায়। আপনার বর্তমান প্যাকেজ: ' + esc(k ? PLANS[k].label : '') + '। আপগ্রেড করতে যোগাযোগ করুন।'
      : 'এই সুবিধাটি আপনার মাদ্রাসায় এখনো চালু নেই। মাদ্রাসার শিক্ষকের সাথে কথা বলুন।';
    return `<div id="planLockScreen" class="card" style="text-align:center;margin-top:30px;">
      <div style="font-size:44px;">🔒</div>
      <h2>সুবিধাটি বন্ধ আছে</h2>
      <p class="muted">${body}</p>${isTeacher ? contactHtml() : ''}
      <button onclick="${isTeacher ? 'teacherTab' : 'studentTab'}('home')">হোমে ফিরুন</button>
    </div>`;
  }

  // ---------- নিচের মেনুতে বন্ধ ট্যাবে 🔒 ----------
  function decorateNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    nav.querySelectorAll('.tab-btn, .more-item').forEach(el => {
      const t = tabOf(el.getAttribute('onclick'));
      if (!t || allowed(t)) return;
      const lbl = el.lastElementChild;
      if (lbl && lbl.tagName === 'SPAN' && lbl.textContent.indexOf('🔒') < 0) lbl.textContent += ' 🔒';
    });
  }
  ['renderTeacherNav', 'renderStudentNav'].forEach(n => {
    const p = window[n];
    if (typeof p !== 'function') return;
    window[n] = function () { const r = p.apply(this, arguments); decorateNav(); return r; };
  });

  // ---------- হোম ড্যাশবোর্ড থেকে বন্ধ সুবিধার অংশ লুকানো ----------
  function gateDashboard() {
    const root = document.getElementById('dashboardScreen') || document.getElementById('studentDashScreen');
    if (!root) return;
    root.querySelectorAll('.dash-act, .dash-cell').forEach(el => {
      const t = tabOf(el.getAttribute('onclick'));
      if (t) el.style.display = allowed(t) ? '' : 'none';
    });
    [['dashFees', 'fees'], ['dashMerit', 'results'], ['sdResult', 'results'], ['sdFees', 'fees']].forEach(x => {
      const e = document.getElementById(x[0]);
      if (e) e.style.display = allowed(x[1]) ? '' : 'none';
    });
    const strip = root.querySelector('.dash-strip');
    if (strip) {
      const n = Array.from(strip.children).filter(c => c.style.display !== 'none').length;
      strip.style.gridTemplateColumns = 'repeat(' + Math.max(1, n) + ',1fr)';
    }
  }

  // ---------- ট্যাব খোলার সময় আটকানো ----------
  let lastT = null, lastS = null;
  const prevTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    lastT = tab;
    if (!allowed(tab)) { window.renderTeacherNav(tab); setScreen(lockHtml(tab, true)); return; }
    const r = prevTeacherTab.apply(this, arguments);
    if (tab === 'home') gateDashboard();
    return r;
  };
  const prevStudentTab = window.studentTab;
  if (typeof prevStudentTab === 'function') {
    window.studentTab = function (tab) {
      lastS = tab;
      if (!allowed(tab)) { currentStudentTab = tab; window.renderStudentNav(tab); setScreen(lockHtml(tab, false)); return; }
      const r = prevStudentTab.apply(this, arguments);
      if (tab === 'home') gateDashboard();
      return r;
    };
  }
  const prevRefresh = window.dashRefresh;
  if (typeof prevRefresh === 'function') {
    window.dashRefresh = function () { const r = prevRefresh.apply(this, arguments); gateDashboard(); return r; };
  }

  // ---------- প্যাকেজ বদলালে (সেটিংস দেরিতে এলে বা সুপার অ্যাডমিন বদলালে) সাথে সাথে প্রয়োগ ----------
  let lastSig = null;
  const sig = () => ((typeof isSuperAdminUser !== 'undefined' && isSuperAdminUser) ? 'S' : '') + (planKey() || 'none') + (planState().expired ? 'X' : '');
  function refreshGating() {
    const s = sig();
    if (s === lastSig) return;
    lastSig = s;
    const nav = document.getElementById('bottomNav');
    const navOn = nav && nav.style.display !== 'none';
    const locked = !!document.getElementById('planLockScreen');
    if (typeof role !== 'undefined' && role === 'teacher' && navOn && lastT) {
      window.renderTeacherNav(lastT);
      if (locked || !allowed(lastT)) window.teacherTab(lastT);
    } else if (typeof role !== 'undefined' && role === 'student' && navOn && lastS) {
      window.renderStudentNav(lastS);
      if (locked || !allowed(lastS)) window.studentTab(lastS);
    }
    gateDashboard();
  }
  const prevDash = window.dashOnSettings;
  window.dashOnSettings = function () { if (typeof prevDash === 'function') prevDash.apply(this, arguments); refreshGating(); };

  // ---------- সংখ্যার সীমা ----------
  const prevAddStudent = window.addStudent;
  if (typeof prevAddStudent === 'function') {
    window.addStudent = function () {
      const lim = limitFor('students');
      if (lim != null && studentsCache.length >= lim) {
        alert('আপনার ' + PLANS[planKey()].label + ' প্যাকেজে সর্বোচ্চ ' + bn(lim) + ' জন শিক্ষার্থী রাখা যায়, এখন আছে ' + bn(studentsCache.length) + ' জন। আরও যোগ করতে প্যাকেজ আপগ্রেড করুন।');
        return;
      }
      return prevAddStudent.apply(this, arguments);
    };
  }

  // সক্রিয় ও অনুমোদিত শিক্ষক (অ্যাডমিনসহ) গোনা হয়
  function teacherLimitOk() {
    const lim = limitFor('teachers');
    if (lim == null) return Promise.resolve(true);
    return db.collection('teachers').where('madrasaId', '==', madrasaId).get().then(snap => {
      const n = snap.docs.filter(d => { const t = d.data(); return t.active !== false && t.pending !== true; }).length;
      if (n >= lim) {
        alert('আপনার ' + PLANS[planKey()].label + ' প্যাকেজে অ্যাডমিনসহ সর্বোচ্চ ' + bn(lim) + ' জন শিক্ষক রাখা যায় (এখন সক্রিয় ' + bn(n) + ' জন)। আরও শিক্ষক যোগ করতে প্যাকেজ আপগ্রেড করুন।');
        return false;
      }
      return true;
    }).catch(() => true);
  }
  [['addTeacherAccount', () => true], ['approveTeacher', () => true], ['toggleTeacherActive', (a) => a[1] === false]].forEach(x => {
    const prev = window[x[0]];
    if (typeof prev !== 'function') return;
    window[x[0]] = function () {
      const self = this, args = arguments;
      if (!x[1](args)) return prev.apply(self, args);
      teacherLimitOk().then(ok => { if (ok) prev.apply(self, args); });
    };
  });

  // ---------- অভিভাবককে বার্তা (স্ট্যান্ডার্ড থেকে) ----------
  const prevAbsBtn = window.absentMessageButtonHtml;
  if (typeof prevAbsBtn === 'function') {
    window.absentMessageButtonHtml = function () {
      return allowed('parentmsg') ? prevAbsBtn.apply(this, arguments) : '<span class="muted" style="font-size:12px;">🔒 অভিভাবককে বার্তা স্ট্যান্ডার্ড প্যাকেজে</span>';
    };
  }
  const prevOpenAbs = window.openAbsentMessage;
  if (typeof prevOpenAbs === 'function') {
    window.openAbsentMessage = function () {
      if (!allowed('parentmsg')) { alert('অভিভাবককে বার্তা পাঠানো স্ট্যান্ডার্ড প্যাকেজ থেকে পাওয়া যায়।'); return; }
      return prevOpenAbs.apply(this, arguments);
    };
  }

  // ---------- সেটিংসে "আপনার প্যাকেজ" কার্ড ----------
  const prevSettings = window.renderSettingsScreen;
  if (typeof prevSettings === 'function') {
    window.renderSettingsScreen = function () {
      const r = prevSettings.apply(this, arguments);
      const app = document.getElementById('app');
      if (app && !document.getElementById('planInfoCard')) {
        const k = planKey(), st = planState(), info = getPlanInfo(appSettings || {});
        let body = '<p class="muted">কোনো প্যাকেজ নির্ধারিত নেই, সব সুবিধা খোলা আছে।</p>';
        if (k) {
          const p = PLANS[k];
          body = '<p><b>' + esc(st.trial ? 'ফ্রি ট্রায়াল (সব সুবিধা)' : p.label) + '</b>' + (st.trial ? ' · আর ' + bn(st.daysLeft) + ' দিন' + (st.expired ? ' (শেষ হয়ে গেছে)' : '') : info.expiry
            ? ' · মেয়াদ: ' + esc(fmtHolidayDate(info.expiry, false)) + (info.expired ? ' (শেষ হয়ে গেছে)' : ' (আর ' + bn(info.daysLeft) + ' দিন)')
            : '') + '</p>'
            + '<p class="muted">শিক্ষার্থী: <b>' + bn(studentsCache.length) + '</b>' + (limitFor('students') ? ' / ' + bn(limitFor('students')) : ' (সীমাহীন)')
            + ' &nbsp; শিক্ষক: ' + (limitFor('teachers') ? 'সর্বোচ্চ ' + bn(limitFor('teachers')) + ' জন (অ্যাডমিনসহ)' : 'সীমাহীন') + '</p>' + contactHtml();
        }
        app.insertAdjacentHTML('afterbegin', '<div class="card" id="planInfoCard"><h2>আপনার প্যাকেজ</h2>' + body + '</div>');
      }
      return r;
    };
  }
})();
