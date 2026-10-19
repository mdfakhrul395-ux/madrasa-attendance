// ================= fees-quick.js (v2) — মাসিক বেতন: সুন্দর ও দ্রুত এন্ট্রি =================
// index.html-এ সবার শেষে (class-teacher.js-এর পরে) লোড হবে। app.js ছুঁতে হয় না।
// বন্ধ করতে: index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
//
// সুবিধা: নির্ধারিত বেতন আগে থেকে বসা • এক ট্যাপে পরিশোধিত (নিশ্চিতকরণসহ) • আংশিক পরিশোধ
// • সংশোধন/পরিশোধ বাতিল • পরিমাণ বদলালে "পরের মাসেও?" জিজ্ঞাসা • সবাইকে পরিশোধিত
// • ফিল্টার (বাকি/পরিশোধিত/বকেয়া) ও নাম/রোল সার্চ • প্রতিটি পরিবর্তনের ইতিহাস
(function () {
  'use strict';

  const S = { mid: null, month: '', docs: {}, defaults: {}, defaultsOk: false, defaultsWarned: false, token: 0, filter: 'all', q: '' };
  const $ = id => document.getElementById(id);
  const money = n => (typeof feeMoney === 'function') ? feeMoney(n) : (n + ' টাকা');
  const bn = n => toBanglaNumeral(n);
  const num = v => {
    const n = Number(toEnglishDigits(String(v == null ? '' : v)).trim());
    return isNaN(n) ? 0 : n;
  };
  const FV = () => firebase.firestore.FieldValue;
  const docRef = (id, month) => db.collection('fees_monthly').doc(id + '_' + month);
  const stu = id => studentsCache.find(x => x.id === id) || { id, name: '' };
  const logEntry = a => Object.assign({ t: Date.now(), d: todayLocal() }, a);

  // ---------- স্টাইল ----------
  const CSS = `
.fq-sum{background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 1px 6px rgba(15,23,42,.08)}
.fq-sum h3{margin:0 0 8px;font-size:17px;color:#0f172a}
.fq-bar{height:10px;border-radius:6px;background:#fee2e2;overflow:hidden;margin:6px 0 10px}
.fq-bar i{display:block;height:100%;background:#16a34a;border-radius:6px}
.fq-stats{display:flex;gap:8px}
.fq-stat{flex:1;border-radius:12px;padding:8px 6px;text-align:center}
.fq-stat b{display:block;font-size:15px}
.fq-stat span{font-size:11.5px;color:#475569}
.fq-stat.g{background:#dcfce7;color:#166534}.fq-stat.r{background:#fee2e2;color:#b91c1c}.fq-stat.n{background:#e0f2f1;color:#0f766e}
.fq-sumbtns{display:flex;gap:8px;margin-top:10px}
.fq-tools{margin:8px 0}
.fq-tools input[type=search]{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;font-family:inherit;background:#fff}
.fq-chips{display:flex;gap:6px;margin-top:8px;overflow-x:auto;-webkit-overflow-scrolling:touch}
.fq-chip{flex:none;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:18px;padding:7px 14px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer}
.fq-chip.on{background:#0f766e;border-color:#0f766e;color:#fff}
.fq-count{font-size:12px;color:#64748b;margin:4px 2px}
.fq-card{position:relative;background:#fff;border-radius:14px;padding:12px 12px 12px 16px;margin:8px 0;box-shadow:0 1px 4px rgba(15,23,42,.08);border-left:5px solid #cbd5e1}
.fq-card.st-paid{border-left-color:#16a34a;background:#f7fdf9}
.fq-card.st-due{border-left-color:#dc2626}
.fq-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.fq-nm{font-size:16px;font-weight:700;color:#0f172a;min-width:0}
.fq-nm small{display:block;font-size:12px;font-weight:400;color:#64748b;margin-top:1px}
.fq-pill{flex:none;border-radius:12px;padding:3px 10px;font-size:12px;font-weight:700}
.fq-pill.paid{background:#dcfce7;color:#166534}.fq-pill.due{background:#fee2e2;color:#b91c1c}.fq-pill.none{background:#f1f5f9;color:#64748b}
.fq-amt{display:flex;align-items:center;gap:6px;margin:10px 0 4px;border:1px solid #cbd5e1;border-radius:12px;padding:0 12px;background:#fff}
.fq-amt span{font-size:18px;color:#64748b}
.fq-amt input{flex:1;min-width:0;border:0;outline:0;font-size:20px;font-weight:700;padding:10px 0;background:transparent;font-family:inherit;color:#0f172a}
.fq-lbl{font-size:12px;color:#64748b;margin-top:8px}
.fq-part{font-size:12.5px;color:#475569;margin:4px 0;background:#fff7ed;border-radius:8px;padding:5px 8px}
.fq-btns{display:flex;gap:8px;margin-top:8px}
.fq-b{flex:1;border:0;border-radius:11px;padding:12px 6px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}
.fq-b:active{transform:scale(.97)}
.fq-b.ok{background:#0f766e;color:#fff;flex:1.6}
.fq-b.part{background:#e0f2f1;color:#0f766e}
.fq-b.due{background:#fee2e2;color:#b91c1c}
.fq-b.due.on{background:#dc2626;color:#fff}
.fq-b.sec{background:#f1f5f9;color:#334155}
.fq-b.dng{background:#fee2e2;color:#b91c1c}
.fq-b.sm{padding:9px 6px;font-size:13px}
.fq-paidbox{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.fq-paidamt{font-size:20px;font-weight:700;color:#166534}
.fq-date{font-size:12px;color:#64748b}
.fq-links{display:flex;gap:8px;margin-top:8px}
.fq-ov{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(15,23,42,.5);z-index:2147483600;display:flex;align-items:flex-end;justify-content:center}
.fq-md{background:#fff;width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom,0px));max-height:85vh;overflow-y:auto}
.fq-mt{font-size:17px;font-weight:700;color:#0f172a;margin-bottom:6px}
.fq-mb{font-size:14px;color:#334155;line-height:1.6;margin-bottom:10px}
.fq-big{font-size:26px;font-weight:700;color:#0f766e;margin:2px 0}
.fq-md input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:20px;font-weight:700;font-family:inherit;margin-bottom:10px}
.fq-mbtns{display:flex;gap:8px}
.fq-h{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #eef2f7}
.fq-h span:first-child{color:#64748b}
.fq-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 18px;border-radius:20px;font-size:14px;z-index:2147483601;max-width:90%;text-align:center}
`;
  if (!$('fqStyles')) {
    const st = document.createElement('style');
    st.id = 'fqStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---------- ছোট সহায়ক: টোস্ট ও মডাল ----------
  let toastTimer = null;
  function toast(msg) {
    let t = $('fqToast');
    if (!t) { t = document.createElement('div'); t.id = 'fqToast'; t.className = 'fq-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2200);
  }

  // opt: { title, body(html), input:{value,ph}, buttons:[{label,key,cls}] } → Promise<{key,value}>
  function modal(opt) {
    return new Promise(resolve => {
      const old = $('fqModal'); if (old) old.remove();
      const ov = document.createElement('div');
      ov.id = 'fqModal'; ov.className = 'fq-ov';
      const btns = (opt.buttons || [{ label: 'বাতিল', key: 'x', cls: 'sec' }, { label: 'নিশ্চিত করুন', key: 'ok', cls: 'ok' }])
        .map(b => '<button class="fq-b ' + (b.cls || 'sec') + '" data-k="' + esc(b.key) + '">' + esc(b.label) + '</button>').join('');
      ov.innerHTML = '<div class="fq-md"><div class="fq-mt">' + esc(opt.title || '') + '</div><div class="fq-mb">' + (opt.body || '') + '</div>' +
        (opt.input ? '<input id="fqMI" type="number" inputmode="numeric" value="' + esc(opt.input.value || '') + '" placeholder="' + esc(opt.input.ph || '') + '">' : '') +
        '<div class="fq-mbtns">' + btns + '</div></div>';
      const done = key => {
        const inp = $('fqMI');
        const value = inp ? inp.value : '';
        ov.remove();
        resolve({ key, value });
      };
      ov.addEventListener('click', e => {
        if (e.target === ov) return done('x');
        const k = e.target && e.target.getAttribute && e.target.getAttribute('data-k');
        if (k) done(k);
      });
      document.body.appendChild(ov);
      const inp = $('fqMI');
      if (inp) { inp.focus(); inp.select(); }
    });
  }

  function failMsg(what, e) {
    toast('সংরক্ষণ হয়নি — ইন্টারনেট/অনুমতি দেখুন');
    showDiagBanner(what + ': ' + (e && e.message ? e.message : ''));
  }

  // ---------- ডিফল্ট বেতন (fee_defaults/{madrasaId}.amounts = { studentId: টাকা }) ----------
  function loadDefaults() {
    if (S.mid !== madrasaId) { S.mid = madrasaId; S.defaults = {}; S.defaultsOk = false; }
    if (S.defaultsOk) return Promise.resolve();
    return db.collection('fee_defaults').doc(madrasaId).get().then(doc => {
      S.defaults = (doc.exists && doc.data().amounts) || {};
      S.defaultsOk = true;
    }).catch(e => {
      showDiagBanner('fee_defaults লোড ব্যর্থ (firestore.rules-এ fee_defaults যোগ করা হয়েছে?): ' + e.message);
    });
  }

  function setDefaults(map) {
    return db.collection('fee_defaults').doc(madrasaId)
      .set({ madrasaId, amounts: map }, { merge: true })
      .then(() => { Object.assign(S.defaults, map); S.defaultsOk = true; return true; })
      .catch(e => {
        if (!S.defaultsWarned) {
          S.defaultsWarned = true;
          alert('নির্ধারিত বেতন জমা হয়নি। firestore.rules-এ fee_defaults ব্লকটি যোগ করে Publish করা হয়েছে কি?');
        }
        showDiagBanner('fee_defaults সংরক্ষণ ব্যর্থ: ' + e.message);
        return false;
      });
  }

  function curAmount(id) {
    const d = S.docs[id] || {};
    if (num(d.amount) > 0) return num(d.amount);
    return num(S.defaults[id]);
  }
  const stOf = d => d.status === 'paid' ? 'paid' : (d.status === 'due' ? 'due' : 'none');

  function applyLocal(id, patch, log) {
    const old = S.docs[id] || {};
    const p = Object.assign({}, patch);
    if (log) p.history = (old.history || []).concat([log]);
    S.docs[id] = Object.assign({ studentId: id, month: S.month }, old, p);
  }

  function persist(id, patch, log) {
    const month = S.month;
    const entry = logEntry(log);
    const data = Object.assign({ studentId: id, month, madrasaId }, patch, { history: FV().arrayUnion(entry) });
    return docRef(id, month).set(data, { merge: true }).then(() => {
      if (S.month !== month) return true;
      applyLocal(id, patch, entry);
      refreshCard(id);
      refreshSummary();
      return true;
    }).catch(e => { failMsg('বেতন সংরক্ষণ ব্যর্থ', e); return false; });
  }

  // ---------- UI ----------
  function cardHtml(s) {
    const d = S.docs[s.id] || {};
    const idq = jsq(s.id);
    const st = stOf(d);
    const sub = esc(s.className || '-') + (s.roll ? ' • রোল ' + esc(s.roll) : '');
    const hist = (d.history && d.history.length) ? `<button class="fq-b sec sm" style="flex:none;padding:9px 12px;" onclick="fqHist('${idq}')">📜 ইতিহাস</button>` : '';
    const head = `<div class="fq-top"><div class="fq-nm">${esc(s.name)}<small>${sub}</small></div>` +
      `<span class="fq-pill ${st}">${st === 'paid' ? '✓ পরিশোধিত' : (st === 'due' ? 'বকেয়া' : 'চিহ্নিত নয়')}</span></div>`;

    if (st === 'paid') {
      return head + `
        <div class="fq-paidbox"><div class="fq-paidamt">${money(d.amount)}</div><div class="fq-date">${d.paidDate ? esc(d.paidDate) : ''}</div></div>
        <div class="fq-links"><button class="fq-b sec sm" onclick="fqFix('${idq}')">✎ সংশোধন</button>${hist}</div>`;
    }

    const hasPart = num(d.paidAmount) > 0;
    const partial = hasPart
      ? `<div class="fq-part">মোট ${money(d.totalAmount || 0)} • দিয়েছে ${money(d.paidAmount)} • <b>বাকি ${money(d.amount)}</b></div>` : '';
    return head + `
      <div class="fq-lbl">${hasPart ? 'বাকি পরিমাণ' : 'বেতনের পরিমাণ'}</div>
      <div class="fq-amt"><span>৳</span><input type="number" inputmode="numeric" id="fqa_${esc(s.id)}" value="${esc(curAmount(s.id) || '')}" placeholder="পরিমাণ লিখুন" onchange="fqAmt('${idq}',this.value)"></div>
      ${partial}
      <div class="fq-btns">
        <button class="fq-b ok" onclick="fqPay('${idq}')">✓ পরিশোধিত</button>
        <button class="fq-b part" onclick="fqPartial('${idq}')">আংশিক</button>
        <button class="fq-b due ${st === 'due' ? 'on' : ''}" onclick="fqDue('${idq}')">বকেয়া</button>
      </div>
      ${hist ? '<div class="fq-links">' + hist + '</div>' : ''}`;
  }

  function cardWrap(s) {
    const d = S.docs[s.id] || {};
    return '<div class="fq-card st-' + stOf(d) + '" id="fee_' + esc(s.id) + '">' + cardHtml(s) + '</div>';
  }

  function refreshCard(id) {
    const el = $('fee_' + id);
    if (!el) return;
    el.className = 'fq-card st-' + stOf(S.docs[id] || {});
    el.innerHTML = cardHtml(stu(id));
  }

  function refreshSummary() {
    const el = $('fqSummary');
    if (!el) return;
    const students = studentsByClass(feesClassFilter);
    let paidN = 0, pendN = 0, collected = 0, pending = 0;
    students.forEach(s => {
      const d = S.docs[s.id] || {};
      if (d.status === 'paid') { paidN++; collected += num(d.amount); }
      else { pendN++; collected += num(d.paidAmount); pending += curAmount(s.id); }
    });
    const pct = (collected + pending) > 0 ? Math.round(collected / (collected + pending) * 100) : 0;
    el.innerHTML = `
      <h3>${esc(feeMonthLabel(S.month))}</h3>
      <div class="fq-stats">
        <div class="fq-stat g"><b>${bn(paidN)} জন</b><span>পরিশোধিত</span></div>
        <div class="fq-stat r"><b>${bn(pendN)} জন</b><span>বাকি</span></div>
      </div>
      <div class="fq-bar"><i style="width:${pct}%"></i></div>
      <div class="fq-stats">
        <div class="fq-stat g"><b>${money(collected)}</b><span>আদায়</span></div>
        <div class="fq-stat r"><b>${money(pending)}</b><span>বাকি টাকা</span></div>
      </div>
      <div class="fq-sumbtns">
        <button class="fq-b ok sm" onclick="fqBulk()">✅ সবাইকে পরিশোধিত</button>
        <button class="fq-b sec sm" onclick="fqClassDefault()">⚙ সবার বেতন সেট</button>
      </div>`;
  }

  function matches(s) {
    const d = S.docs[s.id] || {};
    const st = stOf(d);
    if (S.filter === 'pending' && st === 'paid') return false;
    if (S.filter === 'paid' && st !== 'paid') return false;
    if (S.filter === 'due' && st !== 'due') return false;
    const q = S.q.trim();
    if (q) {
      const ql = toEnglishDigits(q).toLowerCase();
      const nm = String(s.name || '').toLowerCase();
      const rl = toEnglishDigits(s.roll);
      if (nm.indexOf(ql) < 0 && nm.indexOf(q.toLowerCase()) < 0 && rl !== ql) return false;
    }
    return true;
  }

  function renderList() {
    const el = $('fqList');
    if (!el) return;
    const all = studentsByClass(feesClassFilter);
    const list = all.filter(matches);
    const cnt = $('fqCount');
    if (cnt) cnt.textContent = 'দেখানো হচ্ছে: ' + bn(list.length) + ' জন (মোট ' + bn(all.length) + ' জন)';
    el.innerHTML = list.length ? list.map(cardWrap).join('') : '<p class="muted" style="text-align:center;padding:20px;">কেউ নেই</p>';
  }

  function render() {
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    const chip = (f, l) => '<button class="fq-chip ' + (S.filter === f ? 'on' : '') + '" data-f="' + f + '" onclick="fqFilter(\'' + f + '\')">' + l + '</button>';
    wrap.innerHTML = '<div class="fq-sum" id="fqSummary"></div>' +
      '<div class="fq-tools"><input type="search" id="fqSearch" placeholder="🔍 নাম বা রোল দিয়ে খুঁজুন" value="' + esc(S.q) + '" oninput="fqSearch(this.value)">' +
      '<div class="fq-chips">' + chip('all', 'সবাই') + chip('pending', 'বাকি') + chip('paid', 'পরিশোধিত') + chip('due', 'বকেয়া চিহ্নিত') + '</div></div>' +
      '<div class="fq-count" id="fqCount"></div><div id="fqList"></div>';
    refreshSummary();
    renderList();
  }

  window.fqFilter = function (f) {
    S.filter = f;
    document.querySelectorAll('.fq-chip').forEach(b => b.classList.toggle('on', b.getAttribute('data-f') === f));
    renderList();
  };
  window.fqSearch = function (v) { S.q = v || ''; renderList(); };

  // app.js-এর একই নামের ফাংশন বদলে দেওয়া হলো
  window.loadMonthlyFeesTeacher = function () {
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    const students = studentsByClass(feesClassFilter);
    if (students.length === 0) {
      wrap.innerHTML = '<div class="card"><p class="muted">কোনো শিক্ষার্থী নেই</p></div>';
      return;
    }
    const month = feesMonth;
    const tok = ++S.token;
    wrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
    Promise.all([
      loadDefaults(),
      db.collection('fees_monthly').where('madrasaId', '==', madrasaId).where('month', '==', month).get()
    ]).then(res => {
      if (tok !== S.token) return;
      S.month = month;
      S.docs = {};
      res[1].docs.forEach(d => { const x = d.data(); if (x.studentId) S.docs[x.studentId] = x; });
      render();
    }).catch(e => {
      if (tok !== S.token) return;
      wrap.innerHTML = '<div class="card"><p class="muted" style="color:#dc2626;">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) +
        '</p><button class="fq-b sec sm" onclick="loadMonthlyFeesTeacher()">আবার চেষ্টা করুন</button></div>';
      if (e.code !== 'permission-denied') showDiagBanner('বেতন লোড এরর: ' + e.message);
    });
  };

  // ---------- কাজগুলো ----------
  function payPatch(d, amt) {
    const newPaid = num(d.paidAmount) + amt;
    const total = d.totalAmount ? Math.max(num(d.totalAmount), newPaid) : amt;
    return { status: 'paid', amount: total, paidAmount: newPaid, paidDate: todayLocal() };
  }
  const readAmt = id => { const i = $('fqa_' + id); return num(i ? i.value : curAmount(id)); };

  window.fqAmt = function (id, val) {
    const d = S.docs[id] || {};
    if (d.status === 'paid') return;
    const v = num(val);
    const month = S.month;
    const hasPart = num(d.paidAmount) > 0;
    const entry = logEntry({ a: 'amount', old: num(d.amount), v });
    docRef(id, month).set({ studentId: id, month, madrasaId, amount: v, history: FV().arrayUnion(entry) }, { merge: true })
      .then(() => {
        if (S.month !== month) return;
        applyLocal(id, { amount: v }, entry);
        refreshSummary();
      }).catch(e => failMsg('বেতন সংরক্ষণ ব্যর্থ', e));

    if (hasPart || !(v > 0)) return;
    const def = num(S.defaults[id]);
    if (def === v) return;
    if (!def) { setDefaults({ [id]: v }); return; }
    modal({
      title: stu(id).name,
      body: 'আগে নির্ধারিত ছিল <b>' + money(def) + '</b>, এখন <b>' + money(v) + '</b>।<br>পরের মাসগুলোতেও কি এই পরিমাণ থাকবে?',
      buttons: [{ label: 'শুধু এই মাস', key: 'x', cls: 'sec' }, { label: 'পরের মাসেও', key: 'ok', cls: 'ok' }]
    }).then(r => { if (r.key === 'ok') setDefaults({ [id]: v }).then(ok => ok && toast('পরের মাসের জন্যও নির্ধারিত হলো')); });
  };

  window.fqPay = function (id) {
    const d = S.docs[id] || {};
    const amt = readAmt(id);
    if (!(amt > 0)) return toast('আগে বেতনের পরিমাণ লিখুন');
    modal({
      title: stu(id).name + ' — পরিশোধিত?',
      body: '<div class="fq-big">' + money(amt) + '</div>' + esc(feeMonthLabel(S.month)),
      buttons: [{ label: 'বাতিল', key: 'x', cls: 'sec' }, { label: '✓ নিশ্চিত', key: 'ok', cls: 'ok' }]
    }).then(r => {
      if (r.key !== 'ok') return;
      persist(id, payPatch(d, amt), { a: 'paid', v: amt }).then(ok => ok && toast('✓ পরিশোধিত করা হয়েছে'));
    });
  };

  window.fqPartial = function (id) {
    const d = S.docs[id] || {};
    const rem = readAmt(id);
    if (!(rem > 0)) return toast('আগে বেতনের পরিমাণ লিখুন');
    modal({
      title: stu(id).name + ' — আংশিক পরিশোধ',
      body: 'বাকি আছে <b>' + money(rem) + '</b>। কত টাকা দিয়েছে?',
      input: { value: '', ph: 'যত টাকা দিয়েছে' },
      buttons: [{ label: 'বাতিল', key: 'x', cls: 'sec' }, { label: 'সংরক্ষণ', key: 'ok', cls: 'ok' }]
    }).then(r => {
      if (r.key !== 'ok') return;
      const x = num(r.value);
      if (!(x > 0)) return;
      if (x >= rem) return toast('পুরো টাকা দিলে "পরিশোধিত" চাপুন');
      persist(id, {
        status: 'due',
        totalAmount: d.totalAmount ? num(d.totalAmount) : rem,
        paidAmount: num(d.paidAmount) + x,
        amount: rem - x
      }, { a: 'partial', v: x }).then(ok => ok && toast(money(x) + ' পেয়েছেন, বাকি ' + money(rem - x)));
    });
  };

  window.fqDue = function (id) {
    const amt = readAmt(id);
    if (!(amt > 0)) return toast('আগে বেতনের পরিমাণ লিখুন');
    persist(id, { status: 'due', amount: amt }, { a: 'due', v: amt }).then(ok => ok && toast('বকেয়া চিহ্নিত হয়েছে'));
  };

  window.fqFix = function (id) {
    const d = S.docs[id] || {};
    const cur = num(d.amount);
    modal({
      title: stu(id).name + ' — সংশোধন',
      body: 'পরিশোধিত আছে <b>' + money(cur) + '</b>। সঠিক পরিমাণ লিখুন, অথবা পরিশোধ বাতিল করুন।',
      input: { value: cur, ph: 'সঠিক পরিমাণ' },
      buttons: [
        { label: 'বন্ধ', key: 'x', cls: 'sec' },
        { label: 'পরিশোধ বাতিল', key: 'undo', cls: 'dng' },
        { label: 'সংশোধন', key: 'ok', cls: 'ok' }
      ]
    }).then(r => {
      if (r.key === 'undo') {
        persist(id, {
          status: 'due', amount: d.totalAmount ? num(d.totalAmount) : cur, paidAmount: 0, paidDate: ''
        }, { a: 'unpaid', old: cur }).then(ok => ok && toast('পরিশোধ বাতিল — আবার বকেয়া'));
        return;
      }
      if (r.key !== 'ok') return;
      const n = num(r.value);
      if (!(n > 0)) return toast('সঠিক পরিমাণ লিখুন');
      if (n === cur) return;
      persist(id, { amount: n, totalAmount: n, paidAmount: n }, { a: 'edit', old: cur, v: n })
        .then(ok => ok && toast('সংশোধন হয়েছে: ' + money(cur) + ' → ' + money(n)));
    });
  };

  window.fqHist = function (id) {
    const d = S.docs[id] || {};
    const txt = h => {
      const m = {
        paid: 'পরিশোধিত ' + money(h.v), partial: 'আংশিক ' + money(h.v), due: 'বকেয়া চিহ্নিত',
        unpaid: 'পরিশোধ বাতিল (ছিল ' + money(h.old) + ')', edit: 'সংশোধন ' + money(h.old) + ' → ' + money(h.v),
        amount: 'পরিমাণ ' + money(h.old) + ' → ' + money(h.v)
      };
      return (m[h.a] || h.a) + (h.bulk ? ' (একসাথে)' : '');
    };
    const rows = (d.history || []).slice().reverse().slice(0, 12)
      .map(h => '<div class="fq-h"><span>' + esc(h.d || '') + '</span><span>' + esc(txt(h)) + '</span></div>').join('');
    modal({
      title: stu(id).name + ' — ইতিহাস (' + feeMonthLabel(S.month) + ')',
      body: rows || 'কিছু নেই',
      buttons: [{ label: 'বন্ধ', key: 'x', cls: 'sec' }]
    });
  };

  window.fqBulk = function () {
    const students = studentsByClass(feesClassFilter);
    const month = S.month;
    const targets = [], skipped = [];
    students.forEach(s => {
      const d = S.docs[s.id] || {};
      if (d.status === 'paid') return;
      const amt = curAmount(s.id);
      if (amt > 0) targets.push({ s, d, amt }); else skipped.push(s);
    });
    if (targets.length === 0) return toast('পরিশোধিত করার মতো কেউ নেই');
    const total = targets.reduce((a, t) => a + t.amt, 0);
    const where = feesClassFilter === 'all' ? 'সকল শ্রেণির' : feesClassFilter + ' শ্রেণির';
    modal({
      title: 'সবাইকে পরিশোধিত?',
      body: where + ' <b>' + bn(targets.length) + ' জন</b> (' + esc(feeMonthLabel(month)) + ')<div class="fq-big">' + money(total) + '</div>' +
        (skipped.length ? '<span style="color:#b45309;">' + bn(skipped.length) + ' জনের পরিমাণ লেখা নেই, তারা বাদ যাবে।</span><br>' : '') +
        'এরপর যারা দেয়নি, শুধু তাদের "বকেয়া" বা "পরিশোধ বাতিল" করুন।',
      buttons: [{ label: 'বাতিল', key: 'x', cls: 'sec' }, { label: '✓ নিশ্চিত', key: 'ok', cls: 'ok' }]
    }).then(r => {
      if (r.key !== 'ok') return;
      const jobs = [], entries = {};
      for (let i = 0; i < targets.length; i += 200) {
        const batch = db.batch();
        targets.slice(i, i + 200).forEach(t => {
          const entry = logEntry({ a: 'paid', v: t.amt, bulk: true });
          entries[t.s.id] = entry;
          batch.set(docRef(t.s.id, month), Object.assign({ studentId: t.s.id, month, madrasaId }, payPatch(t.d, t.amt),
            { history: FV().arrayUnion(entry) }), { merge: true });
        });
        jobs.push(batch.commit());
      }
      Promise.all(jobs).then(() => {
        if (S.month === month) {
          targets.forEach(t => applyLocal(t.s.id, payPatch(t.d, t.amt), entries[t.s.id]));
          render();
        }
        toast('✓ ' + bn(targets.length) + ' জন পরিশোধিত');
      }).catch(e => failMsg('সবাইকে পরিশোধিত ব্যর্থ', e));
    });
  };

  window.fqClassDefault = function () {
    const students = studentsByClass(feesClassFilter);
    if (students.length === 0) return;
    const where = feesClassFilter === 'all' ? 'সকল শ্রেণির' : feesClassFilter + ' শ্রেণির';
    modal({
      title: 'সবার মাসিক বেতন সেট',
      body: where + ' <b>' + bn(students.length) + ' জনের</b> মাসিক বেতন কত টাকা?<br><span class="muted" style="font-size:12px;">পরে যে কারো আলাদাভাবে কমানো/বাড়ানো যাবে। আগে আলাদা পরিমাণ নির্ধারিত থাকলে তাও বদলে যাবে।</span>',
      input: { value: '', ph: 'যেমন: ৫০০' },
      buttons: [{ label: 'বাতিল', key: 'x', cls: 'sec' }, { label: 'সেট করুন', key: 'ok', cls: 'ok' }]
    }).then(r => {
      if (r.key !== 'ok') return;
      const v = num(r.value);
      if (!(v > 0)) return toast('সঠিক পরিমাণ লিখুন');
      const map = {};
      students.forEach(s => { map[s.id] = v; });
      setDefaults(map).then(ok => { if (ok) { render(); toast('সবার বেতন ' + money(v) + ' নির্ধারিত হলো'); } });
    });
  };
})();
