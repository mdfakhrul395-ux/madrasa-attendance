/* ShikkhaOS — পরীক্ষার চূড়ান্ত ফলাফল (১ম সেমিস্টার ২৫% + ২য় সেমিস্টার ২৫% + ৩য় সেমিস্টার ৫০%)
 *
 * index.html এ সবার শেষে (ui-polish.js এর পরে) লোড হবে:
 *   <script src="final-result.js"></script>
 * app.js / dashboard.js বদলাতে হয় না।
 *
 * হিসাবের নিয়ম:
 *  - সেমিস্টারের নম্বর = প্রাপ্ত নম্বর × ওয়েটেজ (যেমন ৭৫০ × ২৫% = ১৮৭.৫)
 *  - সর্বমোট নম্বর = তিন সেমিস্টারের ওয়েটেড নম্বরের যোগফল (শুধু সংখ্যাটি দেখায়, "/পূর্ণমান" নয়)
 *  - সেমিস্টারের জিপিএ × ওয়েটেজ, তিনটির যোগফল = সর্বমোট জিপিএ
 *  - গ্রেড: জিপিএ থেকে; F হয় শুধু ৩য় সেমিস্টারে কোনো বিষয়ে ফেল করলে
 *  - অবস্থান: চূড়ান্ত জিপিএ → সর্বমোট নম্বর → রোল (শ্রেণি অনুযায়ী), "চূড়ান্ত মেধাক্রম হালনাগাদ" বাটনে হিসাব হয়
 *  - সেমিস্টার চেনা পরীক্ষার নামের লেখার ওপর নির্ভর করে না: অ্যাডমিন শিক্ষাবর্ষ অনুযায়ী
 *    কোন পরীক্ষা ১ম/২য়/৩য় তা "সেমিস্টার নির্ধারণ" থেকে ঠিক করেন (না করলে ওই শিক্ষাবর্ষের
 *    প্রথম তিনটি পরীক্ষা তারিখ অনুযায়ী ধরা হয়)
 *  - সুপার অ্যাডমিন সুপার অ্যাডমিন ট্যাবে প্রতিটি মাদ্রাসার জন্য এই অংশ চালু/বন্ধ করেন
 *    (madrasas/{id}.finalResultEnabled; ফাঁকা থাকলে চালু)
 */
