/* ShikkhaOS — payments.js (পেমেন্ট সিস্টেম, ধাপ ১)
 *
 * index.html-এ plans-expiry.js এর নিচে লোড হবে। app.js / dashboard.js বদলাতে হয় না।
 *
 * এই ধাপে যা হয়:
 *  (ক) সুপার অ্যাডমিন: "সুপার অ্যাডমিন" ট্যাবের ওপরে "পেমেন্ট সেটিংস" কার্ড —
 *      Nagad নম্বর, অ্যাকাউন্টের ধরন ও প্ল্যানের মাসিক দাম ঠিক করা + আসা পেমেন্টের আবেদনের তালিকা।
 *  (খ) মাদ্রাসার অ্যাডমিন: "সেটিংস" পাতার নিচে "প্ল্যান ও পেমেন্ট" কার্ড —
 *      Nagad নম্বরে টাকা পাঠিয়ে প্ল্যান, মাস, পরিমাণ, প্রেরকের নম্বর ও TrxID জমা দেওয়া।
 *  একই TrxID একই মাদ্রাসা দ্বিতীয়বার জমা দিতে পারে না (ডকুমেন্ট আইডি = মাদ্রাসা আইডি + TrxID)।
 *  রিড কম রাখতে সবকিছু একবার get() দিয়ে লোড হয় (লাইভ listener নেই)।
 *  অনুমোদন ও প্ল্যান/মেয়াদ নিজে থেকে বদলানো আসবে ধাপ ২-এ।
 */
