// ================= fees-report.js (v1) — দৈনিক আদায় রিপোর্ট (বেতন/ফি) =================
// index.html-এ সবার শেষে (fees-quick.js-এর পরে) লোড হবে। app.js / fees-quick.js ছুঁতে হয় না।
// বন্ধ করতে: index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
//  • "বেতন" ট্যাবে নতুন বাটন "আদায় রিপোর্ট" (শুধু শিক্ষকের জন্য)
//  • তারিখ ও শ্রেণি বেছে সেদিনের মোট আদায়, শ্রেণিভিত্তিক যোগফল ও কে কত দিয়েছে তার তালিকা (প্রিন্টযোগ্য)
//  • এখন থেকে প্রতিটি পরিশোধের সাথে তারিখ/মাস চিহ্ন (payDates, payMonths) জমা হয় — মাসিক রিপোর্টের জন্যও কাজে লাগবে
(function () {
  'use strict';
  if (window.__feesReportLoaded) return;
  window.__feesReportLoaded = true;

  const $ = id => document.getElementById(id);
  const num = v => { const n = Number(toEnglishDigits(String(v == null ? '' : v)).trim()); return isNaN(n) ? 0 : n; };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const R = { date: todayLocal(), token: 0 };

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
  function fetchDocs(date) {
    const warns = [];
    const jobs = [];
    ['fees_monthly', 'fees_onetime'].forEach(col => {
      [['payDates', 'array-contains'], ['paidDate', '==']].forEach(pair => {
        jobs.push(
          db.collection(col).where('madrasaId', '==', madrasaId).where(pair[0], pair[1], date).get()
            .then(snap => snap.docs.map(d => ({ col, id: d.id, data: d.data() })))
            .catch(e => {
              warns.push(col + ' / ' + pair[0] + ': ' + (e.message || e.code));
              showDiagBanner('আদায় রিপোর্ট লোড এরর (' + col + ' / ' + pair[0] + '): ' + (e.message || e.code));
              return [];
            })
        );
      });
    });
    return Promise.all(jobs).then(parts => {
      const seen = {}, docs = [];
      parts.forEach(list => list.forEach(x => {
        const k = x.col + '/' + x.id;
        if (seen[k]) return;
        seen[k] = true;
        docs.push(x);
      }));
      return { docs, warns };
    });
  }

  function rollNum(s) {
    const n = Number(toEnglishDigits(String(s.roll == null ? '' : s.roll)));
    return isNaN(n) ? null : n;
  }

  function buildRows(date, docs) {
    const scope = {};
    studentsByClass(feesClassFilter).forEach(s => { scope[s.id] = s; });
    const rows = [];
    docs.forEach(x => {
      const s = scope[x.data.studentId];
      if (!s) return;
      paymentEvents(x.data).forEach(e => {
        if (e.d !== date) return;
        const monthly = x.col === 'fees_monthly';
        rows.push({
          s, monthly, amt: e.v,
          label: monthly ? 'মাসিক বেতন — ' + feeMonthLabel(x.data.month || '') : String(x.data.feeType || 'ফি')
        });
      });
    });
    rows.sort((a, b) => {
      const ca = String(a.s.className || ''), cb = String(b.s.className || '');
      if (ca !== cb) return ca.localeCompare(cb, 'bn');
      const ra = rollNum(a.s), rb = rollNum(b.s);
      if (ra !== null && rb !== null && ra !== rb) return ra - rb;
      const n = String(a.s.name || '').localeCompare(String(b.s.name || ''), 'bn');
      return n || a.label.localeCompare(b.label, 'bn');
    });
    return rows;
  }

  // ---------- ৪. দেখানো ----------
  function render(date, rows, warns) {
    const wrap = $('feesResultWrap');
    if (!wrap) return;

    const total = rows.reduce((a, r) => a + r.amt, 0);
    const monthlyTotal = rows.filter(r => r.monthly).reduce((a, r) => a + r.amt, 0);
    const otherTotal = total - monthlyTotal;
    const people = {};
    rows.forEach(r => { people[r.s.id] = true; });

    const byClass = {};
    rows.forEach(r => {
      const c = r.s.className || '-';
      if (!byClass[c]) byClass[c] = { amt: 0, ids: {} };
      byClass[c].amt += r.amt;
      byClass[c].ids[r.s.id] = true;
    });
    const classRows = Object.keys(byClass).sort((a, b) => a.localeCompare(b, 'bn')).map(c => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;">${esc(c)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;">${toBanglaNumeral(Object.keys(byClass[c].ids).length)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-weight:bold;">${feeMoney(byClass[c].amt)}</td>
      </tr>`).join('');

    const detailRows = rows.map(r => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;">${esc(r.s.roll || '-')}</td>
        <td style="padding:6px;border:1px solid #ddd;">${esc(r.s.name)}</td>
        <td style="padding:6px;border:1px solid #ddd;">${esc(r.s.className || '-')}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:12px;">${esc(r.label)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;white-space:nowrap;font-weight:bold;color:#166534;">${feeMoney(r.amt)}</td>
      </tr>`).join('');

    const warnHtml = warns.length
      ? '<div class="card" style="background:#fef3c7;color:#92400e;font-size:13px;">⚠ কিছু তথ্য লোড করা যায়নি, তাই হিসাব অসম্পূর্ণ হতে পারে। সেটিংসে "ডিবাগ মোড" চালু করে আবার খুলে দেখুন কী এরর আসছে।</div>'
      : '';

    wrap.innerHTML = `
      ${warnHtml}
      <style id="reportPrintStyle">
        @media print { #bottomNav, #topBar, .no-print { display: none !important; } }
      </style>
      <div class="card" id="reportPrintArea">
        <h2 style="text-align:center;margin-bottom:2px;">দৈনিক আদায় রিপোর্ট</h2>
        <p class="muted" style="text-align:center;margin-top:0;">${esc(fmtHolidayDate(date, true))}${feesClassFilter !== 'all' ? ' | শ্রেণি: ' + esc(feesClassFilter) : ''}</p>
        ${rows.length ? `
        <div style="text-align:center;background:#dcfce7;color:#166534;border-radius:12px;padding:10px;margin:8px 0;">
          মোট আদায়<div style="font-size:24px;font-weight:bold;">${feeMoney(total)}</div>
          <div style="font-size:12px;">${toBanglaNumeral(Object.keys(people).length)} জন · ${toBanglaNumeral(rows.length)}টি পেমেন্ট</div>
        </div>
        <p style="text-align:center;font-size:13px;">মাসিক বেতন: <b>${feeMoney(monthlyTotal)}</b> &nbsp;|&nbsp; ভর্তি/পরীক্ষা/অন্যান্য ফি: <b>${feeMoney(otherTotal)}</b></p>
        ${Object.keys(byClass).length > 1 ? `
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead><tr>
            <th style="padding:6px;border:1px solid #ddd;">শ্রেণি</th>
            <th style="padding:6px;border:1px solid #ddd;">জন</th>
            <th style="padding:6px;border:1px solid #ddd;">আদায়</th>
          </tr></thead>
          <tbody>${classRows}</tbody>
        </table>` : ''}
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <thead><tr>
              <th style="padding:6px;border:1px solid #ddd;">রোল</th>
              <th style="padding:6px;border:1px solid #ddd;">নাম</th>
              <th style="padding:6px;border:1px solid #ddd;">শ্রেণি</th>
              <th style="padding:6px;border:1px solid #ddd;">কিসের জন্য</th>
              <th style="padding:6px;border:1px solid #ddd;">টাকা</th>
            </tr></thead>
            <tbody>${detailRows}</tbody>
          </table>
        </div>` : '<p class="muted" style="text-align:center;">এই দিন কোনো আদায় নেই</p>'}
        <p class="muted" style="font-size:12px;margin-top:8px;">যেদিন "পরিশোধিত" বা আংশিক জমা সেভ করা হয়েছে, সেই তারিখেই ধরা হয়েছে। পরে পরিশোধ বাতিল করলে সেটি আর গোনা হয় না।</p>
        <div class="no-print" style="margin-top:14px;text-align:center;">
          <button onclick="window.print()">🖨️ প্রিন্ট করুন</button>
        </div>
      </div>`;
  }

  function load() {
    const wrap = $('feesResultWrap');
    if (!wrap) return;
    const date = R.date, tok = ++R.token;
    wrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
    fetchDocs(date).then(res => {
      if (tok !== R.token || feesMode !== 'collect') return;
      render(date, buildRows(date, res.docs), res.warns);
    }).catch(e => {
      if (tok !== R.token) return;
      wrap.innerHTML = '<div class="card"><p class="muted" style="color:#dc2626;">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) + '</p></div>';
      showDiagBanner('আদায় রিপোর্ট এরর: ' + e.message);
    });
  }

  window.colSetDate = function (v) {
    R.date = DATE_RE.test(String(v || '')) ? v : todayLocal();
    const el = $('colDate');
    if (el) el.value = R.date;
    load();
  };

  function renderCollect() {
    currentFeesIsTeacher = true;
    if (!DATE_RE.test(R.date)) R.date = todayLocal();
    setScreen(`
      <div class="card">
        <h2>বেতন / ফি</h2>
        <div class="row" style="margin-bottom:10px;">
          <button class="small secondary" onclick="switchFeesMode('monthly')">মাসিক বেতন</button>
          <button class="small secondary" onclick="switchFeesMode('onetime')">ভর্তি/পরীক্ষা ফি</button>
          <button class="small secondary" onclick="switchFeesMode('dues')">বকেয়া তালিকা</button>
          <button class="small" onclick="switchFeesMode('collect')">আদায় রিপোর্ট</button>
        </div>
        <div id="feesControlsWrap"></div>
      </div>
      <div id="feesResultWrap"></div>
    `);
    $('feesControlsWrap').innerHTML = `
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