(function () {
  'use strict';

  if (typeof viewMarksheet !== 'function' || typeof computeMarksheetTotals !== 'function' || typeof db === 'undefined') {
    console.error('[final-result] app.js এর পরে এই ফাইল লোড করুন।');
    return;
  }

  const WEIGHTS = [0.25, 0.25, 0.5];
  const WLABEL = ['২৫%', '২৫%', '৫০%'];
  const SEMS = ['১ম সেমিস্টার', '২য় সেমিস্টার', '৩য় সেমিস্টার'];
  const bn = v => String(v); // নম্বর/জিপিএ মার্কশিটের মতো ইংরেজি সংখ্যায়
  const r2 = v => Math.round((Number(v) + 1e-9) * 100) / 100;
  const num = v => bn(String(r2(v)));
  const gpaTxt = v => bn(r2(v).toFixed(2));
  const yk = y => y || '_';
  const enabled = () => !(appSettings && appSettings.finalResultEnabled === false);
  const isAdmin = () => !!(myTeacherIsAdmin || isSuperAdminUser);
  const el = id => document.getElementById(id);

  let current = null; // { studentId, docId, year, names, configured, count }

  // ---------- সেমিস্টার নির্ধারণ ----------
  function pickExams(list, year) {
    const cfgAll = appSettings && appSettings.finalResultExams;
    const cfg = cfgAll && cfgAll[yk(year)];
    if (Array.isArray(cfg) && cfg.length === 3) return { names: cfg.slice(), configured: true, count: 3 };
    const first = {};
    list.forEach(r => {
      const d = r.date || '';
      if (!(r.examName in first) || d < first[r.examName]) first[r.examName] = d;
    });
    const all = Object.keys(first).sort((a, b) => first[a].localeCompare(first[b]) || a.localeCompare(b, 'bn'));
    return { names: all.slice(0, 3), configured: false, count: all.length };
  }

  // ---------- হিসাব ----------
  function model(rs) {
    const sems = rs.map(r => r ? { r, t: computeMarksheetTotals(r.subjects) } : null);
    const m = { sems, complete: sems.every(Boolean) };
    m.rows = sems.map((s, i) => s ? { marks: s.t.totalObtained * WEIGHTS[i], gpa: Number(s.t.gpa) * WEIGHTS[i] } : null);
    if (m.complete) {
      m.marks = m.rows.reduce((a, x) => a + x.marks, 0);
      m.gpa = r2(m.rows.reduce((a, x) => a + x.gpa, 0));
      m.full = sems.reduce((a, s, i) => a + s.t.totalFull * WEIGHTS[i], 0);
      m.percent = m.full > 0 ? (m.marks / m.full) * 100 : 0;
      m.failed = sems[2].t.hasFailedSubject; // শুধু ৩য় সেমিস্টারের ফেল ধরা হয়
      const g = gradeFromAvgGpa(m.gpa);
      m.grade = m.failed ? 'F' : (g === 'F' ? 'D' : g);
    }
    return m;
  }

  // ---------- HTML ----------
  function boxHtml(m, ctx) {
    const td = 'padding:8px 10px;border:1px solid #e5e7eb;';
    const names = ctx.names;
    const rows = [0, 1, 2].map(i => {
      const s = m.sems[i], row = m.rows[i];
      const label = esc(SEMS[i]) + ' (' + WLABEL[i] + ')';
      if (!s) {
        return `<tr>
          <td style="${td}">${label}<div class="muted" style="font-size:11px;">${names[i] ? esc(names[i]) + ': ' : ''}ফলাফল পাওয়া যায়নি</div></td>
          <td style="${td}text-align:center;">–</td><td style="${td}text-align:center;">–</td></tr>`;
      }
      return `<tr>
        <td style="${td}">${label}<div class="muted" style="font-size:11px;">${esc(names[i])}: প্রাপ্ত ${esc(bn(s.t.totalObtained))}/${esc(bn(s.t.totalFull))}, জিপিএ ${esc(bn(s.t.gpa))}</div></td>
        <td style="${td}text-align:center;"><b>${esc(num(row.marks))}</b></td>
        <td style="${td}text-align:center;">${esc(gpaTxt(row.gpa))}</td></tr>`;
    }).join('');

    const totalRow = `<tr style="background:#f3f4f6;">
      <td style="${td}"><b>সর্বমোট (১০০%)</b></td>
      <td style="${td}text-align:center;"><b>${m.complete ? esc(num(m.marks)) : '–'}</b></td>
      <td style="${td}text-align:center;"><b>${m.complete ? esc(gpaTxt(m.gpa)) : '–'}</b></td></tr>`;

    let stats = '';
    if (m.complete) {
      const gc = gradeColor(m.grade);
      const r3 = m.sems[2].r;
      const rankTxt = (!m.failed && r3.finalRank)
        ? esc(banglaOrdinal(r3.finalRank)) + (r3.finalRankTotal ? ' / ' + esc(toBanglaNumeral(r3.finalRankTotal)) : '')
        : '–';
      stats = `<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:90px;background:#eef2ff;border-radius:10px;padding:10px;text-align:center;">
          <div class="muted" style="font-size:11px;">শতাংশ</div>
          <div style="font-size:18px;font-weight:bold;color:#3730a3;">${esc(num(m.percent))}%</div>
        </div>
        <div style="flex:1;min-width:90px;background:${gc.bg};border-radius:10px;padding:10px;text-align:center;">
          <div class="muted" style="font-size:11px;">গ্রেড</div>
          <div style="font-size:18px;font-weight:bold;color:${gc.fg};">${esc(m.grade)}</div>
          ${m.failed ? '<div style="font-size:10px;color:#991b1b;font-weight:bold;margin-top:2px;">(অকৃতকার্য)</div>' : ''}
        </div>
        <div style="flex:1;min-width:90px;background:#fce7f3;border-radius:10px;padding:10px;text-align:center;">
          <div class="muted" style="font-size:11px;">অবস্থান</div>
          <div style="font-size:18px;font-weight:bold;color:#9d174d;">${rankTxt}</div>
        </div>
      </div>`;
    } else {
      stats = '<p class="muted" style="margin-top:10px;font-size:12px;text-align:center;">তিনটি সেমিস্টারের ফলাফল যুক্ত হলে সর্বমোট, গ্রেড ও অবস্থান দেখাবে।</p>';
    }

    const isT = (typeof role !== 'undefined' && role === 'teacher');
    const hint = (isT && isAdmin() && !ctx.configured && ctx.count > 3)
      ? '<p class="muted no-print" style="font-size:12px;color:#b45309;">এই শিক্ষাবর্ষে তিনটির বেশি পরীক্ষা আছে। কোনটি ১ম/২য়/৩য় সেমিস্টার তা "সেমিস্টার নির্ধারণ" থেকে ঠিক করে দিন।</p>' : '';
    const ctrl = isT ? `<div class="no-print" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="small secondary" onclick="frRecomputeRanks()">চূড়ান্ত মেধাক্রম হালনাগাদ</button>
        ${isAdmin() ? '<button class="small secondary" onclick="frOpenConfig()">সেমিস্টার নির্ধারণ</button>' : ''}
      </div><div id="frPanel" class="no-print"></div>` : '';

    return `<div id="finalResultBox" style="margin-top:18px;padding-top:14px;border-top:2px solid #e5e7eb;">
      <h3 style="text-align:center;margin:0 0 8px;font-size:16px;">পরীক্ষার চূড়ান্ত ফলাফল</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#eef2ff;">
          <th style="${td}text-align:left;">পরীক্ষা</th><th style="${td}">নম্বর</th><th style="${td}">জিপিএ</th>
        </tr></thead>
        <tbody>${rows}${totalRow}</tbody>
      </table>
      ${stats}${hint}${ctrl}
    </div>`;
  }

  // ---------- মার্কশিটে বসানো ----------
  function loadCtx(studentId, year) {
    let q = db.collection('results').where('studentId', '==', studentId);
    if (typeof role !== 'undefined' && role === 'teacher') q = q.where('madrasaId', '==', madrasaId);
    else q = q.where('published', '==', true);
    return q.get().then(snap => {
      const list = snap.docs.map(d => Object.assign({ id: d.id }, d.data()))
        .filter(r => (r.academicYear || '') === year && Array.isArray(r.subjects) && r.subjects.length);
      const pick = pickExams(list, year);
      const byName = {};
      list.forEach(r => { byName[r.examName] = r; });
      return { list, names: pick.names, configured: pick.configured, count: pick.count, byName };
    });
  }

  function inject(p) {
    if (!enabled()) return;
    db.collection('results').doc(p.docId).get().then(doc => {
      if (!doc.exists) return;
      const cur = doc.data();
      if (!Array.isArray(cur.subjects) || !cur.subjects.length) return;
      const year = cur.academicYear || '';
      return loadCtx(p.studentId, year).then(ctx => {
        if (ctx.names.indexOf(cur.examName) === -1) return; // এই পরীক্ষা তিন সেমিস্টারের মধ্যে নয়
        const area = el('marksheetPrintArea');
        if (!area || el('finalResultBox')) return;
        const m = model([0, 1, 2].map(i => ctx.byName[ctx.names[i]] || null));
        current = { studentId: p.studentId, docId: p.docId, year, names: ctx.names, configured: ctx.configured, count: ctx.count };
        const anchor = area.querySelector('.no-print');
        const html = boxHtml(m, ctx);
        if (anchor) anchor.insertAdjacentHTML('beforebegin', html);
        else area.insertAdjacentHTML('beforeend', html);
      });
    }).catch(e => { if (typeof showDiagBanner === 'function') showDiagBanner('চূড়ান্ত ফলাফল লোড ব্যর্থ: ' + e.message); });
  }

  let pending = null;
  const origView = window.viewMarksheet;
  window.viewMarksheet = function (studentId, docId) {
    pending = { studentId, docId };
    return origView.apply(this, arguments);
  };

  (function watch() {
    const app = el('app');
    if (!app) { setTimeout(watch, 200); return; }
    new MutationObserver(() => {
      if (pending && el('marksheetPrintArea') && !el('finalResultBox')) {
        const p = pending; pending = null;
        inject(p);
      }
    }).observe(app, { childList: true });
  })();

  // ---------- সেমিস্টার নির্ধারণ (অ্যাডমিন) ----------
  window.frOpenConfig = function () {
    if (!current || !isAdmin()) return;
    const panel = el('frPanel');
    if (!panel) return;
    panel.innerHTML = '<p class="muted">পরীক্ষার তালিকা লোড হচ্ছে...</p>';
    db.collection('results').where('madrasaId', '==', madrasaId).get().then(snap => {
      const first = {};
      snap.docs.forEach(d => {
        const r = d.data();
        if ((r.academicYear || '') !== current.year || !r.examName) return;
        const dt = r.date || '';
        if (!(r.examName in first) || dt < first[r.examName]) first[r.examName] = dt;
      });
      const list = Object.keys(first).sort((a, b) => first[a].localeCompare(first[b]) || a.localeCompare(b, 'bn'));
      if (list.length < 3) { panel.innerHTML = '<p class="muted">এই শিক্ষাবর্ষে অন্তত তিনটি পরীক্ষার মার্কশিট থাকলে নির্ধারণ করা যাবে।</p>'; return; }
      const sel = i => {
        const chosen = current.names[i] || list[i];
        return `<label style="font-size:12px;">${esc(SEMS[i])} (${WLABEL[i]})</label>
          <select id="frSel${i}">${list.map(n => `<option value="${esc(n)}"${n === chosen ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
      };
      panel.innerHTML = `<div style="margin-top:10px;padding:10px;border:1px solid #e5e7eb;border-radius:10px;">
        <p class="muted" style="margin:0 0 6px;font-size:12px;">শিক্ষাবর্ষ ${esc(current.year || '-')} এর জন্য:</p>
        ${sel(0)}${sel(1)}${sel(2)}
        <p id="frCfgErr" class="muted" style="color:#dc2626;"></p>
        <button class="small" onclick="frSaveConfig()">সংরক্ষণ করুন</button>
      </div>`;
    }).catch(e => { panel.innerHTML = '<p class="muted">লোড ব্যর্থ: ' + esc(e.message) + '</p>'; });
  };

  window.frSaveConfig = function () {
    if (!current || !isAdmin()) return;
    const names = [0, 1, 2].map(i => { const s = el('frSel' + i); return s ? s.value : ''; });
    const err = el('frCfgErr');
    if (names.some(n => !n) || new Set(names).size !== 3) { if (err) err.textContent = 'তিনটি সেমিস্টারে তিনটি আলাদা পরীক্ষা বাছুন'; return; }
    const patch = { finalResultExams: {} };
    patch.finalResultExams[yk(current.year)] = names;
    db.collection('madrasas').doc(madrasaId).set(patch, { merge: true }).then(() => {
      appSettings.finalResultExams = Object.assign({}, appSettings.finalResultExams || {}, patch.finalResultExams);
      window.viewMarksheet(current.studentId, current.docId);
    }).catch(e => { if (err) err.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; });
  };

  // ---------- চূড়ান্ত মেধাক্রম (অবস্থান) ----------
  window.frRecomputeRanks = function () {
    if (!current || typeof role === 'undefined' || role !== 'teacher') return;
    if (current.names.length < 3) { alert('আগে তিনটি সেমিস্টার নির্ধারণ করুন'); return; }
    if (!confirm('এই শিক্ষাবর্ষের সব শ্রেণির চূড়ান্ত অবস্থান নতুন করে হিসাব হবে। এগিয়ে যাবেন?')) return;
    const names = current.names, year = current.year;
    Promise.all(names.map(n => db.collection('results').where('madrasaId', '==', madrasaId).where('examName', '==', n).get()))
      .then(snaps => {
        const per = {};
        snaps.forEach((snap, i) => snap.docs.forEach(d => {
          const r = d.data();
          if ((r.academicYear || '') !== year || !Array.isArray(r.subjects) || !r.subjects.length) return;
          (per[r.studentId] = per[r.studentId] || [null, null, null])[i] = Object.assign({ id: d.id }, r);
        }));
        const groups = {}, ops = [];
        const del = firebase.firestore.FieldValue.delete();
        Object.keys(per).forEach(sid => {
          const rs = per[sid], st = studentsCache.find(s => s.id === sid), m = model(rs);
          if (m.complete && !m.failed && st && st.className) {
            (groups[st.className] = groups[st.className] || []).push({ m, roll: st.roll, id3: rs[2].id });
          } else if (rs[2]) {
            ops.push({ id: rs[2].id, data: { finalRank: del, finalRankTotal: del } });
          }
        });
        Object.keys(groups).forEach(c => {
          const list = groups[c].sort((a, b) => (b.m.gpa - a.m.gpa) || (b.m.marks - a.m.marks) || meritRollCompare(a.roll, b.roll));
          list.forEach((x, idx) => ops.push({ id: x.id3, data: { finalRank: idx + 1, finalRankTotal: list.length } }));
        });
        const commits = [];
        for (let i = 0; i < ops.length; i += 400) {
          const batch = db.batch();
          ops.slice(i, i + 400).forEach(o => batch.update(db.collection('results').doc(o.id), o.data));
          commits.push(batch.commit());
        }
        return Promise.all(commits);
      })
      .then(() => { alert('চূড়ান্ত মেধাক্রম হালনাগাদ হয়েছে'); window.viewMarksheet(current.studentId, current.docId); })
      .catch(e => { alert('হালনাগাদ ব্যর্থ: ' + e.message); if (typeof showDiagBanner === 'function') showDiagBanner('চূড়ান্ত মেধাক্রম ব্যর্থ: ' + e.message); });
  };

  // ---------- সুপার অ্যাডমিন: মাদ্রাসাভিত্তিক চালু/বন্ধ ----------
  let flags = {}, flagUnsub = null, listObs = null;

  function paintToggles() {
    const wrap = el('madrasasListWrap');
    if (!wrap) return;
    wrap.querySelectorAll('.student-row').forEach(row => {
      if (row.querySelector('.frToggle')) return;
      const b = row.querySelector('button[onclick*="toggleMadrasaActive"]');
      const m = b && (b.getAttribute('onclick') || '').match(/toggleMadrasaActive\('([^']*)'/);
      if (!m) return;
      const on = flags[m[1]] !== false;
      const box = document.createElement('div');
      box.className = 'frToggle';
      box.style.marginTop = '6px';
      box.innerHTML = `<button class="small ${on ? '' : 'secondary'}" onclick="frToggleMadrasa('${jsq(m[1])}', ${on})">চূড়ান্ত ফলাফল: ${on ? 'চালু' : 'বন্ধ'}</button>`;
      row.appendChild(box);
    });
  }

  function stopFlags() {
    if (flagUnsub) { flagUnsub(); flagUnsub = null; }
    if (listObs) { listObs.disconnect(); listObs = null; }
  }

  const origListen = window.listenMadrasasList;
  if (typeof origListen === 'function') {
    window.listenMadrasasList = function () {
      const r = origListen.apply(this, arguments);
      stopFlags();
      flagUnsub = db.collection('madrasas').onSnapshot(snap => {
        flags = {};
        snap.docs.forEach(d => { flags[d.id] = d.data().finalResultEnabled; });
        const wrap = el('madrasasListWrap');
        if (wrap) wrap.querySelectorAll('.frToggle').forEach(x => x.remove());
        paintToggles();
      }, () => { /* ignore */ });
      const wrap = el('madrasasListWrap');
      if (wrap) { listObs = new MutationObserver(paintToggles); listObs.observe(wrap, { childList: true }); }
      return r;
    };
  }
  const origStop = window.stopMadrasasListener;
  if (typeof origStop === 'function') {
    window.stopMadrasasListener = function () { stopFlags(); return origStop.apply(this, arguments); };
  }

  window.frToggleMadrasa = function (id, currentlyOn) {
    if (!isSuperAdminUser) { alert('এটি শুধু সুপার অ্যাডমিন পরিবর্তন করতে পারেন'); return; }
    const msg = currentlyOn
      ? 'এই মাদ্রাসার মার্কশিট থেকে "চূড়ান্ত ফলাফল" অংশটি বন্ধ করবেন?'
      : 'এই মাদ্রাসার জন্য "চূড়ান্ত ফলাফল" অংশটি চালু করবেন?';
    if (!confirm(msg)) return;
    db.collection('madrasas').doc(id).set({ finalResultEnabled: !currentlyOn }, { merge: true })
      .catch(e => { alert('আপডেট ব্যর্থ: ' + e.message); if (typeof showDiagBanner === 'function') showDiagBanner('চূড়ান্ত ফলাফল সুইচ ব্যর্থ: ' + e.message); });
  };
})();
