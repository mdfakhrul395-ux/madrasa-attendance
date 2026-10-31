// ================= fees-report.js (v3) — দৈনিক ও মাসিক আদায় রিপোর্ট (বেতন/ফি) =================
// index.html-এ সবার শেষে (fees-quick.js-এর পরে) লোড হবে। app.js / fees-quick.js ছুঁতে হয় না।
// বন্ধ করতে: index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
//  • "বেতন" ট্যাবে নতুন বাটন "আদায় রিপোর্ট" (শুধু শিক্ষকের জন্য)
//  • দৈনিক: তারিখ ও শ্রেণি বেছে সেদিনের মোট আদায়, শ্রেণিভিত্তিক যোগফল ও কে কত দিয়েছে তার তালিকা
//  • মাসিক: মাসের মোট আদায়, দিনভিত্তিক ও শ্রেণিভিত্তিক হিসাব, শিক্ষার্থীভিত্তিক যোগফল
//  • দুটোই প্রিন্টযোগ্য
//  • প্রতিটি পরিশোধের সাথে তারিখ/মাস চিহ্ন (payDates, payMonths) জমা হয়
(function () {
  'use strict';
  if (window.__feesReportLoaded) return;
  window.__feesReportLoaded = true;

  const $ = id => document.getElementById(id);
  const num = v => { const n = Number(toEnglishDigits(String(v == null ? '' : v)).trim()); return isNaN(n) ? 0 : n; };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const R = { date: todayLocal(), month: todayLocal().slice(0, 7), sub: 'daily', token: 0 };
  const MONTH_RE = /^\d{4}-\d{2}$/;

  // ---------- ১. প্রতিটি পরিশোধের সাথে তারিখ চিহ্ন জমা রাখা ----------
  // fees_monthly / fees_onetime-এ পরিশোধ লেখার সময় payDates ও payMonths অ্যারেতে আজকের তারিখ/মাস যোগ হয়,
  // যাতে "এই তারিখে কে কে দিয়েছে" সরাসরি খুঁজে পাওয়া যায় (আংশিক জমাসহ)।
  function stampData(ref, data) {
    try {
      const col = ref && ref.parent && ref.parent.id;
      if (col !== 'fees_monthly' && col !== 'fees_onetime') return data;
      if (!data || typeof data !== 'object' || !data.history) return data;
      const today = todayLocal();
      const paidNow = data.status === 'paid' && data.paidDate === today;
      const partialNow = data.status !== 'paid' && num(data.paidAmount) > 0;
      if (!paidNow && !partialNow) return data;
      const FV = firebase.firestore.FieldValue;
      return Object.assign({}, data, {
        payDates: FV.arrayUnion(today),
        payMonths: FV.arrayUnion(today.slice(0, 7))
      });
    } catch (e) { return data; }
  }

  try {
    const DR = firebase.firestore.DocumentReference.prototype;
    if (!DR.__fqStamped) {
      const o = DR.set;
      DR.set = function (data) {
        const a = Array.prototype.slice.call(arguments);
        a[0] = stampData(this, data);
        return o.apply(this, a);
      };
      DR.__fqStamped = true;
    }
    const WB = firebase.firestore.WriteBatch.prototype;
    if (!WB.__fqStamped) {
      const ob = WB.set;
      WB.set = function (ref, data) {
        const a = Array.prototype.slice.call(arguments);
        a[1] = stampData(ref, data);
        return ob.apply(this, a);
      };
      WB.__fqStamped = true;
    }
  } catch (e) {
    console.error('[fees-report] তারিখ চিহ্ন চালু করা যায়নি:', e);
  }

  // ---------- ২. একটি ডকুমেন্ট থেকে "কোন তারিখে কত টাকা এসেছে" বের করা ----------
  // history-র paid/partial এন্ট্রি থেকে হিসাব করা হয়, তারপর ডকুমেন্টের বর্তমান অবস্থার সাথে মিলিয়ে নেওয়া হয়
  // (পরিশোধ বাতিল / সংশোধন / পুরনো ডেটার ক্ষেত্রেও মোট যেন ঠিক থাকে)।
  function paymentEvents(d) {
    const actual = d.status === 'paid'
      ? (num(d.paidAmount) > 0 ? num(d.paidAmount) : num(d.amount))
      : num(d.paidAmount);
    if (!(actual > 0)) return [];
    const hist = Array.isArray(d.history) ? d.history : [];
    const ev = [];
    let lastDate = '';
    hist.forEach(h => {
      if (!h || !DATE_RE.test(String(h.d || ''))) return;
      lastDate = h.d;
      if ((h.a === 'paid' || h.a === 'partial') && num(h.v) > 0) ev.push({ d: h.d, v: num(h.v) });
    });
    let sum = ev.reduce((a, e) => a + e.v, 0);
    while (ev.length && sum > actual) sum -= ev.pop().v;
    if (sum < actual) {
      const fb = (d.status === 'paid' && DATE_RE.test(String(d.paidDate || '')))
        ? d.paidDate
        : (ev.length ? ev[ev.length - 1].d : lastDate);
      if (fb) ev.push({ d: fb, v: actual - sum });
    }
    return ev;
  }

  // ---------- ৩. ডেটা আনা ----------
  const COLS = ['fees_monthly', 'fees_onetime'];

  function getDocs(col, field, op, val, warns) {
    return db.collection(col).where('madrasaId', '==', madrasaId).where(field, op, val).get()
      .then(snap => snap.docs.map(d => ({ col, id: d.id, data: d.data() })))
      .catch(e => {
        warns.push(col + ' / ' + field + ': ' + (e.message || e.code));
        showDiagBanner('আদায় রিপোর্ট লোড এরর (' + col + ' / ' + field + '): ' + (e.message || e.code));
        return [];
      });
  }

  function merge(parts, warns) {
    const seen = {}, docs = [];
    parts.forEach(list => list.forEach(x => {
      const k = x.col + '/' + x.id;
      if (seen[k]) return;
      seen[k] = true;
      docs.push(x);
    }));
    return { docs, warns };
  }

  function fetchDay(date) {
    const warns = [], jobs = [];
    COLS.forEach(col => {
      jobs.push(getDocs(col, 'payDates', 'array-contains', date, warns));
      jobs.push(getDocs(col, 'paidDate', '==', date, warns));
    });
    return Promise.all(jobs).then(parts => merge(parts, warns));
  }

  // মাসের প্রতিটি দিনের (আজ পর্যন্ত) পরিশোধ
  function fetchMonth(month) {
    const warns = [], jobs = [];
    COLS.forEach(col => jobs.push(getDocs(col, 'payMonths', 'array-contains', month, warns)));
    const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
    const last = new Date(y, m, 0).getDate(), today = todayLocal();
    for (let d = 1; d <= last; d++) {
      const ds = month + '-' + String(d).padStart(2, '0');
      if (ds > today) break;
      COLS.forEach(col => jobs.push(getDocs(col, 'paidDate', '==', ds, warns)));
    }
    return Promise.all(jobs).then(parts => merge(parts, warns));
  }

  function rollNum(s) {
    const n = Number(toEnglishDigits(String(s.roll == null ? '' : s.roll)));
    return isNaN(n) ? null : n;
  }

  function scopeMap() {
    const scope = {};
    studentsByClass(feesClassFilter).forEach(s => { scope[s.id] = s; });
    return scope;
  }

  function sortRows(rows) {
    rows.sort((a, b) => {
      const ca = String(a.s.className || ''), cb = String(b.s.className || '');
      if (ca !== cb) return ca.localeCompare(cb, 'bn');
      const ra = rollNum(a.s), rb = rollNum(b.s);
      if (ra !== null && rb !== null && ra !== rb) return ra - rb;
      const n = String(a.s.name || '').localeCompare(String(b.s.name || ''), 'bn');
      return n || String(a.label || '').localeCompare(String(b.label || ''), 'bn');
    });
    return rows;
  }

  // pred(eventDate) সত্য হলে পেমেন্টটি ধরা হয়
  function buildRows(docs, pred) {
    const scope = scopeMap(), rows = [];
    docs.forEach(x => {
      const s = scope[x.data.studentId];
      if (!s) return;
      paymentEvents(x.data).forEach(e => {
        if (!pred(e.d)) return;
        const monthly = x.col === 'fees_monthly';
        rows.push({
          s, monthly, amt: e.v, date: e.d,
          label: monthly ? 'মাসিক বেতন — ' + feeMonthLabel(x.data.month || '') : String(x.data.feeType || 'ফি')
        });
      });
    });
    return sortRows(rows);
  }

  // ---------- ৪. দেখানো ----------
  const TD = 'padding:6px;border:1px solid #ddd;';
  const TH = 'padding:6px;border:1px solid #ddd;';
  const bnRoll = s => (s.roll == null || String(s.roll).trim() === '') ? '-' : toBanglaNumeral(toEnglishDigits(String(s.roll).trim()));

  function nameCell(s) {
    return esc(s.name) + (feesClassFilter === 'all' && s.className ? '<div class="muted" style="font-size:11px;">' + esc(s.className) + '</div>' : '');
  }

  function warnHtml(warns) {
    return warns.length
      ? '<div class="card" style="background:#fef3c7;color:#92400e;font-size:13px;">⚠ কিছু তথ্য লোড করা যায়নি, তাই হিসাব অসম্পূর্ণ হতে পারে। সেটিংসে "ডিবাগ মোড" চালু করে আবার খুলে দেখুন কী এরর আসছে।</div>'
      : '';
  }

  function summaryBox(total, people, count) {
    return `
      <div style="text-align:center;background:#dcfce7;color:#166534;border-radius:12px;padding:10px;margin:8px 0;">
        মোট আদায়<div style="font-size:24px;font-weight:bold;">${feeMoney(total)}</div>
        <div style="font-size:12px;">${toBanglaNumeral(people)} জন · ${toBanglaNumeral(count)}টি পেমেন্ট</div>
      </div>`;
  }

  const PRINT_STYLE = '<style id="reportPrintStyle">@media print { #bottomNav, #topBar, .no-print { display: none !important; } }</style>';
  const PRINT_BTN = '<div class="no-print" style="margin-top:14px;text-align:center;"><button onclick="window.print()">🖨️ প্রিন্ট করুন</button></div>';

  function groupByClass(rows) {
    const by = {};
    rows.forEach(r => {
      const c = r.s.className || '-';
      if (!by[c]) by[c] = { amt: 0, ids: {} };
      by[c].amt += r.amt;
      by[c].ids[r.s.id] = true;
    });
    return by;
  }

  function renderDaily(date, rows, warns) {
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    const total = rows.reduce((a, r) => a + r.amt, 0);
    const monthlyTotal = rows.filter(r => r.monthly).reduce((a, r) => a + r.amt, 0);
    const people = {};
    rows.forEach(r => { people[r.s.id] = true; });
    const by = groupByClass(rows);
    const classRows = Object.keys(by).sort((a, b) => a.localeCompare(b, 'bn')).map(c => `
      <tr><td style="${TD}">${esc(c)}</td>
      <td style="${TD}text-align:center;">${toBanglaNumeral(Object.keys(by[c].ids).length)}</td>
      <td style="${TD}text-align:right;font-weight:bold;">${feeMoney(by[c].amt)}</td></tr>`).join('');
    const detail = rows.map(r => `
      <tr><td style="${TD}">${bnRoll(r.s)}</td>
      <td style="${TD}">${nameCell(r.s)}</td>
      <td style="${TD}font-size:12px;">${esc(r.label)}</td>
      <td style="${TD}text-align:right;white-space:nowrap;font-weight:bold;color:#166534;">${feeMoney(r.amt)}</td></tr>`).join('');

    wrap.innerHTML = `
      ${warnHtml(warns)}${PRINT_STYLE}
      <div class="card" id="reportPrintArea">
        <h2 style="text-align:center;margin-bottom:2px;">দৈনিক আদায় রিপোর্ট</h2>
        <p class="muted" style="text-align:center;margin-top:0;">${esc(fmtHolidayDate(date, true))}${feesClassFilter !== 'all' ? ' | শ্রেণি: ' + esc(feesClassFilter) : ''}</p>
        ${rows.length ? `
        ${summaryBox(total, Object.keys(people).length, rows.length)}
        <p style="text-align:center;font-size:13px;">মাসিক বেতন: <b>${feeMoney(monthlyTotal)}</b> &nbsp;|&nbsp; অন্যান্য ফি: <b>${feeMoney(total - monthlyTotal)}</b></p>
        ${Object.keys(by).length > 1 ? `
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead><tr><th style="${TH}">শ্রেণি</th><th style="${TH}">জন</th><th style="${TH}">আদায়</th></tr></thead>
          <tbody>${classRows}</tbody>
        </table>` : ''}
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <thead><tr><th style="${TH}">রোল</th><th style="${TH}">নাম</th><th style="${TH}">কিসের জন্য</th><th style="${TH}">টাকা</th></tr></thead>
            <tbody>${detail}</tbody>
          </table>
        </div>` : '<p class="muted" style="text-align:center;">এই দিন কোনো আদায় নেই</p>'}
        <p class="muted" style="font-size:12px;margin-top:8px;">যেদিন "পরিশোধিত" বা আংশিক জমা সেভ করা হয়েছে, সেই তারিখেই ধরা হয়েছে। পরে পরিশোধ বাতিল করলে সেটি আর গোনা হয় না।</p>
        ${PRINT_BTN}
      </div>`;
  }

  function dayLabel(ds) {
    const p = String(ds).split('-').map(Number);
    const wd = (typeof BANGLA_WEEKDAYS !== 'undefined') ? BANGLA_WEEKDAYS[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] : '';
    return toBanglaNumeral(p[2]) + '/' + toBanglaNumeral(p[1]) + (wd ? ' · ' + wd : '');
  }

  function renderMonthly(month, docs, warns) {
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    const scope = scopeMap();
    const rows = buildRows(docs, d => String(d).slice(0, 7) === month);
    const total = rows.reduce((a, r) => a + r.amt, 0);
    const monthlyTotal = rows.filter(r => r.monthly).reduce((a, r) => a + r.amt, 0);

    // দিনভিত্তিক
    const byDay = {};
    rows.forEach(r => {
      if (!byDay[r.date]) byDay[r.date] = { amt: 0, n: 0 };
      byDay[r.date].amt += r.amt; byDay[r.date].n++;
    });
    const dayRows = Object.keys(byDay).sort().map(ds => `
      <tr><td style="${TD}">${esc(dayLabel(ds))}</td>
      <td style="${TD}text-align:center;">${toBanglaNumeral(byDay[ds].n)}</td>
      <td style="${TD}text-align:right;font-weight:bold;">${feeMoney(byDay[ds].amt)}</td></tr>`).join('');

    // শ্রেণিভিত্তিক
    const by = groupByClass(rows);
    const classRows = Object.keys(by).sort((a, b) => a.localeCompare(b, 'bn')).map(c => `
      <tr><td style="${TD}">${esc(c)}</td>
      <td style="${TD}text-align:center;">${toBanglaNumeral(Object.keys(by[c].ids).length)}</td>
      <td style="${TD}text-align:right;font-weight:bold;">${feeMoney(by[c].amt)}</td></tr>`).join('');

    // শিক্ষার্থীভিত্তিক যোগফল
    const per = {};
    rows.forEach(r => {
      if (!per[r.s.id]) per[r.s.id] = { s: r.s, amt: 0, label: '' };
      per[r.s.id].amt += r.amt;
    });
    const perRows = sortRows(Object.keys(per).map(id => ({ s: per[id].s, amt: per[id].amt, label: '' })))
      .map(r => `
      <tr><td style="${TD}">${bnRoll(r.s)}</td>
      <td style="${TD}">${nameCell(r.s)}</td>
      <td style="${TD}text-align:right;white-space:nowrap;font-weight:bold;color:#166534;">${feeMoney(r.amt)}</td></tr>`).join('');

    wrap.innerHTML = `
      ${warnHtml(warns)}${PRINT_STYLE}
      <div class="card" id="reportPrintArea">
        <h2 style="text-align:center;margin-bottom:2px;">মাসিক আদায় রিপোর্ট</h2>
        <p class="muted" style="text-align:center;margin-top:0;">${esc(feeMonthLabel(month))}${feesClassFilter !== 'all' ? ' | শ্রেণি: ' + esc(feesClassFilter) : ''}</p>
        ${summaryBox(total, Object.keys(per).length, rows.length)}
        <p style="text-align:center;font-size:13px;">বেতন বাবদ: <b>${feeMoney(monthlyTotal)}</b> &nbsp;|&nbsp; ভর্তি/কোচিং/অন্যান্য ফি বাবদ: <b>${feeMoney(total - monthlyTotal)}</b></p>
        ${rows.length ? `
        <h3 style="margin:14px 0 4px;font-size:15px;">দিনভিত্তিক আদায়</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="${TH}">দিন</th><th style="${TH}">পেমেন্ট</th><th style="${TH}">আদায়</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>
        ${Object.keys(by).length > 1 ? `
        <h3 style="margin:14px 0 4px;font-size:15px;">শ্রেণিভিত্তিক</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="${TH}">শ্রেণি</th><th style="${TH}">জন</th><th style="${TH}">আদায়</th></tr></thead>
          <tbody>${classRows}</tbody>
        </table>` : ''}
        <h3 style="margin:14px 0 4px;font-size:15px;">কে কত দিয়েছে</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr><th style="${TH}">রোল</th><th style="${TH}">নাম</th><th style="${TH}">মোট</th></tr></thead>
            <tbody>${perRows}</tbody>
          </table>
        </div>` : '<p class="muted" style="text-align:center;">এই মাসে কোনো আদায় নেই</p>'}
        <p class="muted" style="font-size:12px;margin-top:8px;">এই মাসে যত টাকা হাতে এসেছে তার সবটাই ধরা হয়েছে (আগের মাসের বেতন বা অন্য ফি হলেও)। এই আপডেটের আগে দেওয়া আংশিক জমা ধরা নাও পড়তে পারে।</p>
        ${PRINT_BTN}
      </div>`;
  }

  function load() {
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    const tok = ++R.token;
    wrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
    const fail = e => {
      if (tok !== R.token) return;
      wrap.innerHTML = '<div class="card"><p class="muted" style="color:#dc2626;">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) + '</p></div>';
      showDiagBanner('আদায় রিপোর্ট এরর: ' + e.message);
    };
    if (R.sub === 'monthly') {
      const month = R.month;
      if (!MONTH_RE.test(month)) { wrap.innerHTML = '<div class="card"><p class="muted">মাস বাছাই করুন</p></div>'; return; }
      fetchMonth(month).then(res => {
        if (tok !== R.token || feesMode !== 'collect') return;
        renderMonthly(month, res.docs, res.warns);
      }).catch(fail);
    } else {
      const date = R.date;
      fetchDay(date).then(res => {
        if (tok !== R.token || feesMode !== 'collect') return;
        renderDaily(date, buildRows(res.docs, d => d === date), res.warns);
      }).catch(fail);
    }
  }

  window.colSetDate = function (v) {
    R.date = DATE_RE.test(String(v || '')) ? v : todayLocal();
    const el = $('colDate');
    if (el) el.value = R.date;
    load();
  };

  window.colSetMonth = function (v) {
    R.month = MONTH_RE.test(String(v || '')) ? v : todayLocal().slice(0, 7);
    const el = $('colMonth');
    if (el) el.value = R.month;
    load();
  };

  window.colSub = function (sub) {
    R.sub = sub === 'monthly' ? 'monthly' : 'daily';
    renderCollect();
  };

  function renderCollect() {
    currentFeesIsTeacher = true;
    if (!DATE_RE.test(R.date)) R.date = todayLocal();
    if (!MONTH_RE.test(R.month)) R.month = todayLocal().slice(0, 7);
    setScreen(`
      <div class="card">
        <h2>বেতন / ফি</h2>
        <div class="row" style="margin-bottom:10px;">
          <button class="small secondary" onclick="switchFeesMode('monthly')">মাসিক বেতন</button>
          <button class="small secondary" onclick="switchFeesMode('onetime')">ভর্তি/পরীক্ষা ফি</button>
          <button class="small secondary" onclick="switchFeesMode('dues')">বকেয়া তালিকা</button>
          <button class="small" onclick="switchFeesMode('collect')">আদায় রিপোর্ট</button>
        </div>
        <div class="row" style="margin-bottom:10px;">
          <button class="small ${R.sub === 'daily' ? '' : 'secondary'}" onclick="colSub('daily')">দৈনিক</button>
          <button class="small ${R.sub === 'monthly' ? '' : 'secondary'}" onclick="colSub('monthly')">মাসিক</button>
        </div>
        <div id="feesControlsWrap"></div>
      </div>
      <div id="feesResultWrap"></div>
    `);
    $('feesControlsWrap').innerHTML = R.sub === 'monthly' ? `
      <label>মাস</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="month" id="colMonth" value="${esc(R.month)}" onchange="colSetMonth(this.value)" style="flex:1;margin:0;">
        <button class="small secondary" onclick="colSetMonth(todayLocal().slice(0,7))">এই মাস</button>
      </div>
      <div id="feesClassFilterWrap"></div>
    ` : `
      <label>তারিখ</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="date" id="colDate" value="${esc(R.date)}" onchange="colSetDate(this.value)" style="flex:1;margin:0;">
        <button class="small secondary" onclick="colSetDate(todayLocal())">আজ</button>
      </div>
      <div id="feesClassFilterWrap"></div>
    `;
    $('feesClassFilterWrap').innerHTML = classFilterDropdownHtml(feesClassFilter, 'onFeesClassFilterChange');
    load();
  }

  // ---------- ৫. বেতন পাতায় যুক্ত করা ----------
  function addTab() {
    const row = document.querySelector('#app .card .row');
    if (!row || row.querySelector('[data-collect-tab]')) return;
    const b = document.createElement('button');
    b.className = 'small secondary';
    b.setAttribute('data-collect-tab', '1');
    b.textContent = 'আদায় রিপোর্ট';
    b.onclick = function () { switchFeesMode('collect'); };
    row.appendChild(b);
  }

  const origRender = window.renderFeesScreen;
  window.renderFeesScreen = function (isTeacher) {
    if (!isTeacher) {
      if (feesMode === 'collect') feesMode = 'monthly';
      return origRender.apply(this, arguments);
    }
    if (feesMode === 'collect') return renderCollect();
    const r = origRender.apply(this, arguments);
    addTab();
    return r;
  };

  const origClassChange = window.onFeesClassFilterChange;
  window.onFeesClassFilterChange = function (value) {
    if (feesMode === 'collect') { feesClassFilter = value; load(); return; }
    return origClassChange.apply(this, arguments);
  };
})();