(function () {
  'use strict';

  if (typeof renderSettingsScreen !== 'function' || typeof renderSuperAdminScreen !== 'function' || typeof db === 'undefined') {
    console.error('[payments] app.js এর পরে payments.js লোড করুন (index.html এ plans-expiry.js এর নিচে)।');
    return;
  }

  const PLANS = [
    { key: 'basic', label: 'বেসিক' },
    { key: 'standard', label: 'স্ট্যান্ডার্ড' },
    { key: 'premium', label: 'প্রিমিয়াম' }
  ];
  const MONTH_OPTIONS = [1, 3, 6, 12];
  const STATUS = {
    pending: ['অপেক্ষমাণ', 'pending'],
    approved: ['অনুমোদিত', 'approved'],
    rejected: ['প্রত্যাখ্যাত', 'rejected']
  };

  const bn = n => toBanglaNumeral(n);
  const el = id => document.getElementById(id);
  const money = n => '৳ ' + bn(Math.round(Number(n) || 0).toLocaleString('en-US'));
  const planLabel = k => { const p = PLANS.find(x => x.key === k); return p ? p.label : String(k || ''); };
  const fmtDate = ms => ms ? new Date(ms).toLocaleDateString('bn-BD') : '';
  const normPhone = s => toEnglishDigits(s).replace(/[^0-9]/g, '');
  const validPhone = p => /^01[3-9][0-9]{8}$/.test(p);
  const priceOf = (c, key) => Number(c && c.prices && c.prices[key]) || 0;
  const hr = '<hr style="border:none;border-top:1px solid #eee;margin:14px 0;">';

  // ---------- পেমেন্ট সেটিংস (payment_settings/main), ৫ মিনিট ক্যাশ ----------
  let cfg = null, cfgAt = 0;
  function loadCfg(force) {
    if (!force && cfg && Date.now() - cfgAt < 300000) return Promise.resolve(cfg);
    return db.collection('payment_settings').doc('main').get().then(doc => {
      cfg = doc.exists ? (doc.data() || {}) : {};
      cfgAt = Date.now();
      return cfg;
    });
  }

  function requestRow(r, forAdmin) {
    const st = STATUS[r.status] || STATUS.pending;
    const top = forAdmin
      ? esc(r.madrasaName || r.madrasaId || '-') + ' <span class="muted">— ' + esc(planLabel(r.plan)) + ', ' + esc(bn(r.months)) + ' মাস</span>'
      : esc(planLabel(r.plan)) + ' <span class="muted">— ' + esc(bn(r.months)) + ' মাস</span>';
    const more = forAdmin ? ' | প্রেরক: ' + esc(r.senderNumber || '-') : '';
    return `<div class="student-row" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <b>${top}</b><span class="badge ${st[1]}">${st[0]}</span>
      </div>
      <div class="muted" style="margin-top:2px;">${esc(money(r.amount))} | TrxID: ${esc(r.trxId || '-')}${more} | ${esc(fmtDate(r.createdAt))}</div>
    </div>`;
  }

  // =====================================================================
  //                    মাদ্রাসার অ্যাডমিন: পেমেন্ট জমা দেওয়া
  // =====================================================================
  function payCardHtml() {
    return `<div class="card" id="payCard">
      <h2>💳 প্ল্যান ও পেমেন্ট</h2>
      <div id="payBody"><p class="muted">লোড হচ্ছে...</p></div>
      ${hr}
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <b>আমার পেমেন্টের আবেদন</b>
        <button class="small secondary" onclick="payLoadHistory()">রিফ্রেশ</button>
      </div>
      <div id="payHistory" style="margin-top:8px;"><p class="muted">লোড হচ্ছে...</p></div>
    </div>`;
  }

  function renderPayBody(c) {
    const box = el('payBody');
    if (!box) return;
    const number = String((c && c.nagadNumber) || '').trim();
    if (!number) {
      box.innerHTML = '<p class="muted">পেমেন্টের Nagad নম্বর এখনো সেট করা হয়নি। অনুগ্রহ করে অ্যাপের মালিকের সাথে যোগাযোগ করুন।</p>';
      return;
    }
    const how = c.accountType === 'merchant' ? 'Payment' : 'Send Money';
    const planOpts = PLANS.map(p => {
      const pr = priceOf(c, p.key);
      return `<option value="${p.key}">${esc(p.label)}${pr ? ' — ' + esc(money(pr)) + '/মাস' : ''}</option>`;
    }).join('');
    const monthOpts = MONTH_OPTIONS.map(m => `<option value="${m}">${esc(bn(m))} মাস</option>`).join('');
    box.innerHTML = `
      <p class="muted" style="line-height:1.7;">১) Nagad অ্যাপ থেকে নিচের নম্বরে <b>${how}</b> করুন।<br>২) টাকা পাঠানোর পর পাওয়া মেসেজের <b>TrxID</b> সহ নিচের ফর্ম পূরণ করুন।<br>৩) যাচাইয়ের পর আপনার প্ল্যান চালু হবে।</p>
      <div style="display:flex;align-items:center;gap:8px;">
        <input id="payNumber" readonly value="${esc(number)}" style="flex:1;font-size:18px;font-weight:bold;letter-spacing:1px;">
        <button class="small secondary" onclick="payCopy()">কপি করুন</button>
      </div>
      <label>প্ল্যান</label><select id="payPlan" onchange="payRecalc()">${planOpts}</select>
      <label>কত মাসের জন্য</label><select id="payMonths" onchange="payRecalc()">${monthOpts}</select>
      <p id="paySuggest" class="muted" style="margin:4px 0;"></p>
      <label>যত টাকা পাঠিয়েছেন</label><input id="payAmount" type="number" inputmode="numeric" placeholder="টাকার পরিমাণ">
      <label>যে নম্বর থেকে পাঠিয়েছেন</label><input id="paySender" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX">
      <label>TrxID (Nagad-এর মেসেজে পাবেন)</label><input id="payTrx" autocapitalize="characters" autocomplete="off" placeholder="TrxID লিখুন">
      <p id="payError" class="muted" style="color:#dc2626;"></p>
      <button onclick="paySubmit(this)">আবেদন জমা দিন</button>`;
    window.payRecalc();
  }

  window.payRecalc = function () {
    const plan = el('payPlan'), months = el('payMonths'), amt = el('payAmount'), hint = el('paySuggest');
    if (!plan || !months || !amt || !hint) return;
    const pr = priceOf(cfg, plan.value), m = Number(months.value);
    if (pr > 0) {
      const total = pr * m;
      hint.textContent = 'নির্ধারিত দাম: ' + money(pr) + ' × ' + bn(m) + ' মাস = ' + money(total);
      amt.value = String(total);
    } else {
      hint.textContent = '';
    }
  };

  window.payCopy = function () {
    const e = el('payNumber');
    if (!e) return;
    const done = () => alert('নম্বর কপি হয়েছে');
    try {
      navigator.clipboard.writeText(e.value).then(done).catch(() => { e.select(); document.execCommand('copy'); done(); });
    } catch (x) {
      try { e.select(); document.execCommand('copy'); done(); } catch (y) { alert('কপি করা যায়নি, নম্বরটি চেপে ধরে কপি করুন'); }
    }
  };

  window.paySubmit = function (btn) {
    const err = el('payError');
    if (err) err.textContent = '';
    const fail = m => { if (err) err.textContent = m; };
    if (!myTeacherIsAdmin || isSuperAdminUser) return fail('শুধু মাদ্রাসার অ্যাডমিন পেমেন্ট জমা দিতে পারেন');

    const plan = el('payPlan').value;
    const months = Number(el('payMonths').value);
    const amount = Number(toEnglishDigits(el('payAmount').value).replace(/[^0-9.]/g, ''));
    const sender = normPhone(el('paySender').value);
    const trx = toEnglishDigits(el('payTrx').value).toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!PLANS.some(p => p.key === plan)) return fail('প্ল্যান বাছাই করুন');
    if (MONTH_OPTIONS.indexOf(months) === -1) return fail('মাস বাছাই করুন');
    if (!(amount > 0) || amount > 1000000) return fail('টাকার সঠিক পরিমাণ দিন');
    if (!validPhone(sender)) return fail('প্রেরকের সঠিক ১১ সংখ্যার নম্বর দিন (01XXXXXXXXX)');
    if (trx.length < 6 || trx.length > 20) return fail('TrxID সঠিকভাবে লিখুন (Nagad-এর মেসেজ দেখে)');

    if (!confirm('আবেদন জমা দেওয়ার আগে মিলিয়ে নিন:\n\nপ্ল্যান: ' + planLabel(plan) + ' (' + bn(months) + ' মাস)\nটাকা: ' + money(amount) + '\nপ্রেরকের নম্বর: ' + sender + '\nTrxID: ' + trx + '\n\nসব ঠিক আছে?')) return;

    if (btn) { btn.disabled = true; btn.textContent = 'জমা হচ্ছে...'; }
    const reset = () => { if (btn) { btn.disabled = false; btn.textContent = 'আবেদন জমা দিন'; } };

    db.collection('payment_requests').doc(madrasaId + '_' + trx).set({
      madrasaId,
      madrasaName: String((appSettings && appSettings.madrasaName) || '').slice(0, 80),
      plan, months, amount,
      senderNumber: sender,
      trxId: trx,
      status: 'pending',
      createdAt: Date.now()
    }).then(() => {
      reset();
      el('payTrx') && (el('payTrx').value = '');
      alert('আপনার পেমেন্টের আবেদন জমা হয়েছে। যাচাইয়ের পর প্ল্যান চালু হবে।');
      window.payLoadHistory();
    }).catch(e => {
      reset();
      if (e && e.code === 'permission-denied') fail('জমা দেওয়া যায়নি। এই TrxID দিয়ে আগেই আবেদন জমা দেওয়া হয়ে থাকতে পারে, নিচের তালিকা দেখুন।');
      else fail('জমা দেওয়া যায়নি: ' + (e && e.message));
      if (typeof showDiagBanner === 'function') showDiagBanner('পেমেন্ট জমা ব্যর্থ: ' + (e && e.code) + ' ' + (e && e.message));
    });
  };

  window.payLoadHistory = function () {
    const box = el('payHistory');
    if (!box) return;
    db.collection('payment_requests').where('madrasaId', '==', madrasaId).get().then(snap => {
      const live = el('payHistory');
      if (!live) return;
      const rows = snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
      live.innerHTML = rows.length ? rows.map(r => requestRow(r, false)).join('') : '<p class="muted">এখনো কোনো আবেদন জমা দেওয়া হয়নি</p>';
    }).catch(e => {
      const live = el('payHistory');
      if (live) live.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) + '</p>';
    });
  };

  function mountPayCard() {
    const app = el('app');
    if (!app || el('payCard')) return;
    app.insertAdjacentHTML('beforeend', payCardHtml());
    loadCfg().then(renderPayBody).catch(e => {
      const box = el('payBody');
      if (box) box.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) + '</p>';
    });
    window.payLoadHistory();
  }

  // =====================================================================
  //                 সুপার অ্যাডমিন: সেটিংস ও আবেদনের তালিকা
  // =====================================================================
  function adminCardHtml() {
    const priceInputs = PLANS.map(p => `
      <label style="font-size:12px;">${esc(p.label)} — মাসিক দাম (টাকা)</label>
      <input id="pcP_${p.key}" type="number" inputmode="numeric" placeholder="যেমন: 300">`).join('');
    return `<div class="card" id="payAdminCard">
      <h2>💳 পেমেন্ট সেটিংস</h2>
      <p class="muted">মাদ্রাসারা এই নম্বরে টাকা পাঠাবে। এখানে বদলালে সবার কাছে সাথে সাথে নতুন নম্বর দেখাবে।</p>
      <label>Nagad নম্বর</label><input id="pcNumber" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX">
      <label>অ্যাকাউন্টের ধরন</label>
      <select id="pcType"><option value="personal">ব্যক্তিগত (Send Money)</option><option value="merchant">মার্চেন্ট (Payment)</option></select>
      ${priceInputs}
      <p id="pcError" class="muted" style="color:#dc2626;"></p>
      <button onclick="paySaveCfg()">সংরক্ষণ করুন</button>
      ${hr}
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <b>পেমেন্টের আবেদন (সর্বশেষ ৫০টি)</b>
        <button class="small secondary" onclick="payAdminLoad()">রিফ্রেশ</button>
      </div>
      <div id="payAdminList" style="margin-top:8px;"><p class="muted">লোড হচ্ছে...</p></div>
    </div>`;
  }

  function fillAdminCfg(c) {
    if (!el('pcNumber')) return;
    el('pcNumber').value = (c && c.nagadNumber) || '';
    el('pcType').value = (c && c.accountType === 'merchant') ? 'merchant' : 'personal';
    PLANS.forEach(p => { const e = el('pcP_' + p.key); if (e) e.value = priceOf(c, p.key) || ''; });
  }

  window.paySaveCfg = function () {
    const err = el('pcError');
    if (err) err.textContent = '';
    if (!isSuperAdminUser) return;
    const number = normPhone(el('pcNumber').value);
    if (!validPhone(number)) { if (err) err.textContent = 'সঠিক ১১ সংখ্যার নম্বর দিন (01XXXXXXXXX)'; return; }
    const prices = {};
    PLANS.forEach(p => {
      const v = Number(toEnglishDigits(el('pcP_' + p.key).value));
      prices[p.key] = (v > 0 && v <= 100000) ? Math.round(v) : 0;
    });
    const data = { nagadNumber: number, accountType: el('pcType').value === 'merchant' ? 'merchant' : 'personal', prices, updatedAt: Date.now() };
    db.collection('payment_settings').doc('main').set(data, { merge: true })
      .then(() => { cfg = Object.assign({}, cfg || {}, data); cfgAt = Date.now(); alert('পেমেন্ট সেটিংস সংরক্ষণ করা হয়েছে'); })
      .catch(e => { if (err) err.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; if (typeof showDiagBanner === 'function') showDiagBanner('পেমেন্ট সেটিংস সংরক্ষণ ব্যর্থ: ' + e.message); });
  };

  window.payAdminLoad = function () {
    const box = el('payAdminList');
    if (!box) return;
    box.innerHTML = '<p class="muted">লোড হচ্ছে...</p>';
    db.collection('payment_requests').orderBy('createdAt', 'desc').limit(50).get().then(snap => {
      const live = el('payAdminList');
      if (!live) return;
      if (snap.empty) { live.innerHTML = '<p class="muted">এখনো কোনো পেমেন্টের আবেদন আসেনি</p>'; return; }
      const docs = snap.docs.map(d => d.data());
      const pend = docs.filter(r => (r.status || 'pending') === 'pending').length;
      live.innerHTML = (pend ? `<p style="color:#b45309;font-weight:bold;margin:0 0 6px;">অপেক্ষমাণ আবেদন: ${esc(bn(pend))}টি</p>` : '')
        + docs.map(r => requestRow(r, true)).join('');
    }).catch(e => {
      const live = el('payAdminList');
      if (live) live.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) + '</p>';
    });
  };

  function mountAdminCard() {
    const app = el('app');
    if (!app || el('payAdminCard')) return;
    app.insertAdjacentHTML('afterbegin', adminCardHtml());
    loadCfg(true).then(fillAdminCfg).catch(e => { if (typeof showDiagBanner === 'function') showDiagBanner('পেমেন্ট সেটিংস লোড এরর: ' + e.message); });
    window.payAdminLoad();
  }

  // ================= app.js এর সাথে জোড়া লাগানো =================
  const origSettings = window.renderSettingsScreen;
  window.renderSettingsScreen = function () {
    const r = origSettings.apply(this, arguments);
    try { if (myTeacherIsAdmin && !isSuperAdminUser) mountPayCard(); } catch (e) { console.error('[payments]', e); }
    return r;
  };

  const origSuper = window.renderSuperAdminScreen;
  window.renderSuperAdminScreen = function () {
    const r = origSuper.apply(this, arguments);
    try { if (isSuperAdminUser) mountAdminCard(); } catch (e) { console.error('[payments]', e); }
    return r;
  };
})();
