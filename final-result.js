/* ShikkhaOS — "পরীক্ষার চূড়ান্ত ফলাফল" (১ম সেমিস্টার ২৫% + ২য় সেমিস্টার ২৫% + ৩য় সেমিস্টার ৫০%)
 *
 * index.html এ এই ফাইলটি সবার শেষে (ui-polish.js এর পরে) লোড হবে:
 *   <script defer src="final-result.js"></script>
 *
 * app.js, dashboard.js বা অন্য কোনো ফাইল বদলাতে হয় না। এই ফাইল নিজেই:
 *   - ৩য় সেমিস্টারের মার্কশিট খুললে তার নিচে "পরীক্ষার চূড়ান্ত ফলাফল" অংশ যোগ করে
 *     (শিক্ষক ও শিক্ষার্থী দুইপাশেই; শিক্ষার্থী শুধু প্রকাশিত মার্কশিটের হিসাব দেখে)
 *   - সেমিস্টার চেনে পরীক্ষার নাম থেকে (যেমন "১ম সেমিস্টার ২০২৬", "৩য় সেমিস্টার পরীক্ষা")
 *   - সুপার অ্যাডমিন প্যানেলে প্রতিটি মাদ্রাসার পাশে "চূড়ান্ত ফলাফল চালু/বন্ধ" সুইচ বসায়
 *     (madrasas/{id}.finalResultEnabled; ফিল্ড না থাকলে চালু ধরা হয়)
 *
 * হিসাব:
 *   প্রতি সেমিস্টারের নম্বর = সেমিস্টারের শতাংশ × ওজন (২৫/২৫/৫০), সর্বমোট = তিনটির যোগফল (১০০-এর মধ্যে)
 *   সর্বমোট জিপিএ = ১ম জিপিএ × ২৫% + ২য় জিপিএ × ২৫% + ৩য় জিপিএ × ৫০%
 *   গ্রেড = সর্বমোট জিপিএ থেকে (শুধু ৩য় সেমিস্টারে ফেল বিষয় থাকলে F; ১ম/২য়তে ফেল থাকলেও F হয় না)
 *   অবস্থান = শ্রেণির মধ্যে: জিপিএ, তারপর সর্বমোট নম্বর, তারপর রোল (ফেল করলে অবস্থান নেই)
 *   অবস্থান ৩য় সেমিস্টারের ডকুমেন্টে finalMeritRank/finalMeritTotal নামে জমা থাকে,
 *   শিক্ষক "অবস্থান হালনাগাদ করুন" বাটন চাপলে পুরো শ্রেণির জন্য হিসাব হয়ে জমা হয়।
 */
