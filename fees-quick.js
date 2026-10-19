// ================= fees-quick.js (v3) — মাসিক বেতন + ভর্তি/পরীক্ষা ফি: সুন্দর ও দ্রুত এন্ট্রি =================
// index.html-এ সবার শেষে (class-teacher.js-এর পরে) লোড হবে। app.js ছুঁতে হয় না।
// বন্ধ করতে: index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
//  • ওপরে সারাংশ + আদায়ের প্রগ্রেস বার
//  • নাম/রোল খোঁজা, "সবাই / বাকি / পরিশোধিত" ফিল্টার
//  • ছোট সারিতে প্রতিজন: এক ট্যাপে নিচ থেকে ওঠা শিটে পরিমাণ দেখে "নিশ্চিত" করা
//  • আংশিক পরিশোধ, শুধু পরিমাণ বদলানো, পরিশোধ বাতিল, "ফিরিয়ে নিন" (Undo)
//  • পরিমাণ বদলালে "পরের মাসেও থাকুক" টিক, প্রতিটি পরিবর্তনের লগ
(function () {
  'use strict';

  const S = { mid: null, month: '', docs: {}, defaults: {}, defaultsOk: false, defaultsWarned: false,
    token: 0, filter: 'all', q: '', toastT: null };
  const $ = id => document.getElementById(id);
  const money = n => (typeof feeMoney === 'function') ? feeMoney(n) : (n + ' টাকা');
  const bn = n => toBanglaNumeral(n);
  const num = v => { const n = Number(toEnglishDigits(String(v == null ? '' : v)).trim()); return isNaN(n) ? 0 : n; };
  const FV = () => firebase.firestore.FieldValue;
  const docRef = (id, month) => db.collection('fees_monthly').doc(id + '_' + month);
  const stu = id => studentsCache.find(x => x.id === id) || { id, name: '' };
  const logEntry = a => Object.assign({ t: Date.now(), d: todayLocal() }, a);

  function fail(msg, e) {
    alert('সংরক্ষণ ব্যর্থ: ' + (e && e.message ? e.message : ''));
    showDiagBanner(msg + ': ' + (e && e.message ? e.message : ''));
  }

  // ---------- স্টাইল ----------
  const CSS = `
.fq-sum h3{margin:0 0 8px;font-size:17px}
.fq-bar{height:10px;border-radius:6px;background:#e2e8f0;overflow:hidden;margin:6px 0 10px}
.fq-bar i{display:block;height:100%;background:#16a34a;border-radius:6px;transition:width .3s}
.fq-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.fq-stat{border-radius:12px;padding:8px 4px;text-align:center;font-size:11.5px;line-height:1.4}
.fq-stat b{display:block;font-size:15px}
.fq-btn{display:block;width:100%;margin:0;border:0;border-radius:14px;padding:14px 10px;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fq-btn:active{opacity:.85}
.fq-btn.ok{background:#16a34a;color:#fff}.fq-btn.pri{background:#0F7B6C;color:#fff}
.fq-btn.ghost{background:#f1f5f9;color:#334155}.fq-btn.warn{background:#fef3c7;color:#92400e}.fq-btn.bad{background:#fee2e2;color:#991b1b}
.fq-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}
.fq-link{display:block;width:100%;margin:6px 0 0;background:transparent;border:0;color:#0F7B6C;font-weight:700;font-size:14px;padding:10px;font-family:inherit;cursor:pointer}
.fq-search{width:100%;box-sizing:border-box;padding:11px 14px;border:1px solid #cbd5e1;border-radius:14px;font-size:15px;margin:0 0 8px;font-family:inherit}
.fq-chip{display:inline-block;width:auto;margin:0 6px 10px 0;border:0;border-radius:20px;padding:7px 14px;font-size:13px;font-weight:700;background:#e2e8f0;color:#475569;font-family:inherit;cursor:pointer}
.fq-chip.on{background:#0F7B6C;color:#fff}
.fq-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border-radius:14px;margin:0 0 8px;border-left:5px solid #cbd5e1;box-shadow:0 1px 3px rgba(15,23,42,.07);cursor:pointer;-webkit-tap-highlight-color:transparent}
.fq-row:active{background:#f8fafc}
.fq-row.st-paid{border-left-color:#16a34a}.fq-row.st-part{border-left-color:#f59e0b}.fq-row.st-due{border-left-color:#dc2626}
.fq-av{width:38px;height:38px;border-radius:50%;background:#eef2ff;color:#3730a3;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;font-size:14px}
.fq-mid{flex:1;min-width:0}
.fq-nm{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fq-st{font-size:12px;margin-top:2px}
.fq-amt{font-weight:700;font-size:15px;white-space:nowrap;text-align:right}
.fq-go{width:40px;height:40px;border-radius:50%;border:0;background:#16a34a;color:#fff;font-size:20px;flex:none;padding:0;margin:0;cursor:pointer}
.fq-go.edit{background:#e2e8f0;color:#475569;font-size:16px}
.fq-bd{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,.45);z-index:2147483500;display:flex;align-items:flex-end}
.fq-pn{background:#fff;width:100%;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:22px 22px 0 0;padding:12px 16px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box;animation:fqUp .18s ease}
.fq-pn:before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:#cbd5e1;margin:0 auto 10px}
@keyframes fqUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.fq-ph{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px}
.fq-pt{font-size:18px;font-weight:700}
.fq-x{width:34px;height:34px;border-radius:50%;border:0;background:#f1f5f9;color:#475569;font-size:16px;padding:0;margin:0;flex:none;cursor:pointer}
.fq-lb{display:block;font-size:13px;color:#475569;margin-top:6px}
.fq-in{width:100%;box-sizing:border-box;font-size:24px;font-weight:700;padding:12px 14px;border:2px solid #cbd5e1;border-radius:14px;text-align:center;margin:6px 0 10px;font-family:inherit}
.fq-in:focus{border-color:#0F7B6C;outline:none}
.fq-chkl{display:flex;align-items:flex-start;gap:8px;font-size:13.5px;margin:0 0 12px;color:#334155}
.fq-chkl input{width:auto;margin-top:3px}
.fq-note{background:#fef3c7;color:#92400e;border-radius:12px;padding:9px 12px;font-size:13.5px;margin-bottom:6px}
.fq-paid{background:#dcfce7;color:#166534;border-radius:12px;padding:12px;font-weight:700;font-size:17px;text-align:center;margin-bottom:6px}
.fq-paid small{display:block;font-weight:400;font-size:12px;margin-top:2px}
.fq-err{color:#dc2626;font-size:13px;min-height:18px;margin:0 0 6px}
.fq-hist{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:12px;color:#64748b}
.fq-hist div{padding:2px 0}
.fq-toast{position:fixed;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));background:#0f172a;color:#fff;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:2147483600;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.fq-toast button{margin:0 0 0 auto;width:auto;background:transparent;color:#5eead4;border:0;font-weight:700;font-size:14px;padding:4px 8px;font-family:inherit;cursor:pointer}
`;
  function ensureStyle() {
    if ($('fqStyles')) return;
    const st = document.createElement('style');
    st.id = 'fqStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---------- ডিফল্ট বেতন (fee_defaults/{madrasaId}.amounts) ----------
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
      .then(() => { Object.assign(S.defaults, map); S.defaultsOk = true; })
      .catch(e => {
        if (!S.defaultsWarned) {
          S.defaultsWarned = true;
          alert('নির্ধারিত বেতন জমা হয়নি। firestore.rules-এ fee_defaults ব্লকটি যোগ করে Publish করা হয়েছে কি?');
        }
        showDiagBanner('fee_defaults সংরক্ষণ ব্যর্থ: ' + e.message);
      });
  }

  function curAmount(id) {
    const d = S.docs[id] || {};
    return num(d.amount) > 0 ? num(d.amount) : num(S.defaults[id]);
  }

  function shortDate(ds) {
    const p = String(ds || '').split('-').map(Number);
    return p.length === 3 && !p.some(isNaN) ? bn(p[2]) + '/' + bn(p[1]) : '';
  }

  function info(s) {
    const d = S.docs[s.id] || {};
    if (d.status === 'paid')
      return { kind: 'paid', cls: 'st-paid', color: '#166534', text: '✓ পরিশোধিত' + (d.paidDate ? ' · ' + shortDate(d.paidDate) : ''), amt: num(d.amount) };
    if (num(d.paidAmount) > 0)
      return { kind: 'part', cls: 'st-part', color: '#b45309', text: 'আংশিক · বাকি ' + money(d.amount), amt: num(d.amount) };
    if (d.status === 'due')
      return { kind: 'due', cls: 'st-due', color: '#b91c1c', text: 'বকেয়া', amt: curAmount(s.id) };
    return { kind: 'none', cls: '', color: '#64748b', text: 'এখনো চিহ্নিত নয়', amt: curAmount(s.id) };
  }

  // ---------- লেখা (history সহ) ----------
  function applyLocal(id, patch, entry) {
    const old = S.docs[id] || {};
    S.docs[id] = Object.assign({ studentId: id, month: S.month }, old, patch,
      { history: (old.history || []).concat(entry ? [entry] : []) });
  }

  function persist(id, patch, log) {
    const month = S.month, entry = logEntry(log);
    const data = Object.assign({ studentId: id, month, madrasaId }, patch, { history: FV().arrayUnion(entry) });
    return docRef(id, month).set(data, { merge: true }).then(() => {
      if (S.month === month) { applyLocal(id, patch, entry); renderList(); refreshSummary(); }
      return true;
    }).catch(e => { fail('বেতন সংরক্ষণ ব্যর্থ', e); return false; });
  }

  function payPatch(d, amt) {
    const newPaid = num(d.paidAmount) + amt;
    const total = d.totalAmount ? Math.max(num(d.totalAmount), newPaid) : amt;
    return { status: 'paid', amount: total, paidAmount: newPaid, paidDate: todayLocal() };
  }

  const restorePatch = p => ({ status: p.status || '', amount: num(p.amount), paidAmount: num(p.paidAmount),
    totalAmount: num(p.totalAmount), paidDate: p.paidDate || '' });

  // কাজ করো → শিট বন্ধ → "ফিরিয়ে নিন" সহ টোস্ট
  function act(id, patch, log, msg) {
    const prev = Object.assign({}, S.docs[id] || {});
    closeSheet();
    persist(id, patch, log).then(ok => {
      if (!ok) return;
      toast(msg, () => persist(id, restorePatch(prev), { a: 'undo' }).then(() => toast('ফিরিয়ে নেওয়া হয়েছে')));
    });
  }

  // ---------- টোস্ট ও শিট ----------
  function toast(msg, undoFn) {
    const old = $('fqToast'); if (old) old.remove();
    if (S.toastT) clearTimeout(S.toastT);
    const t = document.createElement('div');
    t.className = 'fq-toast'; t.id = 'fqToast';
    const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
    if (undoFn) {
      const b = document.createElement('button'); b.textContent = 'ফিরিয়ে নিন';
      b.onclick = () => { t.remove(); undoFn(); };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    S.toastT = setTimeout(() => { if (t.isConnected) t.remove(); }, undoFn ? 7000 : 2500);
  }

  function openSheet(html) {
    closeSheet();
    const bd = document.createElement('div');
    bd.className = 'fq-bd'; bd.id = 'fqBd';
    bd.onclick = e => { if (e.target === bd) closeSheet(); };
    bd.innerHTML = '<div class="fq-pn">' + html + '</div>';
    document.body.appendChild(bd);
  }
  function closeSheet() { const b = $('fqBd'); if (b) b.remove(); }
  window.fqClose = closeSheet;
  function sheetErr(msg) { const e = $('fqErr'); if (e) e.textContent = msg; }

  function sheetHead(title, sub) {
    return '<div class="fq-ph"><div><div class="fq-pt">' + esc(title) + '</div>' +
      (sub ? '<div class="muted" style="font-size:12px;">' + sub + '</div>' : '') +
      '</div><button class="fq-x" onclick="fqClose()">✕</button></div>';
  }

  // ---------- তালিকা ----------
  function rowHtml(s) {
    const i = info(s), idq = jsq(s.id);
    const av = s.roll ? esc(bn(String(s.roll))) : esc(String(s.name || '?').charAt(0));
    const amtHtml = i.amt > 0 ? money(i.amt) : '<span style="color:#b45309;font-size:12px;">পরিমাণ দিন</span>';
    const btn = i.kind === 'paid'
      ? '<button class="fq-go edit" onclick="event.stopPropagation();fqOpen(\'' + idq + '\')">✎</button>'
      : '<button class="fq-go" onclick="event.stopPropagation();fqOpen(\'' + idq + '\')">✓</button>';
    return '<div class="fq-row ' + i.cls + '" id="fee_' + esc(s.id) + '" onclick="fqOpen(\'' + idq + '\')">' +
      '<div class="fq-av">' + av + '</div>' +
      '<div class="fq-mid"><div class="fq-nm">' + esc(s.name) + '</div>' +
      '<div class="fq-st" style="color:' + i.color + ';">' + esc(i.text) +
      (feesClassFilter === 'all' && s.className ? ' <span class="muted">· ' + esc(s.className) + '</span>' : '') + '</div></div>' +
      '<div class="fq-amt">' + amtHtml + '</div>' + btn + '</div>';
  }

  function renderList() {
    const el = $('fqList');
    if (!el) return;
    const all = studentsByClass(feesClassFilter);
    const q = S.q.trim().toLowerCase(), qd = toEnglishDigits(q);
    const list = all.filter(s => {
      if (q) {
        const nm = String(s.name || '').toLowerCase();
        const r = toEnglishDigits(String(s.roll || ''));
        if (nm.indexOf(q) < 0 && r !== qd) return false;
      }
      const k = info(s).kind;
      if (S.filter === 'due' && k === 'paid') return false;
      if (S.filter === 'paid' && k !== 'paid') return false;
      return true;
    });
    el.innerHTML = list.length ? list.map(rowHtml).join('')
      : '<div class="card"><p class="muted" style="text-align:center;margin:0;">কেউ নেই</p></div>';
    let paid = 0;
    all.forEach(s => { if (info(s).kind === 'paid') paid++; });
    const set = (id, label, n, on) => { const c = $(id); if (c) { c.textContent = label + ' (' + bn(n) + ')'; c.className = 'fq-chip' + (on ? ' on' : ''); } };
    set('fqc_all', 'সবাই', all.length, S.filter === 'all');
    set('fqc_due', 'বাকি', all.length - paid, S.filter === 'due');
    set('fqc_paid', 'পরিশোধিত', paid, S.filter === 'paid');
  }

  function refreshSummary() {
    const el = $('fqSummary');
    if (!el) return;
    const students = studentsByClass(feesClassFilter);
    let paidN = 0, collected = 0, pending = 0;
    students.forEach(s => {
      const d = S.docs[s.id] || {};
      if (d.status === 'paid') { paidN++; collected += num(d.amount); }
      else { collected += num(d.paidAmount); pending += curAmount(s.id); }
    });
    const total = collected + pending;
    const pct = total > 0 ? Math.round(collected / total * 100) : 0;
    el.innerHTML = `
      <div class="fq-sum">
        <h3>${esc(feeMonthLabel(S.month))} <span class="muted" style="font-size:13px;font-weight:400;">— ${bn(paidN)}/${bn(students.length)} জন পরিশোধিত</span></h3>
        <div class="fq-bar"><i style="width:${pct}%"></i></div>
        <div class="fq-stats">
          <div class="fq-stat" style="background:#dcfce7;color:#166534;">আদায়<b>${money(collected)}</b></div>
          <div class="fq-stat" style="background:#fee2e2;color:#991b1b;">বাকি<b>${money(pending)}</b></div>
          <div class="fq-stat" style="background:#eef2ff;color:#3730a3;">মোট<b>${money(total)}</b></div>
        </div>
        <div class="fq-two" style="margin:0;">
          <button class="fq-btn ok" style="font-size:14px;padding:11px 6px;" onclick="fqBulk()">✅ সবাইকে পরিশোধিত</button>
          <button class="fq-btn ghost" style="font-size:14px;padding:11px 6px;" onclick="fqClassDefault()">⚙ সবার বেতন সেট</button>
        </div>
      </div>`;
  }

  function render() {
    ensureStyle();
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="card" id="fqSummary"></div>' +
      '<input id="fqSearch" class="fq-search" type="search" placeholder="🔍 নাম বা রোল খুঁজুন" value="' + esc(S.q) + '" oninput="fqSearch(this.value)">' +
      '<div><button class="fq-chip" id="fqc_all" onclick="fqFilter(\'all\')"></button>' +
      '<button class="fq-chip" id="fqc_due" onclick="fqFilter(\'due\')"></button>' +
      '<button class="fq-chip" id="fqc_paid" onclick="fqFilter(\'paid\')"></button></div>' +
      '<div id="fqList"></div>';
    refreshSummary();
    renderList();
  }

  window.fqFilter = f => { S.filter = f; renderList(); };
  window.fqSearch = v => { S.q = v; renderList(); };

  // app.js-এর একই নামের ফাংশন বদলে দেওয়া হলো
  window.loadMonthlyFeesTeacher = function () {
    ensureStyle();
    otStop();
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    if (studentsByClass(feesClassFilter).length === 0) {
      wrap.innerHTML = '<div class="card"><p class="muted">কোনো শিক্ষার্থী নেই</p></div>';
      return;
    }
    const month = feesMonth, tok = ++S.token;
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
        '</p><button class="fq-btn ghost" onclick="loadMonthlyFeesTeacher()">আবার চেষ্টা করুন</button></div>';
      if (e.code !== 'permission-denied') showDiagBanner('বেতন লোড এরর: ' + e.message);
    });
  };

  // ---------- শিক্ষার্থীর শিট ----------
  const HL = { paid: 'পরিশোধিত', partial: 'আংশিক', due: 'বকেয়া', amount: 'পরিমাণ', unpaid: 'পরিশোধ বাতিল', edit: 'সংশোধন', undo: 'ফিরিয়ে নেওয়া' };
  function historyHtml(d) {
    const h = (d.history || []).slice(-4).reverse();
    if (!h.length) return '';
    return '<div class="fq-hist"><b>সাম্প্রতিক পরিবর্তন</b>' + h.map(x => {
      let t = HL[x.a] || '';
      if (x.old != null && x.v != null) t += ': ' + money(x.old) + ' → ' + money(x.v);
      else if (x.v != null) t += ': ' + money(x.v);
      else if (x.old != null) t += ' (ছিল ' + money(x.old) + ')';
      return '<div>' + esc(shortDate(x.d)) + ' — ' + esc(t) + '</div>';
    }).join('') + '</div>';
  }

  window.fqOpen = function (id) {
    const s = stu(id), d = S.docs[id] || {}, i = info(s), idq = jsq(id);
    const def = num(S.defaults[id]);
    const head = sheetHead(s.name, esc(s.className || '-') + (s.roll ? ' · রোল ' + esc(s.roll) : '') + ' · ' + esc(feeMonthLabel(S.month)));
    let body;
    if (i.kind === 'paid') {
      body = `<div class="fq-paid">✓ পরিশোধিত — ${money(d.amount)}${d.paidDate ? '<small>' + esc(d.paidDate) + '</small>' : ''}</div>
        <label class="fq-lb">পরিমাণ সংশোধন (টাকা)</label>
        <input class="fq-in" id="fqAmt" type="number" inputmode="numeric" value="${esc(num(d.amount))}">
        <div class="fq-err" id="fqErr"></div>
        <button class="fq-btn pri" onclick="fqDoFix('${idq}')">সংশোধন সংরক্ষণ করুন</button>
        <div style="height:8px"></div>
        <button class="fq-btn bad" id="fqUnpayBtn" onclick="fqUnpay('${idq}')">পরিশোধ বাতিল করুন (আবার বকেয়া)</button>`;
    } else {
      const hasPart = num(d.paidAmount) > 0;
      body = (hasPart ? `<div class="fq-note">মোট ${money(d.totalAmount)} · দিয়েছে ${money(d.paidAmount)} · বাকি ${money(d.amount)}</div>` : '') +
        `<label class="fq-lb">${hasPart ? 'বাকি পরিমাণ (টাকা)' : 'বেতনের পরিমাণ (টাকা)'}</label>
        <input class="fq-in" id="fqAmt" type="number" inputmode="numeric" value="${esc(i.amt || '')}">` +
        (hasPart ? '' : `<label class="fq-chkl"><input type="checkbox" id="fqKeep" ${def ? '' : 'checked'}>
          <span>পরের মাসগুলোতেও এই পরিমাণ থাকুক${def ? ' <span class="muted">(এখন নির্ধারিত ' + money(def) + ')</span>' : ''}</span></label>`) +
        `<div class="fq-err" id="fqErr"></div>
        <button class="fq-btn ok" onclick="fqDoPay('${idq}')">✓ পরিশোধিত নিশ্চিত করুন</button>
        <div class="fq-two">
          <button class="fq-btn warn" onclick="fqTogglePart()">আংশিক</button>
          <button class="fq-btn bad" onclick="fqDoDue('${idq}')">বকেয়া রাখুন</button>
        </div>
        <div id="fqPartBox" style="display:none;">
          <label class="fq-lb">এখন কত টাকা দিল?</label>
          <input class="fq-in" id="fqPartAmt" type="number" inputmode="numeric">
          <button class="fq-btn pri" onclick="fqDoPartial('${idq}')">আংশিক জমা নিশ্চিত করুন</button>
        </div>
        <button class="fq-link" onclick="fqDoAmountOnly('${idq}')">শুধু পরিমাণ সংরক্ষণ করুন (স্ট্যাটাস না বদলে)</button>`;
    }
    openSheet(head + body + historyHtml(d));
  };

  window.fqTogglePart = function () {
    const b = $('fqPartBox');
    if (!b) return;
    b.style.display = b.style.display === 'none' ? 'block' : 'none';
    if (b.style.display === 'block') { const i = $('fqPartAmt'); if (i) i.focus(); }
  };

  function readAmt() { const e = $('fqAmt'); return num(e ? e.value : 0); }
  function keepChecked() { const k = $('fqKeep'); return !!(k && k.checked); }

  window.fqDoPay = function (id) {
    const d = S.docs[id] || {}, amt = readAmt();
    if (!(amt > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    if (keepChecked()) setDefaults({ [id]: amt });
    act(id, payPatch(d, amt), { a: 'paid', v: amt }, '✓ ' + stu(id).name + ' — ' + money(amt) + ' পরিশোধিত');
  };

  window.fqDoDue = function (id) {
    const amt = readAmt();
    if (!(amt > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    if (keepChecked()) setDefaults({ [id]: amt });
    act(id, { status: 'due', amount: amt }, { a: 'due', v: amt }, stu(id).name + ' — বকেয়া চিহ্নিত');
  };

  window.fqDoAmountOnly = function (id) {
    const d = S.docs[id] || {}, amt = readAmt();
    if (!(amt > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    if (keepChecked()) setDefaults({ [id]: amt });
    act(id, { amount: amt }, { a: 'amount', old: num(d.amount), v: amt }, 'পরিমাণ সংরক্ষিত — ' + money(amt));
  };

  window.fqDoPartial = function (id) {
    const d = S.docs[id] || {}, rem = readAmt();
    const px = $('fqPartAmt'), x = num(px ? px.value : 0);
    if (!(rem > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    if (!(x > 0)) return sheetErr('কত টাকা দিয়েছে লিখুন');
    if (x >= rem) return sheetErr('পুরো টাকা দিলে "পরিশোধিত নিশ্চিত করুন" চাপুন');
    if (keepChecked() && !(num(d.paidAmount) > 0)) setDefaults({ [id]: rem });
    act(id, {
      status: 'due',
      totalAmount: d.totalAmount ? num(d.totalAmount) : rem,
      paidAmount: num(d.paidAmount) + x,
      amount: rem - x
    }, { a: 'partial', v: x }, stu(id).name + ' — ' + money(x) + ' জমা, বাকি ' + money(rem - x));
  };

  window.fqDoFix = function (id) {
    const d = S.docs[id] || {}, cur = num(d.amount), n = readAmt();
    if (!(n > 0)) return sheetErr('সঠিক পরিমাণ লিখুন (পরিশোধ বাতিল করতে নিচের লাল বাটন চাপুন)');
    if (n === cur) return closeSheet();
    act(id, { amount: n, totalAmount: n, paidAmount: n }, { a: 'edit', old: cur, v: n },
      'সংশোধিত — ' + money(cur) + ' → ' + money(n));
  };

  window.fqUnpay = function (id) {
    const b = $('fqUnpayBtn');
    if (!b) return;
    const label = 'পরিশোধ বাতিল করুন (আবার বকেয়া)';
    if (!b.dataset.sure) {
      b.dataset.sure = '1';
      b.textContent = 'নিশ্চিত? আবার চাপুন';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = label; } }, 4000);
      return;
    }
    const d = S.docs[id] || {}, cur = num(d.amount);
    act(id, { status: 'due', amount: d.totalAmount ? num(d.totalAmount) : cur, paidAmount: 0, paidDate: '' },
      { a: 'unpaid', old: cur }, stu(id).name + ' — পরিশোধ বাতিল, বকেয়া');
  };

  // ---------- সবাইকে পরিশোধিত ----------
  function bulkTargets() {
    const targets = [], skipped = [];
    studentsByClass(feesClassFilter).forEach(s => {
      const d = S.docs[s.id] || {};
      if (d.status === 'paid') return;
      const amt = curAmount(s.id);
      if (amt > 0) targets.push({ s, d, amt }); else skipped.push(s);
    });
    return { targets, skipped };
  }

  window.fqBulk = function () {
    const { targets, skipped } = bulkTargets();
    if (!targets.length) return toast('পরিশোধিত করার মতো কেউ নেই (সবাই পরিশোধিত, অথবা পরিমাণ লেখা নেই)');
    const total = targets.reduce((a, t) => a + t.amt, 0);
    const where = feesClassFilter === 'all' ? 'সকল শ্রেণির' : feesClassFilter + ' শ্রেণির';
    openSheet(sheetHead('সবাইকে পরিশোধিত', esc(feeMonthLabel(S.month))) +
      `<div class="fq-paid" style="background:#eef2ff;color:#3730a3;">${esc(where)} ${bn(targets.length)} জন<small style="font-size:15px;font-weight:700;">মোট ${money(total)}</small></div>` +
      (skipped.length ? `<div class="fq-note">${bn(skipped.length)} জনের পরিমাণ লেখা নেই, তারা বাদ যাবে।</div>` : '') +
      '<p class="muted" style="font-size:13px;">যারা দেয়নি, পরে তাদের খুলে "বকেয়া রাখুন" চাপুন।</p>' +
      '<button class="fq-btn ok" onclick="fqBulkGo()">✓ নিশ্চিত করুন</button>');
  };

  window.fqBulkGo = function () {
    const { targets } = bulkTargets(), month = S.month;
    if (!targets.length) return closeSheet();
    closeSheet();
    const jobs = [];
    for (let i = 0; i < targets.length; i += 200) {
      const batch = db.batch();
      targets.slice(i, i + 200).forEach(t => {
        batch.set(docRef(t.s.id, month), Object.assign({ studentId: t.s.id, month, madrasaId }, payPatch(t.d, t.amt),
          { history: FV().arrayUnion(logEntry({ a: 'paid', v: t.amt })) }), { merge: true });
      });
      jobs.push(batch.commit());
    }
    Promise.all(jobs).then(() => {
      if (S.month === month) {
        targets.forEach(t => applyLocal(t.s.id, payPatch(t.d, t.amt), logEntry({ a: 'paid', v: t.amt })));
        renderList(); refreshSummary();
      }
      toast('✓ ' + bn(targets.length) + ' জনকে পরিশোধিত করা হয়েছে');
    }).catch(e => fail('সবাইকে পরিশোধিত ব্যর্থ', e));
  };

  // ---------- শ্রেণির সবার নির্ধারিত বেতন ----------
  window.fqClassDefault = function () {
    const n = studentsByClass(feesClassFilter).length;
    if (!n) return;
    const where = feesClassFilter === 'all' ? 'সকল শ্রেণির' : feesClassFilter + ' শ্রেণির';
    openSheet(sheetHead('সবার মাসিক বেতন সেট', esc(where) + ' ' + bn(n) + ' জন') +
      `<label class="fq-lb">প্রতিজনের মাসিক বেতন (টাকা)</label>
      <input class="fq-in" id="fqAmt" type="number" inputmode="numeric" placeholder="যেমন ৫০০">
      <div class="fq-err" id="fqErr"></div>
      <p class="muted" style="font-size:13px;margin:0 0 10px;">আগে আলাদা পরিমাণ নির্ধারিত থাকলে তাও বদলে যাবে। পরে যে কারো বেতন আলাদাভাবে কমানো-বাড়ানো যাবে।</p>
      <button class="fq-btn pri" onclick="fqClassGo()">সেট করুন</button>`);
  };

  window.fqClassGo = function () {
    const v = readAmt();
    if (!(v > 0)) return sheetErr('সঠিক পরিমাণ লিখুন');
    const map = {};
    studentsByClass(feesClassFilter).forEach(s => { map[s.id] = v; });
    closeSheet();
    setDefaults(map).then(() => { renderList(); refreshSummary(); toast('✓ সবার মাসিক বেতন ' + money(v) + ' সেট হয়েছে'); });
  };

  // =================== ভর্তি / পরীক্ষা ফি (fees_onetime) ===================
  // এক ক্লিকে শ্রেণির সবার জন্য ফি চালু, এক ট্যাপে পরিশোধিত, আংশিক, সংশোধন, মোছা — সবই আগের মতো শিটে।
  const O = { items: [], type: '', unsub: null, names: [] };
  const tkey = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const origOtCtl = window.renderOnetimeFeesControls;
  const otItem = id => O.items.find(i => i.id === id);

  function otStop() { if (O.unsub) { try { O.unsub(); } catch (e) { /* ignore */ } O.unsub = null; } }

  window.renderOnetimeFeesControls = function (isTeacher) {
    if (!isTeacher) return origOtCtl.apply(this, arguments);
    ensureStyle();
    const c = $('feesControlsWrap');
    if (!c) return;
    c.innerHTML = '<div id="feesClassFilterWrap"></div>' +
      '<button class="fq-btn pri" style="margin-top:10px;" onclick="otNew()">➕ নতুন ফি চালু করুন (শ্রেণির সবার জন্য)</button>' +
      '<button class="fq-link" onclick="otNewOne()">একজন শিক্ষার্থীর জন্য ফি যোগ করুন</button>';
    $('feesClassFilterWrap').innerHTML = classFilterDropdownHtml(feesClassFilter, 'onFeesClassFilterChange');
    window.loadOnetimeFeesTeacher();
  };

  window.loadOnetimeFeesTeacher = function () {
    ensureStyle();
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    otStop();
    wrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
    O.unsub = db.collection('fees_onetime').where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        O.items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        renderOt();
      }, err => {
        const w = $('feesResultWrap');
        if (w) w.innerHTML = '<div class="card"><p class="muted" style="color:#dc2626;">লোড করতে সমস্যা হয়েছে: ' + esc(err.message) + '</p></div>';
        if (err.code !== 'permission-denied') showDiagBanner('ফি লোড এরর: ' + err.message);
      });
  };

  function otInfo(i) {
    if (i.status === 'paid') return { kind: 'paid', cls: 'st-paid', color: '#166534', text: '✓ পরিশোধিত' + (i.paidDate ? ' · ' + shortDate(i.paidDate) : '') };
    if (num(i.paidAmount) > 0) return { kind: 'part', cls: 'st-part', color: '#b45309', text: 'আংশিক · বাকি ' + money(i.amount) };
    return { kind: 'due', cls: 'st-due', color: '#b91c1c', text: 'বকেয়া' };
  }

  function otScope() {
    const ids = {};
    studentsByClass(feesClassFilter).forEach(s => { ids[s.id] = true; });
    return O.items.filter(i => ids[i.studentId]);
  }

  function otShown() {
    const order = {};
    studentsCache.forEach((s, n) => { order[s.id] = n; });
    return otScope().filter(i => !O.type || tkey(i.feeType) === O.type)
      .sort((a, b) => ((order[a.studentId] || 0) - (order[b.studentId] || 0)) || ((a.createdAt || 0) - (b.createdAt || 0)));
  }

  function otRow(i) {
    const s = stu(i.studentId), inf = otInfo(i), idq = jsq(i.id);
    const av = s.roll ? esc(bn(String(s.roll))) : esc(String(s.name || '?').charAt(0));
    const btn = inf.kind === 'paid'
      ? '<button class="fq-go edit" onclick="event.stopPropagation();otOpen(\'' + idq + '\')">✎</button>'
      : '<button class="fq-go" onclick="event.stopPropagation();otOpen(\'' + idq + '\')">✓</button>';
    return '<div class="fq-row ' + inf.cls + '" onclick="otOpen(\'' + idq + '\')">' +
      '<div class="fq-av">' + av + '</div>' +
      '<div class="fq-mid"><div class="fq-nm">' + esc(s.name) + '</div>' +
      '<div class="fq-st" style="color:' + inf.color + ';">' + (O.type ? '' : esc(i.feeType || 'ফি') + ' · ') + esc(inf.text) +
      (feesClassFilter === 'all' && s.className ? ' <span class="muted">· ' + esc(s.className) + '</span>' : '') + '</div></div>' +
      '<div class="fq-amt">' + money(i.status === 'paid' ? i.amount : i.amount) + '</div>' + btn + '</div>';
  }

  function renderOt() {
    if (feesMode !== 'onetime' || !currentFeesIsTeacher || !$('feesResultWrap')) { otStop(); return; }
    const wrap = $('feesResultWrap');
    const scope = otScope();
    if (!scope.length) {
      wrap.innerHTML = '<div class="card"><p class="muted" style="text-align:center;margin:0;">এখনো কোনো ফি নেই।<br>ওপরের "➕ নতুন ফি চালু করুন" চেপে ভর্তি/পরীক্ষা ফি এক ক্লিকে সবার জন্য দিন।</p></div>';
      return;
    }
    const seen = {}, types = [];
    scope.forEach(i => { const k = tkey(i.feeType); if (k && !seen[k]) { seen[k] = 1; types.push({ k, label: String(i.feeType || 'ফি') }); } });
    if (O.type && !seen[O.type]) O.type = '';
    O.typeKeys = types.map(t => t.k);

    const shown = otShown();
    let collected = 0, pending = 0, paidN = 0;
    shown.forEach(i => {
      if (i.status === 'paid') { collected += num(i.amount); paidN++; }
      else { collected += num(i.paidAmount); pending += num(i.amount); }
    });
    const total = collected + pending, pct = total > 0 ? Math.round(collected / total * 100) : 0;
    const label = O.type ? (types.find(t => t.k === O.type) || {}).label : 'সব ফি';

    const chips = '<button class="fq-chip' + (O.type ? '' : ' on') + '" onclick="otType(-1)">সব ধরন</button>' +
      types.map((t, n) => '<button class="fq-chip' + (O.type === t.k ? ' on' : '') + '" onclick="otType(' + n + ')">' + esc(t.label) + '</button>').join('');

    wrap.innerHTML = `
      <div class="card"><div class="fq-sum">
        <h3>${esc(label)} <span class="muted" style="font-size:13px;font-weight:400;">— ${bn(paidN)}/${bn(shown.length)} জন পরিশোধিত</span></h3>
        <div class="fq-bar"><i style="width:${pct}%"></i></div>
        <div class="fq-stats">
          <div class="fq-stat" style="background:#dcfce7;color:#166534;">আদায়<b>${money(collected)}</b></div>
          <div class="fq-stat" style="background:#fee2e2;color:#991b1b;">বাকি<b>${money(pending)}</b></div>
          <div class="fq-stat" style="background:#eef2ff;color:#3730a3;">মোট<b>${money(total)}</b></div>
        </div>
        <div class="fq-two" style="margin:0;">
          <button class="fq-btn ok" style="font-size:14px;padding:11px 6px;" onclick="otBulkPay()">✅ সবাইকে পরিশোধিত</button>
          ${O.type ? '<button class="fq-btn ghost" style="font-size:14px;padding:11px 6px;" onclick="otBulkDelete()">🗑 বাতিল (যারা দেয়নি)</button>' : '<span></span>'}
        </div>
      </div></div>
      <div>${chips}</div>
      ${shown.map(otRow).join('')}`;
  }

  window.otType = n => { O.type = n < 0 ? '' : (O.typeKeys[n] || ''); renderOt(); };

  // ---------- এক ফি-র একজনের শিট ----------
  window.otOpen = function (id) {
    const i = otItem(id);
    if (!i) return;
    const s = stu(i.studentId), inf = otInfo(i), idq = jsq(id);
    const head = sheetHead(s.name, esc(s.className || '-') + (s.roll ? ' · রোল ' + esc(s.roll) : '') + ' · ' + esc(i.feeType || 'ফি') + (i.date ? ' · ' + esc(i.date) : ''));
    let body;
    if (inf.kind === 'paid') {
      body = `<div class="fq-paid">✓ পরিশোধিত — ${money(i.amount)}${i.paidDate ? '<small>' + esc(i.paidDate) + '</small>' : ''}</div>
        <label class="fq-lb">পরিমাণ সংশোধন (টাকা)</label>
        <input class="fq-in" id="fqAmt" type="number" inputmode="numeric" value="${esc(num(i.amount))}">
        <div class="fq-err" id="fqErr"></div>
        <button class="fq-btn pri" onclick="otDoFix('${idq}')">সংশোধন সংরক্ষণ করুন</button>
        <div style="height:8px"></div>
        <button class="fq-btn bad" id="fqUnpayBtn" onclick="otUnpay('${idq}')">পরিশোধ বাতিল করুন (আবার বকেয়া)</button>`;
    } else {
      const hasPart = num(i.paidAmount) > 0;
      body = (hasPart ? `<div class="fq-note">মোট ${money(i.totalAmount)} · দিয়েছে ${money(i.paidAmount)} · বাকি ${money(i.amount)}</div>` : '') +
        `<label class="fq-lb">${hasPart ? 'বাকি পরিমাণ (টাকা)' : 'ফি-র পরিমাণ (টাকা)'}</label>
        <input class="fq-in" id="fqAmt" type="number" inputmode="numeric" value="${esc(num(i.amount) || '')}">
        <div class="fq-err" id="fqErr"></div>
        <button class="fq-btn ok" onclick="otDoPay('${idq}')">✓ পরিশোধিত নিশ্চিত করুন</button>
        <div class="fq-two">
          <button class="fq-btn warn" onclick="fqTogglePart()">আংশিক</button>
          <button class="fq-btn ghost" onclick="otDoAmount('${idq}')">পরিমাণ সংরক্ষণ</button>
        </div>
        <div id="fqPartBox" style="display:none;">
          <label class="fq-lb">এখন কত টাকা দিল?</label>
          <input class="fq-in" id="fqPartAmt" type="number" inputmode="numeric">
          <button class="fq-btn pri" onclick="otDoPartial('${idq}')">আংশিক জমা নিশ্চিত করুন</button>
        </div>`;
    }
    body += '<button class="fq-link" style="color:#b91c1c;" id="otDelBtn" onclick="otDelete(\'' + idq + '\')">🗑 এই ফি মুছে ফেলুন</button>';
    openSheet(head + body + historyHtml(i));
  };

  const otRestore = p => ({ status: p.status || 'due', amount: num(p.amount), paidAmount: num(p.paidAmount),
    totalAmount: num(p.totalAmount), paidDate: p.paidDate || '' });

  function otWrite(id, patch, log) {
    return db.collection('fees_onetime').doc(id)
      .set(Object.assign({}, patch, { history: FV().arrayUnion(logEntry(log)) }), { merge: true })
      .then(() => true).catch(e => { fail('ফি সংরক্ষণ ব্যর্থ', e); return false; });
  }

  function otAct(id, patch, log, msg) {
    const prev = Object.assign({}, otItem(id) || {});
    closeSheet();
    otWrite(id, patch, log).then(ok => {
      if (ok) toast(msg, () => otWrite(id, otRestore(prev), { a: 'undo' }).then(() => toast('ফিরিয়ে নেওয়া হয়েছে')));
    });
  }

  const otName = id => { const i = otItem(id); return i ? stu(i.studentId).name : ''; };

  window.otDoPay = function (id) {
    const i = otItem(id) || {}, amt = readAmt();
    if (!(amt > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    otAct(id, payPatch(i, amt), { a: 'paid', v: amt }, '✓ ' + otName(id) + ' — ' + money(amt) + ' পরিশোধিত');
  };

  window.otDoAmount = function (id) {
    const i = otItem(id) || {}, amt = readAmt();
    if (!(amt > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    otAct(id, { amount: amt, totalAmount: num(i.paidAmount) > 0 ? num(i.totalAmount) : amt },
      { a: 'amount', old: num(i.amount), v: amt }, 'পরিমাণ সংরক্ষিত — ' + money(amt));
  };

  window.otDoPartial = function (id) {
    const i = otItem(id) || {}, rem = readAmt();
    const px = $('fqPartAmt'), x = num(px ? px.value : 0);
    if (!(rem > 0)) return sheetErr('আগে পরিমাণ লিখুন');
    if (!(x > 0)) return sheetErr('কত টাকা দিয়েছে লিখুন');
    if (x >= rem) return sheetErr('পুরো টাকা দিলে "পরিশোধিত নিশ্চিত করুন" চাপুন');
    otAct(id, {
      status: 'due', totalAmount: i.totalAmount ? num(i.totalAmount) : rem,
      paidAmount: num(i.paidAmount) + x, amount: rem - x
    }, { a: 'partial', v: x }, otName(id) + ' — ' + money(x) + ' জমা, বাকি ' + money(rem - x));
  };

  window.otDoFix = function (id) {
    const i = otItem(id) || {}, cur = num(i.amount), n = readAmt();
    if (!(n > 0)) return sheetErr('সঠিক পরিমাণ লিখুন (পরিশোধ বাতিল করতে নিচের লাল বাটন চাপুন)');
    if (n === cur) return closeSheet();
    otAct(id, { amount: n, totalAmount: n, paidAmount: n }, { a: 'edit', old: cur, v: n },
      'সংশোধিত — ' + money(cur) + ' → ' + money(n));
  };

  window.otUnpay = function (id) {
    const b = $('fqUnpayBtn');
    if (!b) return;
    const label = 'পরিশোধ বাতিল করুন (আবার বকেয়া)';
    if (!b.dataset.sure) {
      b.dataset.sure = '1'; b.textContent = 'নিশ্চিত? আবার চাপুন';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = label; } }, 4000);
      return;
    }
    const i = otItem(id) || {}, cur = num(i.amount);
    otAct(id, { status: 'due', amount: i.totalAmount ? num(i.totalAmount) : cur, paidAmount: 0, paidDate: '' },
      { a: 'unpaid', old: cur }, otName(id) + ' — পরিশোধ বাতিল, বকেয়া');
  };

  window.otDelete = function (id) {
    const b = $('otDelBtn');
    if (!b) return;
    const label = '🗑 এই ফি মুছে ফেলুন';
    if (!b.dataset.sure) {
      b.dataset.sure = '1'; b.textContent = 'সত্যিই মুছবেন? আবার চাপুন';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = label; } }, 4000);
      return;
    }
    const i = otItem(id);
    if (!i) return;
    const copy = Object.assign({}, i); delete copy.id;
    const name = otName(id);
    closeSheet();
    db.collection('fees_onetime').doc(id).delete().then(() => {
      toast(name + ' — ফি মুছে ফেলা হয়েছে', () => db.collection('fees_onetime').doc(id).set(copy)
        .then(() => toast('ফিরিয়ে আনা হয়েছে')).catch(e => fail('ফিরিয়ে আনা ব্যর্থ', e)));
    }).catch(e => fail('ফি মুছতে ব্যর্থ', e));
  };

  // ---------- সবাইকে পরিশোধিত / বাতিল ----------
  window.otBulkPay = function () {
    const targets = otShown().filter(i => i.status !== 'paid' && num(i.amount) > 0);
    if (!targets.length) return toast('পরিশোধিত করার মতো কেউ নেই');
    const total = targets.reduce((a, i) => a + num(i.amount), 0);
    openSheet(sheetHead('সবাইকে পরিশোধিত', esc(O.type ? (otShown()[0] || {}).feeType : 'সব ফি')) +
      '<div class="fq-paid" style="background:#eef2ff;color:#3730a3;">' + bn(targets.length) + ' জন<small style="font-size:15px;font-weight:700;">মোট ' + money(total) + '</small></div>' +
      '<p class="muted" style="font-size:13px;">যারা দেয়নি, পরে তাদের না চেপে রাখুন। ভুল হলে প্রতিজনকে খুলে বাতিল করা যাবে।</p>' +
      '<button class="fq-btn ok" onclick="otBulkPayGo()">✓ নিশ্চিত করুন</button>');
  };

  window.otBulkPayGo = function () {
    const targets = otShown().filter(i => i.status !== 'paid' && num(i.amount) > 0);
    closeSheet();
    if (!targets.length) return;
    const jobs = [];
    for (let k = 0; k < targets.length; k += 200) {
      const batch = db.batch();
      targets.slice(k, k + 200).forEach(i => {
        batch.set(db.collection('fees_onetime').doc(i.id), Object.assign({}, payPatch(i, num(i.amount)),
          { history: FV().arrayUnion(logEntry({ a: 'paid', v: num(i.amount) })) }), { merge: true });
      });
      jobs.push(batch.commit());
    }
    Promise.all(jobs).then(() => toast('✓ ' + bn(targets.length) + ' জনকে পরিশোধিত করা হয়েছে'))
      .catch(e => fail('সবাইকে পরিশোধিত ব্যর্থ', e));
  };

  window.otBulkDelete = function () {
    const targets = otShown().filter(i => i.status !== 'paid' && !(num(i.paidAmount) > 0));
    if (!targets.length) return toast('মোছার মতো কেউ নেই (পরিশোধিত বা আংশিক দেওয়া ফি মোছা হয় না)');
    openSheet(sheetHead('ফি বাতিল করুন', esc((targets[0] || {}).feeType || '')) +
      '<div class="fq-note">' + bn(targets.length) + ' জনের এই ফি মুছে যাবে (যারা এখনো কিছুই দেয়নি)। পরিশোধিত বা আংশিক দেওয়া ফি মুছবে না।</div>' +
      '<button class="fq-btn bad" onclick="otBulkDeleteGo()">হ্যাঁ, মুছে ফেলুন</button>');
  };

  window.otBulkDeleteGo = function () {
    const targets = otShown().filter(i => i.status !== 'paid' && !(num(i.paidAmount) > 0));
    closeSheet();
    const jobs = [];
    for (let k = 0; k < targets.length; k += 200) {
      const batch = db.batch();
      targets.slice(k, k + 200).forEach(i => batch.delete(db.collection('fees_onetime').doc(i.id)));
      jobs.push(batch.commit());
    }
    Promise.all(jobs).then(() => toast(bn(targets.length) + ' জনের ফি মুছে ফেলা হয়েছে'))
      .catch(e => fail('ফি মুছতে ব্যর্থ', e));
  };

  // ---------- নতুন ফি চালু (শ্রেণির সবার জন্য / একজনের জন্য) ----------
  function otFieldsHtml(withStudent) {
    const names = ['ভর্তি ফি', 'পরীক্ষার ফি'];
    const have = {}; names.forEach(n => { have[tkey(n)] = 1; });
    O.items.forEach(i => { const k = tkey(i.feeType); if (k && !have[k]) { have[k] = 1; names.push(String(i.feeType)); } });
    O.names = names.slice(0, 8);
    let stuSel = '';
    if (withStudent) {
      stuSel = '<label class="fq-lb">শিক্ষার্থী</label><select id="otStu" style="width:100%;margin:4px 0 8px;">' +
        studentsByClass(feesClassFilter).map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + ' (' + esc(s.roll || '-') + ')' +
          (feesClassFilter === 'all' && s.className ? ' — ' + esc(s.className) : '') + '</option>').join('') + '</select>';
    }
    return stuSel + '<label class="fq-lb">ফি এর ধরন</label>' +
      '<input id="otType" class="fq-search" placeholder="যেমন: ভর্তি ফি, মূল্যায়ন পরীক্ষা ফি" style="margin:4px 0 6px;">' +
      '<div>' + O.names.map((n, k) => '<button class="fq-chip" onclick="otPick(' + k + ')">' + esc(n) + '</button>').join('') + '</div>' +
      '<label class="fq-lb">পরিমাণ (টাকা)</label>' +
      '<input class="fq-in" id="fqAmt" type="number" inputmode="numeric" placeholder="যেমন ২০০">' +
      '<label class="fq-chkl"><input type="checkbox" id="otPaidNow" ' + (withStudent ? 'checked' : '') + '><span>এখনই পরিশোধিত ধরুন</span></label>' +
      '<div class="fq-err" id="fqErr"></div>';
  }

  window.otPick = k => { const e = $('otType'); if (e && O.names[k]) e.value = O.names[k]; };

  window.otNew = function () {
    ensureStyle();
    const n = studentsByClass(feesClassFilter).length;
    if (!n) return toast('এই শ্রেণিতে কোনো শিক্ষার্থী নেই');
    const where = feesClassFilter === 'all' ? 'সকল শ্রেণির' : feesClassFilter + ' শ্রেণির';
    openSheet(sheetHead('নতুন ফি চালু করুন', esc(where) + ' ' + bn(n) + ' জনের জন্য') + otFieldsHtml(false) +
      '<p class="muted" style="font-size:13px;margin:0 0 10px;">যাদের এই ধরনের ফি আগে থেকেই আছে, তাদের আবার যোগ হবে না। কারো ফি আলাদা হলে পরে তাকে খুলে পরিমাণ বদলান।</p>' +
      '<button class="fq-btn pri" onclick="otCreateGo(false)">চালু করুন</button>');
  };

  window.otNewOne = function () {
    ensureStyle();
    if (!studentsByClass(feesClassFilter).length) return toast('কোনো শিক্ষার্থী নেই');
    openSheet(sheetHead('একজনের জন্য ফি যোগ', '') + otFieldsHtml(true) +
      '<button class="fq-btn pri" onclick="otCreateGo(true)">যোগ করুন</button>');
  };

  window.otCreateGo = function (single) {
    const type = String(($('otType') || {}).value || '').trim().replace(/\s+/g, ' ');
    const amt = readAmt();
    const paidNow = !!($('otPaidNow') && $('otPaidNow').checked);
    if (!type) return sheetErr('ফি এর ধরন লিখুন');
    if (!(amt > 0)) return sheetErr('সঠিক পরিমাণ দিন');
    const k = tkey(type);
    const have = {};
    O.items.forEach(i => { if (tkey(i.feeType) === k) have[i.studentId] = true; });
    let students = studentsByClass(feesClassFilter);
    if (single) {
      const id = ($('otStu') || {}).value;
      students = students.filter(s => s.id === id);
      if (!students.length) return sheetErr('শিক্ষার্থী নির্বাচন করুন');
      if (have[id]) return sheetErr('এই শিক্ষার্থীর এই ফি আগে থেকেই আছে');
    }
    const targets = students.filter(s => !have[s.id]);
    if (!targets.length) return sheetErr('সবার এই ফি আগে থেকেই আছে');

    const today = todayLocal(), now = Date.now();
    const jobs = [];
    for (let n = 0; n < targets.length; n += 200) {
      const batch = db.batch();
      targets.slice(n, n + 200).forEach(s => {
        const data = { madrasaId, studentId: s.id, feeType: type, amount: amt, totalAmount: amt, status: paidNow ? 'paid' : 'due',
          date: today, createdAt: now, history: [logEntry({ a: paidNow ? 'paid' : 'create', v: amt })] };
        if (paidNow) { data.paidAmount = amt; data.paidDate = today; } else { data.paidAmount = 0; data.paidDate = ''; }
        batch.set(db.collection('fees_onetime').doc(), data);
      });
      jobs.push(batch.commit());
    }
    closeSheet();
    O.type = k;
    Promise.all(jobs).then(() => toast('✓ ' + bn(targets.length) + ' জনের জন্য "' + type + '" (' + money(amt) + ') ' + (paidNow ? 'পরিশোধিত হিসেবে যোগ হয়েছে' : 'চালু হয়েছে')))
      .catch(e => fail('ফি যোগ ব্যর্থ', e));
  };
})();
