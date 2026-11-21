// ================= student-charges.js (v1) — শিক্ষার্থী-ভিত্তিক অতিরিক্ত মাসিক চার্জ (গাড়ি ভাড়া, হোস্টেল, খাবার ...) =================
// index.html-এ fees-report.js-এর পরে লোড হবে। app.js / fees-quick.js / fees-report.js ছুঁতে হয় না।
// বন্ধ করতে: index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
//
// কীভাবে কাজ করে:
//  • চার্জ (নাম + মাসিক পরিমাণ + কোন মাস থেকে শুরু) জমা থাকে student_charges কালেকশনে।
//  • প্রতি মাসে "এই মাসের চার্জ চালু করুন" চাপলে প্রতিটি চার্জ থেকে সেই মাসের জন্য একটি ফি তৈরি হয়,
//    যা fees_onetime-এ যায় (নাম: "গাড়ি ভাড়া (ডিসেম্বর ২০২৬)")। তাই বকেয়া তালিকা, আদায় রিপোর্ট,
//    আংশিক জমা, ফিরিয়ে নিন, অভিভাবকের বার্তা, শিক্ষার্থীর নিজের ফি-পাতা — সবই আগের মতোই কাজ করে।
//  • ফি তৈরির সময়ের পরিমাণই ওই মাসের হিসাবে থেকে যায়; পরে ভাড়া বদলালেও আগের মাসের হিসাব বদলায় না।
//  • যে মাসে শিক্ষার্থী গাড়িতে আসে না, সেই মাস "বাদ" দিলে ওই মাসের ফি তৈরি হয় না (তৈরি থাকলে ও কিছুই না দিয়ে থাকলে মুছে যায়)।
(function () {
  'use strict';
  if (window.__studentChargesLoaded) return;
  window.__studentChargesLoaded = true;

  const $ = id => document.getElementById(id);
  const num = v => { const n = Number(toEnglishDigits(String(v == null ? '' : v)).trim()); return isNaN(n) ? 0 : n; };
  const FV = () => firebase.firestore.FieldValue;
  const MONTH_RE = /^\d{4}-\d{2}$/;
  const bn = n => toBanglaNumeral(n);
  const C = { charges: [], entries: {}, month: '', token: 0, names: ['গাড়ি ভাড়া', 'হোস্টেল', 'খাবার'], msgT: null };

  const eid = (c, m) => 'chg_' + c.id + '_' + m;
  const stu = id => studentsCache.find(s => s.id === id);
  const canManage = () => !!(myTeacherIsAdmin || isSuperAdminUser);
  const skips = c => Array.isArray(c.skipMonths) ? c.skipMonths : [];

  function msg(text, bad) {
    const el = $('scMsg');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? '#dc2626' : '#166534';
    if (C.msgT) clearTimeout(C.msgT);
    if (text) C.msgT = setTimeout(() => { const e = $('scMsg'); if (e) e.textContent = ''; }, 6000);
  }

  function fail(label, e) {
    msg('ব্যর্থ: ' + (e && e.message ? e.message : ''), true);
    showDiagBanner(label + ': ' + (e && e.message ? e.message : ''));
  }

  // কোনো মাসের জন্য ফি-র এন্ট্রি (fees_onetime-এর ডকুমেন্ট)
  function mkEntry(c, month) {
    const t = Date.now(), amt = num(c.amount);
    return {
      madrasaId, studentId: c.studentId,
      feeType: c.name + ' (' + feeMonthLabel(month) + ')',
      amount: amt, totalAmount: amt, paidAmount: 0, paidDate: '', status: 'due',
      date: todayLocal(), createdAt: t,
      chargeId: c.id, chargeMonth: month,
      history: [{ t, d: todayLocal(), a: 'create', v: amt }]
    };
  }

  function statusOf(c) {
    const m = C.month, e = C.entries[eid(c, m)];
    if (e) {
      if (e.status === 'paid') return { k: 'paid', t: '✓ পরিশোধিত · ' + feeMoney(e.amount), col: '#166534' };
      if (num(e.paidAmount) > 0) return { k: 'part', t: 'আংশিক · বাকি ' + feeMoney(e.amount), col: '#b45309' };
      return { k: 'due', t: 'বকেয়া · ' + feeMoney(e.amount), col: '#b91c1c' };
    }
    if (skips(c).indexOf(m) > -1) return { k: 'skip', t: '⏭ এই মাস বাদ', col: '#4f46e5' };
    if (c.active === false) return { k: 'off', t: 'বন্ধ', col: '#64748b' };
    if (String(c.startMonth || '') > m) return { k: 'future', t: 'শুরু হবে ' + feeMonthLabel(c.startMonth), col: '#64748b' };
    return { k: 'new', t: '⏳ এখনো তৈরি হয়নি', col: '#b45309' };
  }

  function inScope(c) {
    const s = stu(c.studentId);
    if (!s) return false;
    return feesClassFilter === 'all' || s.className === feesClassFilter;
  }

  function sortedCharges() {
    const rn = s => { const n = Number(toEnglishDigits(String(s.roll == null ? '' : s.roll))); return isNaN(n) ? null : n; };
    return C.charges.filter(inScope).sort((a, b) => {
      const sa = stu(a.studentId), sb = stu(b.studentId);
      const ca = String(sa.className || ''), cb = String(sb.className || '');
      if (ca !== cb) return ca.localeCompare(cb, 'bn');
      const ra = rn(sa), rb = rn(sb);
      if (ra !== null && rb !== null && ra !== rb) return ra - rb;
      const n = String(sa.name || '').localeCompare(String(sb.name || ''), 'bn');
      return n || String(a.name).localeCompare(String(b.name), 'bn');
    });
  }

  // ---------- স্ক্রিন ----------
  function tabsHtml() {
    const b = (mode, label) => '<button class="small ' + (mode === 'charges' ? '' : 'secondary') + '" onclick="switchFeesMode(\'' + mode + '\')">' + label + '</button>';
    return b('monthly', 'মাসিক বেতন') + b('onetime', 'ভর্তি/পরীক্ষা ফি') + b('dues', 'বকেয়া তালিকা') + b('collect', 'আদায় রিপোর্ট') + b('charges', 'অতিরিক্ত চার্জ');
  }

  function renderScreen() {
    currentFeesIsTeacher = true;
    if (!MONTH_RE.test(C.month)) C.month = MONTH_RE.test(feesMonth) ? feesMonth : todayLocal().slice(0, 7);
    const students = studentsByClass(feesClassFilter);
    const stuOpts = students.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + ' (রোল ' + esc(s.roll || '-') + ')' +
      (feesClassFilter === 'all' && s.className ? ' — ' + esc(s.className) : '') + '</option>').join('');
    const chips = C.names.map((n, k) => '<button class="small secondary" style="margin:0 6px 6px 0;" onclick="scPick(' + k + ')">' + esc(n) + '</button>').join('');

    setScreen(`
      <div class="card">
        <h2>বেতন / ফি</h2>
        <div class="row" style="margin-bottom:10px;">${tabsHtml()}</div>
        <label>মাস</label>
        <input type="month" id="scMonth" value="${esc(C.month)}" onchange="scSetMonth(this.value)">
        <div id="feesClassFilterWrap"></div>
        <p id="scMsg" style="font-weight:bold;min-height:18px;margin:8px 0 0;"></p>
      </div>
      <div class="card">
        <h2 style="font-size:16px;">➕ নতুন অতিরিক্ত চার্জ</h2>
        <label>শিক্ষার্থী</label>
        <select id="scStu">${stuOpts || '<option value="">কোনো শিক্ষার্থী নেই</option>'}</select>
        <label>চার্জের নাম</label>
        <input id="scName" maxlength="40" placeholder="যেমন: গাড়ি ভাড়া">
        <div style="margin-top:6px;">${chips}</div>
        <label>মাসিক পরিমাণ (টাকা)</label>
        <input id="scAmt" type="number" inputmode="numeric" placeholder="যেমন: ৫০০">
        <label>কোন মাস থেকে শুরু</label>
        <input type="month" id="scStart" value="${esc(C.month)}">
        <p id="scErr" class="muted" style="color:#dc2626;min-height:18px;"></p>
        <button onclick="scAdd()">যোগ করুন</button>
      </div>
      <div id="scBody"><div class="card"><p class="muted">লোড হচ্ছে...</p></div></div>
    `);
    const fw = $('feesClassFilterWrap');
    if (fw) fw.innerHTML = classFilterDropdownHtml(feesClassFilter, 'onFeesClassFilterChange');
    load();
  }

  function load() {
    const tok = ++C.token, month = C.month;
    Promise.all([
      db.collection('student_charges').where('madrasaId', '==', madrasaId).get(),
      db.collection('fees_onetime').where('madrasaId', '==', madrasaId).where('chargeMonth', '==', month).get()
    ]).then(res => {
      if (tok !== C.token || feesMode !== 'charges') return;
      C.charges = res[0].docs.map(d => Object.assign({ id: d.id }, d.data()));
      C.entries = {};
      res[1].docs.forEach(d => { C.entries[d.id] = d.data(); });
      renderBody();
    }).catch(e => {
      if (tok !== C.token) return;
      const w = $('scBody');
      if (w) w.innerHTML = '<div class="card"><p class="muted" style="color:#dc2626;">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) +
        '<br>firestore.rules-এ student_charges ব্লকটি যোগ করে Publish করা হয়েছে কি?</p></div>';
      showDiagBanner('অতিরিক্ত চার্জ লোড এরর: ' + e.message);
    });
  }

  function targets() {
    return C.charges.filter(c => inScope(c) && statusOf(c).k === 'new');
  }

  function renderBody() {
    const wrap = $('scBody');
    if (!wrap) return;
    const list = sortedCharges();
    const tg = targets();
    const tgTotal = tg.reduce((a, c) => a + num(c.amount), 0);
    let made = 0, madeAmt = 0, skipped = 0;
    list.forEach(c => {
      const k = statusOf(c).k;
      if (k === 'skip') skipped++;
      const e = C.entries[eid(c, C.month)];
      if (e) { made++; madeAmt += num(e.totalAmount) > 0 ? num(e.totalAmount) : num(e.amount); }
    });

    const rows = list.map(c => {
      const s = stu(c.studentId), st = statusOf(c), idq = jsq(c.id);
      const btns = [];
      if (st.k === 'skip') btns.push('<button class="small" onclick="scUnskip(\'' + idq + '\')">এই মাস চালু করুন</button>');
      else if (st.k === 'due' || st.k === 'new') btns.push('<button class="small secondary" onclick="scSkip(\'' + idq + '\')">এই মাস বাদ</button>');
      btns.push('<button class="small secondary" onclick="scAmt(\'' + idq + '\')">পরিমাণ বদলান</button>');
      btns.push(c.active === false
        ? '<button class="small" onclick="scToggle(\'' + idq + '\')">আবার চালু করুন</button>'
        : '<button class="small danger" onclick="scToggle(\'' + idq + '\')">বন্ধ করুন</button>');
      return '<div class="student-row" style="display:block;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
        '<span><b>' + esc(c.name) + '</b> — ' + esc(s.name) + ' <span class="muted">(' + esc(s.className || '-') + ', রোল ' + esc(s.roll || '-') + ')</span></span>' +
        '<b style="white-space:nowrap;">' + feeMoney(c.amount) + '/মাস</b></div>' +
        '<div style="margin-top:3px;font-size:13px;color:' + st.col + ';">' + esc(feeMonthLabel(C.month)) + ': ' + esc(st.t) +
        (c.active === false ? ' <span class="muted">· বন্ধ করা আছে</span>' : '') +
        ' <span class="muted">· শুরু: ' + esc(feeMonthLabel(c.startMonth)) + '</span></div>' +
        '<div style="margin-top:6px;">' + btns.join(' ') + '</div></div>';
    }).join('');

    wrap.innerHTML = `
      <div class="card">
        <h2 style="font-size:16px;">${esc(feeMonthLabel(C.month))} — মাসের চার্জ</h2>
        <p class="muted" style="margin:0 0 8px;">তৈরি হয়েছে: <b>${bn(made)}</b>টি (মোট ${feeMoney(madeAmt)}) &nbsp;|&nbsp; বাদ: <b>${bn(skipped)}</b>টি &nbsp;|&nbsp; তৈরি হয়নি: <b>${bn(tg.length)}</b>টি</p>
        <button onclick="scGen()" ${tg.length ? '' : 'disabled'}>✅ এই মাসের চার্জ চালু করুন${tg.length ? ' (' + bn(tg.length) + ' জন, ' + feeMoney(tgTotal) + ')' : ''}</button>
        <p class="muted" style="font-size:12px;margin:8px 0 0;">চালু করলে প্রতিটির জন্য "ভর্তি/পরীক্ষা ফি" ট্যাবে (ও বকেয়া তালিকায়) নাম-মাসসহ একটি ফি তৈরি হয়। সেখান থেকেই পরিশোধিত/আংশিক চিহ্নিত করবেন। যাদের এই মাস বাদ দেওয়া আছে, তাদের ফি তৈরি হবে না।</p>
      </div>
      <div class="card">
        <h2 style="font-size:16px;">চার্জের তালিকা</h2>
        ${rows || '<p class="muted">এখনো কোনো অতিরিক্ত চার্জ যোগ করা হয়নি</p>'}
      </div>`;
  }

  // ---------- কাজ ----------
  window.scSetMonth = function (v) {
    if (!MONTH_RE.test(String(v || ''))) return;
    C.month = v;
    feesMonth = v;
    const st = $('scStart');
    if (st) st.value = v;
    load();
  };

  window.scPick = function (k) {
    const el = $('scName');
    if (el && C.names[k]) el.value = C.names[k];
  };

  window.scAdd = function () {
    const sid = ($('scStu') || {}).value;
    const name = String(($('scName') || {}).value || '').trim().replace(/\s+/g, ' ');
    const amt = num(($('scAmt') || {}).value);
    const sm = ($('scStart') || {}).value;
    const err = $('scErr');
    const bad = m => { if (err) err.textContent = m; };
    if (err) err.textContent = '';
    if (!sid) return bad('শিক্ষার্থী নির্বাচন করুন');
    if (!name) return bad('চার্জের নাম লিখুন');
    if (name.length > 40) return bad('নাম ৪০ অক্ষরের মধ্যে রাখুন');
    if (!(amt > 0)) return bad('সঠিক পরিমাণ দিন');
    if (!MONTH_RE.test(String(sm || ''))) return bad('শুরুর মাস বাছাই করুন');
    if (C.charges.some(c => c.studentId === sid && c.name === name && c.active !== false)) return bad('এই শিক্ষার্থীর এই নামের চার্জ আগে থেকেই আছে');

    const data = { madrasaId, studentId: sid, name, amount: amt, startMonth: sm, active: true, skipMonths: [], createdAt: Date.now() };
    db.collection('student_charges').add(data).then(ref => {
      const c = Object.assign({ id: ref.id }, data);
      const done = () => {
        $('scName').value = ''; $('scAmt').value = '';
        msg('✓ ' + stu(sid).name + ' — ' + name + ' (' + feeMoney(amt) + '/মাস) যোগ হয়েছে');
        load();
      };
      if (sm <= C.month) {
        // শুরুর মাস বর্তমান মাসের আগে বা সমান হলে এই মাসের ফি সাথে সাথেই তৈরি
        return db.collection('fees_onetime').doc(eid(c, C.month)).set(mkEntry(c, C.month)).then(done);
      }
      done();
    }).catch(e => fail('চার্জ যোগ ব্যর্থ', e));
  };

  window.scGen = function () {
    const tg = targets(), month = C.month;
    if (!tg.length) return msg('তৈরি করার মতো নতুন চার্জ নেই');
    const total = tg.reduce((a, c) => a + num(c.amount), 0);
    if (!confirm(feeMonthLabel(month) + ' মাসের জন্য ' + bn(tg.length) + ' জনের চার্জ তৈরি হবে (মোট ' + feeMoney(total) + ')। এগিয়ে যাবেন?')) return;
    const jobs = [];
    for (let i = 0; i < tg.length; i += 200) {
      const batch = db.batch();
      tg.slice(i, i + 200).forEach(c => batch.set(db.collection('fees_onetime').doc(eid(c, month)), mkEntry(c, month)));
      jobs.push(batch.commit());
    }
    Promise.all(jobs).then(() => {
      msg('✓ ' + bn(tg.length) + ' জনের চার্জ তৈরি হয়েছে — "ভর্তি/পরীক্ষা ফি" ট্যাবে দেখুন');
      load();
    }).catch(e => fail('চার্জ তৈরি ব্যর্থ', e));
  };

  window.scSkip = function (id) {
    const c = C.charges.find(x => x.id === id);
    if (!c) return;
    const month = C.month, e = C.entries[eid(c, month)];
    if (e && (e.status === 'paid' || num(e.paidAmount) > 0)) {
      return alert('এই মাসের ফি আগেই পরিশোধ বা আংশিক জমা হয়েছে। বাদ দিতে চাইলে আগে "ভর্তি/পরীক্ষা ফি" ট্যাবে গিয়ে পরিশোধ বাতিল করে ফি-টি মুছুন।');
    }
    if (!confirm(stu(c.studentId).name + ' — ' + feeMonthLabel(month) + ' মাসের ' + c.name + ' বাদ দেবেন? শুধু এই মাসের ফি যোগ হবে না, অন্য মাস ঠিক থাকবে।')) return;
    const batch = db.batch();
    batch.update(db.collection('student_charges').doc(id), { skipMonths: FV().arrayUnion(month) });
    if (e) batch.delete(db.collection('fees_onetime').doc(eid(c, month)));
    batch.commit().then(() => { msg('⏭ ' + feeMonthLabel(month) + ' মাস বাদ দেওয়া হয়েছে'); load(); }).catch(er => fail('মাস বাদ ব্যর্থ', er));
  };

  window.scUnskip = function (id) {
    const c = C.charges.find(x => x.id === id);
    if (!c) return;
    const month = C.month;
    const batch = db.batch();
    batch.update(db.collection('student_charges').doc(id), { skipMonths: FV().arrayRemove(month) });
    if (c.active !== false && String(c.startMonth || '') <= month && !C.entries[eid(c, month)]) {
      batch.set(db.collection('fees_onetime').doc(eid(c, month)), mkEntry(c, month));
    }
    batch.commit().then(() => { msg('✓ ' + feeMonthLabel(month) + ' মাস আবার চালু হয়েছে'); load(); }).catch(er => fail('মাস চালু ব্যর্থ', er));
  };

  window.scAmt = function (id) {
    const c = C.charges.find(x => x.id === id);
    if (!c) return;
    const v = prompt(c.name + ' — নতুন মাসিক পরিমাণ (টাকা):', c.amount);
    if (v === null) return;
    const n = num(v);
    if (!(n > 0)) return alert('সঠিক পরিমাণ দিন');
    if (n === num(c.amount)) return;
    const month = C.month, e = C.entries[eid(c, month)];
    const batch = db.batch();
    batch.update(db.collection('student_charges').doc(id), { amount: n });
    let note = 'পরের মাসগুলো থেকে নতুন পরিমাণ চলবে; আগের তৈরি হওয়া মাসের হিসাব বদলায়নি';
    if (e && e.status !== 'paid' && !(num(e.paidAmount) > 0) &&
        confirm(feeMonthLabel(month) + ' মাসের এখনো-না-দেওয়া ফি-টিও ' + feeMoney(n) + '-এ বদলাবেন?')) {
      batch.update(db.collection('fees_onetime').doc(eid(c, month)), {
        amount: n, totalAmount: n,
        history: FV().arrayUnion({ t: Date.now(), d: todayLocal(), a: 'amount', old: num(e.amount), v: n })
      });
      note = feeMonthLabel(month) + ' মাসের ফি-ও বদলেছে';
    }
    batch.commit().then(() => { msg('✓ পরিমাণ ' + feeMoney(n) + ' — ' + note); load(); }).catch(er => fail('পরিমাণ বদল ব্যর্থ', er));
  };

  window.scToggle = function (id) {
    const c = C.charges.find(x => x.id === id);
    if (!c) return;
    const on = c.active === false;
    if (!on && !confirm(stu(c.studentId).name + ' — ' + c.name + ' বন্ধ করবেন? আগে তৈরি হওয়া মাসের ফি থাকবে, নতুন মাসে আর যোগ হবে না।')) return;
    db.collection('student_charges').doc(id).update({ active: on })
      .then(() => { msg(on ? '✓ চার্জ আবার চালু হয়েছে' : 'চার্জ বন্ধ করা হয়েছে'); load(); })
      .catch(e => fail('চার্জ আপডেট ব্যর্থ', e));
  };

  // ---------- বেতন পাতায় যুক্ত করা ----------
  function addTab() {
    const row = document.querySelector('#app .card .row');
    if (!row || row.querySelector('[data-chg-tab]')) return;
    const b = document.createElement('button');
    b.className = 'small secondary';
    b.setAttribute('data-chg-tab', '1');
    b.textContent = 'অতিরিক্ত চার্জ';
    b.onclick = function () { switchFeesMode('charges'); };
    row.appendChild(b);
  }

  const origRender = window.renderFeesScreen;
  window.renderFeesScreen = function (isTeacher) {
    if (!isTeacher || !canManage()) {
      if (feesMode === 'charges') feesMode = 'monthly';
      return origRender.apply(this, arguments);
    }
    if (feesMode === 'charges') return renderScreen();
    const r = origRender.apply(this, arguments);
    addTab();
    return r;
  };

  const origClassChange = window.onFeesClassFilterChange;
  window.onFeesClassFilterChange = function (value) {
    if (feesMode === 'charges') { feesClassFilter = value; renderScreen(); return; }
    return origClassChange.apply(this, arguments);
  };
})();