(function () {
  'use strict';

  if (typeof viewMarksheet !== 'function' || typeof computeMarksheetTotals !== 'function' || typeof db === 'undefined') {
    console.error('[final-result] app.js এর পরে এই ফাইলটি লোড করুন (index.html এ সবার শেষে)।');
    return;
  }

  const WEIGHTS = { 1: 25, 2: 25, 3: 50 };
  const DIGITS = '০১২৩৪৫৬৭৮৯';
  const bn = n => toBanglaNumeral(n);
  const num = n => bn((Math.round(n * 100) / 100).toFixed(2));
  const normYear = s => String(s == null ? '' : s).replace(/[০-৯]/g, d => DIGITS.indexOf(d)).trim();

  // ---------- সেমিস্টার চেনা ----------
  function semesterOf(name) {
    const t = String(name || '')
      .replace(/\u09DF/g, '\u09AF\u09BC')
      .replace(/[০-৯]/g, d => DIGITS.indexOf(d))
      .toLowerCase();
    if (!/সেমি|সেমে|semester/.test(t)) return 0;
    if (/প্রথম|first/.test(t)) return 1;
    if (/দ্বিতীয়|second/.test(t)) return 2;
    if (/তৃতীয়|third/.test(t)) return 3;
    const m = t.match(/(^|[^0-9])([123])(?![0-9])/);
    return m ? Number(m[2]) : 0;
  }

  // একই শিক্ষাবর্ষে একই সেমিস্টারের একাধিক থাকলে সর্বশেষটি
  function pick(list) {
    const by = {};
    list.forEach(r => {
      const k = semesterOf(r.examName);
      if (!k) return;
      if (!by[k] || String(r.date || '') > String(by[k].date || '')) by[k] = r;
    });
    return by;
  }

  function calcFinal(by) {
    const rows = [1, 2, 3].map(k => {
      const r = by[k], w = WEIGHTS[k];
      if (!r) return { k, w, has: false };
      const t = computeMarksheetTotals(r.subjects);
      const pct = t.totalFull > 0 ? t.totalObtained / t.totalFull * 100 : 0;
      return { k, w, has: true, marks: pct * w / 100, gpa: Number(t.gpa), failed: t.hasFailedSubject };
    });
    if (rows.some(x => !x.has)) return { rows, complete: false };
    const marks = rows.reduce((s, x) => s + x.marks, 0);
    const gpa = rows.reduce((s, x) => s + x.gpa * x.w / 100, 0);
    const failed = rows[2].failed; // শুধু ৩য় সেমিস্টারে ফেল থাকলে F
    return { rows, complete: true, marks, gpa, failed, grade: failed ? 'F' : gradeFromAvgGpa(Math.round(gpa * 100) / 100) };
  }

  // ---------- মার্কশিটের নিচে অংশটি বসানো ----------
  let tok = 0;
  let cur = null;

  function cardHtml(c) {
    const f = c.f;
    const isTeacher = role === 'teacher';
    const th = 'padding:8px 10px;border:1px solid #e5e7eb;';
    const rows = f.rows.map((x, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
        <td style="${th}">${esc(banglaOrdinal(x.k))} সেমিস্টার <span class="muted">(${bn(x.w)}%)</span></td>
        <td style="${th}text-align:center;">${x.has ? num(x.marks) + ' / ' + bn(x.w) : '—'}</td>
        <td style="${th}text-align:center;">${x.has ? num(x.gpa) : '—'}</td>
      </tr>`).join('');
    const totalRow = f.complete ? `
      <tr style="background:#f3f4f6;">
        <td style="${th}"><b>সর্বমোট (১০০%)</b></td>
        <td style="${th}text-align:center;"><b>${num(f.marks)} / ${bn(100)}</b></td>
        <td style="${th}text-align:center;"><b>${num(f.gpa)}</b></td>
      </tr>` : '';

    let tail;
    if (f.complete) {
      const gc = gradeColor(f.grade);
      const r3 = c.by[3] || {};
      const rank = (!f.failed && r3.finalMeritRank)
        ? esc(banglaOrdinal(r3.finalMeritRank)) + (r3.finalMeritTotal ? ' / ' + esc(bn(r3.finalMeritTotal)) : '')
        : '—';
      tail = `
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:90px;background:${gc.bg};border-radius:10px;padding:10px;text-align:center;">
            <div class="muted" style="font-size:11px;">গ্রেড</div>
            <div style="font-size:18px;font-weight:bold;color:${gc.fg};">${esc(f.grade)}</div>
            ${f.failed ? '<div style="font-size:10px;color:#991b1b;font-weight:bold;margin-top:2px;">(অকৃতকার্য)</div>' : ''}
          </div>
          <div style="flex:1;min-width:90px;background:#fce7f3;border-radius:10px;padding:10px;text-align:center;">
            <div class="muted" style="font-size:11px;">অবস্থান</div>
            <div style="font-size:18px;font-weight:bold;color:#9d174d;">${rank}</div>
          </div>
        </div>
        ${isTeacher ? `<div class="no-print" style="margin-top:10px;">
          <button class="small secondary" onclick="frUpdateRanks()">অবস্থান হালনাগাদ করুন</button>
          <p class="muted" style="font-size:12px;margin:6px 0 0;">এই শ্রেণির সবার চূড়ান্ত অবস্থান হিসাব করে জমা হবে, তখন শিক্ষার্থীরাও দেখতে পাবে। মার্কশিট বদলালে আবার চাপুন।</p>
        </div>` : ''}`;
    } else {
      const missing = f.rows.filter(x => !x.has).map(x => banglaOrdinal(x.k) + ' সেমিস্টার').join(', ');
      tail = `<p class="muted" style="margin-top:10px;font-size:13px;">চূড়ান্ত ফলাফলের জন্য ${esc(missing)}-এর ${isTeacher ? 'মার্কশিট (একই শিক্ষাবর্ষে, পরীক্ষার নামে সেমিস্টার লেখা)' : 'প্রকাশিত মার্কশিট'} দরকার।</p>`;
    }

    return `
      <hr style="border:none;border-top:1px solid #eee;margin:0 0 12px;">
      <div style="font-weight:bold;font-size:16px;text-align:center;margin-bottom:8px;">পরীক্ষার চূড়ান্ত ফলাফল</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#eef2ff;">
            <th style="${th}text-align:left;">পরীক্ষা</th>
            <th style="${th}">নম্বর</th>
            <th style="${th}">জিপিএ</th>
          </tr>
        </thead>
        <tbody>${rows}${totalRow}</tbody>
      </table>
      ${tail}
      <p class="muted" style="font-size:11.5px;margin-top:8px;">নম্বর = সেমিস্টারের শতাংশ × ওজন। জিপিএ = তিন সেমিস্টারের জিপিএ ২৫%, ২৫% ও ৫০% ওজনে গড়।</p>`;
  }

  function mount(area, c) {
    cur = c;
    let box = area.querySelector('#frBox');
    if (!box) {
      const anchor = area.querySelector('.no-print');
      const h = '<div id="frBox" style="margin-top:18px;"></div>';
      if (anchor) anchor.insertAdjacentHTML('beforebegin', h); else area.insertAdjacentHTML('beforeend', h);
      box = area.querySelector('#frBox');
    }
    if (box) box.innerHTML = cardHtml(c);
  }

  function loadCard(studentId, docId) {
    return db.collection('results').doc(docId).get().then(doc => {
      if (!doc.exists) return null;
      const r = doc.data();
      if (semesterOf(r.examName) !== 3) return null;
      const year = normYear(r.academicYear);
      let q = db.collection('results');
      q = role === 'teacher'
        ? q.where('madrasaId', '==', madrasaId).where('studentId', '==', studentId)
        : q.where('studentId', '==', studentId).where('published', '==', true);
      return q.get().then(snap => {
        const list = snap.docs.map(d => Object.assign({ _id: d.id }, d.data()))
          .filter(x => normYear(x.academicYear) === year && Array.isArray(x.subjects) && x.subjects.length);
        const by = pick(list);
        return { studentId, docId, year, by, f: calcFinal(by) };
      });
    });
  }

  function attach(studentId, docId) {
    const my = ++tok;
    if (typeof appSettings !== 'undefined' && appSettings && appSettings.finalResultEnabled === false) return;
    loadCard(studentId, docId).then(c => {
      if (!c || my !== tok) return;
      let n = 0;
      const iv = setInterval(() => {
        if (my !== tok) { clearInterval(iv); return; }
        const area = document.getElementById('marksheetPrintArea');
        if (area) { clearInterval(iv); mount(area, c); }
        else if (++n > 80) clearInterval(iv);
      }, 100);
    }).catch(e => {
      console.error('[final-result]', e);
      if (typeof showDiagBanner === 'function') showDiagBanner('চূড়ান্ত ফলাফল লোড এরর: ' + (e && e.code ? e.code + ' ' : '') + (e && e.message));
    });
  }

  const origView = window.viewMarksheet;
  window.viewMarksheet = function (studentId, docId) {
    const ret = origView.apply(this, arguments);
    try { attach(studentId, docId); } catch (e) { console.error('[final-result]', e); }
    return ret;
  };

  // ---------- শ্রেণির সবার অবস্থান হিসাব ও জমা (শুধু শিক্ষক) ----------
  window.frUpdateRanks = function () {
    const c = cur;
    if (!c || role !== 'teacher') return;
    const me = studentsCache.find(s => s.id === c.studentId);
    if (!me || !me.className) return alert('শিক্ষার্থীর শ্রেণি পাওয়া যায়নি');
    if (!confirm(me.className + ' শ্রেণির সবার চূড়ান্ত অবস্থান হিসাব করে জমা করা হবে। এগিয়ে যাবেন?')) return;

    db.collection('results').where('madrasaId', '==', madrasaId).get().then(snap => {
      const byStu = {};
      snap.docs.forEach(d => {
        const r = Object.assign({ _id: d.id }, d.data());
        if (normYear(r.academicYear) !== c.year) return;
        if (!Array.isArray(r.subjects) || !r.subjects.length) return;
        (byStu[r.studentId] = byStu[r.studentId] || []).push(r);
      });
      const list = studentsCache.filter(s => s.className === me.className).map(s => {
        const by = pick(byStu[s.id] || []);
        return { s, by, f: calcFinal(by) };
      });
      const pass = list.filter(x => x.f.complete && !x.f.failed).sort((a, b) => {
        const ga = Math.round(a.f.gpa * 100), gb = Math.round(b.f.gpa * 100);
        if (gb !== ga) return gb - ga;
        const ma = Math.round(a.f.marks * 100), mb = Math.round(b.f.marks * 100);
        if (mb !== ma) return mb - ma;
        return meritRollCompare(a.s.roll, b.s.roll);
      });
      const FV = firebase.firestore.FieldValue;
      const ops = [];
      list.forEach(x => {
        if (!x.by[3]) return;
        const ref = db.collection('results').doc(x.by[3]._id);
        const idx = pass.indexOf(x);
        ops.push(idx > -1
          ? [ref, { finalMeritRank: idx + 1, finalMeritTotal: pass.length }]
          : [ref, { finalMeritRank: FV.delete(), finalMeritTotal: FV.delete() }]);
      });
      const commits = [];
      for (let i = 0; i < ops.length; i += 400) {
        const batch = db.batch();
        ops.slice(i, i + 400).forEach(o => batch.update(o[0], o[1]));
        commits.push(batch.commit());
      }
      return Promise.all(commits).then(() => pass.length);
    }).then(n => {
      alert('চূড়ান্ত অবস্থান হালনাগাদ হয়েছে (উত্তীর্ণ ' + bn(n) + ' জন)');
      return loadCard(c.studentId, c.docId).then(nc => {
        const area = document.getElementById('marksheetPrintArea');
        if (nc && area) mount(area, nc);
      });
    }).catch(e => {
      alert('হালনাগাদ ব্যর্থ: ' + e.message);
      if (typeof showDiagBanner === 'function') showDiagBanner('চূড়ান্ত অবস্থান হালনাগাদ ব্যর্থ: ' + e.message);
    });
  };

  // ---------- সুপার অ্যাডমিন: প্রতিটি মাদ্রাসার পাশে চালু/বন্ধ সুইচ ----------
  let frUnsub = null;
  const frState = {}; // মাদ্রাসার id -> চালু আছে কিনা

  function frToggle(id) {
    const on = frState[id] !== false;
    if (!confirm(on
      ? 'এই মাদ্রাসার মার্কশিটে "চূড়ান্ত ফলাফল" অংশ বন্ধ করতে চান?'
      : 'এই মাদ্রাসার মার্কশিটে "চূড়ান্ত ফলাফল" অংশ চালু করতে চান?')) return;
    db.collection('madrasas').doc(id).set({ finalResultEnabled: !on }, { merge: true })
      .catch(e => { alert('আপডেট ব্যর্থ: ' + e.message); if (typeof showDiagBanner === 'function') showDiagBanner('চূড়ান্ত ফলাফল সুইচ ব্যর্থ: ' + e.message); });
  }

  function frPaint() {
    const wrap = document.getElementById('madrasasListWrap');
    if (!wrap) return;
    wrap.querySelectorAll('.student-row').forEach(row => {
      const b = row.querySelector('button[onclick*="toggleMadrasaActive"]');
      if (!b) return;
      const m = /toggleMadrasaActive\('((?:[^'\\]|\\.)*)'/.exec(b.getAttribute('onclick') || '');
      if (!m) return;
      const id = m[1].replace(/\\(.)/g, '$1');
      const known = Object.prototype.hasOwnProperty.call(frState, id);
      const on = frState[id] !== false;
      const sig = id + '|' + known + '|' + on;
      let box = row.querySelector('.fr-sw');
      if (!box) {
        box = document.createElement('div');
        box.className = 'fr-sw';
        box.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        row.appendChild(box);
      }
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.innerHTML = '';
      const label = document.createElement('span');
      label.className = 'muted';
      label.style.fontSize = '13px';
      label.textContent = 'মার্কশিটে চূড়ান্ত ফলাফল:';
      const badge = document.createElement('span');
      badge.className = 'badge ' + (on ? 'present' : 'absent');
      badge.textContent = on ? 'চালু' : 'বন্ধ';
      const btn = document.createElement('button');
      btn.className = 'small secondary';
      btn.textContent = on ? 'বন্ধ করুন' : 'চালু করুন';
      btn.onclick = () => frToggle(id);
      box.appendChild(label); box.appendChild(badge); box.appendChild(btn);
    });
  }

  function frSync() {
    const wrap = document.getElementById('madrasasListWrap');
    if (!wrap || typeof isSuperAdminUser === 'undefined' || !isSuperAdminUser) {
      if (frUnsub) { frUnsub(); frUnsub = null; }
      return;
    }
    if (!frUnsub) {
      frUnsub = db.collection('madrasas').onSnapshot(snap => {
        snap.docs.forEach(d => { frState[d.id] = d.data().finalResultEnabled !== false; });
        frPaint();
      }, err => console.error('[final-result] madrasas', err));
    }
    frPaint();
  }

  const appEl = document.getElementById('app');
  if (appEl && window.MutationObserver) {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; frSync(); });
    }).observe(appEl, { childList: true, subtree: true });
  }
})();
