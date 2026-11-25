/* ShikkhaOS — এডমিট কার্ড (প্রবেশপত্র): শিক্ষক শ্রেণি ও পরীক্ষা বেছে পুরো ক্লাসের কার্ড একসাথে প্রিন্ট/PDF করেন
 *
 * index.html-এ teacher-attendance.js এর নিচে, teacher-gate.js এর আগে লোড হবে:
 *   <script defer src="teacher-attendance.js"></script>
 *   <script defer src="admit-card.js"></script>
 *   <script defer src="teacher-gate.js"></script>
 *
 * app.js / dashboard.js / exam-routine.js এর কিছুই বদলাতে হয় না। নতুন Firestore rule বা index-ও লাগে না:
 * শুধু আগে থেকে থাকা 'examRoutines' কালেকশন একবার পড়া হয় (৫ মিনিট মনে রাখে), তাই রিডও খুব কম।
 *
 * কার্ডে যা থাকে: মাদ্রাসার লোগো ও নাম, পরীক্ষার নাম, শিক্ষার্থীর ছবি/নাম/রোল/শ্রেণি/পিতার নাম,
 * ওই শ্রেণির রুটিন (তারিখ, বার, বিষয়, সময়), নির্দেশনা ও স্বাক্ষরের ঘর।
 * পিতার নাম আসে student_contacts থেকে; ছবি আসে student_photos থেকে (শুধু অ্যাডমিন শিক্ষকের লগইনে, কারণ নিয়মই তাই)।
 * প্রতি পাতায় ৪টি (সাশ্রয়ী) অথবা ২টি (বড়, পাশাপাশি লেআউট) A4 কার্ড।
 */
(function () {
  'use strict';

  if (typeof teacherTab !== 'function' || typeof db === 'undefined' || typeof setScreen !== 'function') {
    console.error('[admit-card] app.js ও অন্য ফাইলের পরে admit-card.js লোড করুন।');
    return;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jsq = s => esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, ' '));
  const bn = n => String(n).replace(/\d/g, c => '০১২৩৪৫৬৭৮৯'[c]);
  const el = id => document.getElementById(id);
  const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const safeImg = u => (/^(data:image\/|https:\/\/)/i.test(String(u || '')) ? String(u) : '');
  const WD = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
  // পিতার নাম: student_contacts (parent-names.js যেখানে জমা করে) — অ্যাপের studentContactsCache থেকে
  const fatherOf = id => {
    const c = (typeof studentContactsCache !== 'undefined' && studentContactsCache[id]) || {};
    return String(c.fatherName || '').trim();
  };
  // ছবি: সুরক্ষিত student_photos কালেকশন (student-photo.js)। নিয়ম অনুযায়ী শুধু অ্যাডমিন শিক্ষক পড়তে পারেন
  const isAdmin = () => typeof myTeacherIsAdmin !== 'undefined' && myTeacherIsAdmin === true;
  const JPEG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  const okPhoto = p => typeof p === 'string' && p.length < 80000 && JPEG_RE.test(p);

  let acClass = '', acRid = '', acMode = '4', acOpen = false;
  let acOff = new Set();        // বাদ দেওয়া শিক্ষার্থী
  let acData = null;            // { ts, mid, list }
  let acErr = '';
  const acPhotos = {};          // studentId -> JPEG data URL ('' = ছবি নেই)
  const acAsked = new Set();    // যাদের ছবি আনার অনুরোধ আগেই গেছে (সেশনে একবারই)

  // ================= ডিজাইন =================
  const PATTERN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='.12'%3E%3Crect x='10' y='10' width='28' height='28'/%3E%3Crect x='10' y='10' width='28' height='28' transform='rotate(45 24 24)'/%3E%3C/g%3E%3C/svg%3E\")";
  if (!el('acStyle')) {
    const st = document.createElement('style');
    st.id = 'acStyle';
    st.textContent = `
.ac-wrap{--ac-teal:#0f766e;--ac-deep:#0a3a35;--ac-gold:#e0b04f;--ac-gold-d:#8a5a00;--ac-ink:#14302c;--ac-mute:#5b716d;--pg:#f2f5f7}
.ac-ui .ac-segb{width:auto;margin:0;flex:1;padding:10px 8px;border:0;border-radius:12px;background:#eef2f5;color:#334155;font:inherit;font-weight:700;cursor:pointer}
.ac-ui .ac-segb.on{background:var(--ac-deep);color:#fff}
.ac-seg{display:flex;gap:8px;margin-top:4px}
.ac-ui details{margin:14px 0 4px;background:#f6f9f9;border-radius:14px;padding:10px 12px}
.ac-ui summary{font-weight:700;cursor:pointer}
.ac-stulist{display:grid;gap:6px;margin-top:10px;max-height:260px;overflow:auto}
.ac-tools{display:flex;gap:8px;margin-top:10px}
.ac-tools button{width:auto;margin:0;flex:1}
.ac-ui .ac-row{display:flex;align-items:center;gap:10px;margin:0;padding:8px 10px;border-radius:12px;background:#fff;font-weight:600;font-size:14px}
.ac-ui .ac-row input{width:18px;height:18px;margin:0;flex:none}
.ac-row small{margin-left:auto;color:#64748b;font-weight:500}
.ac-sum{margin:12px 2px 10px;font-weight:700;color:var(--ac-deep)}
.ac-sheet{margin-top:6px;padding-bottom:20px}
.ac-pglbl{margin:16px 2px 8px;font-size:12.5px;font-weight:700;color:#64748b}
.ac-page{display:flex;flex-direction:column;align-items:center;gap:14px}

.ac-card{position:relative;box-sizing:border-box;width:94mm;height:136mm;background:#fff;border:1px solid #cfe0db;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;color:var(--ac-ink);font-size:11px;line-height:1.4;zoom:var(--z,1);-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:0 8px 20px -10px rgba(10,58,53,.4)}
.ac-m2 .ac-card{width:194mm;display:grid;grid-template-columns:60mm minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto}
.ac-head{position:relative;flex:none;text-align:center;color:#fff;padding:11px 10px 13px;background:${PATTERN},linear-gradient(160deg,#0a3a35 0%,#0f766e 100%);border-bottom:3px solid var(--ac-gold)}
.ac-m2 .ac-head{grid-row:1/5;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:18px 12px;border-bottom:0;border-right:3px solid var(--ac-gold)}
.ac-logo{width:38px;height:38px;border-radius:50%;background:#fff;object-fit:contain;padding:3px;box-sizing:border-box;margin:0 auto 4px;display:block}
.ac-m2 .ac-logo{width:54px;height:54px}
.ac-mname{font-size:12.5px;font-weight:700;line-height:1.4}
.ac-m2 .ac-mname{font-size:14px}
.ac-title{font-size:22px;font-weight:800;line-height:1.3;margin-top:5px}
.ac-m2 .ac-title{font-size:26px;margin-top:12px}
.ac-pill{display:inline-block;max-width:100%;margin-top:5px;padding:2px 12px;border-radius:99px;background:rgba(255,255,255,.16);font-size:11.5px;font-weight:600;line-height:1.5}
.ac-stu{flex:none;display:flex;align-items:center;gap:10px;padding:10px 10px 8px}
.ac-photo{flex:none;width:58px;height:70px;border-radius:10px;background:linear-gradient(160deg,#e3f3f0,#cfe8e3);box-shadow:inset 0 0 0 1.5px #b7d6cf;overflow:hidden;display:grid;place-items:center;color:var(--ac-teal);font-size:26px;font-weight:800}
.ac-photo img{width:100%;height:100%;object-fit:cover;display:block}
.ac-f{flex:1;min-width:0}
.ac-name{font-size:15px;font-weight:800;color:var(--ac-deep);line-height:1.3;overflow-wrap:anywhere}
.ac-kv{display:flex;gap:6px;margin-top:2px}
.ac-kv span{color:var(--ac-mute);flex:none}
.ac-kv b{font-weight:700;overflow-wrap:anywhere}
.ac-roll{flex:none;min-width:46px;box-sizing:border-box;border-radius:12px;background:var(--ac-deep);color:#fff;text-align:center;padding:6px 6px 7px;box-shadow:inset 0 0 0 1.5px var(--ac-gold)}
.ac-roll small{display:block;font-size:9.5px;color:var(--ac-gold)}
.ac-roll b{display:block;font-size:20px;line-height:1.15}
.ac-perf{position:relative;flex:none;height:0;margin:2px 12px;border-top:1.5px dashed #b9cfca}
.ac-perf i{position:absolute;top:-8px;width:14px;height:14px;border-radius:50%;background:var(--pg);box-shadow:inset 0 0 0 1px #cfe0db}
.ac-perf i:first-child{left:-19px}
.ac-perf i:last-child{right:-19px}
.ac-m2 .ac-perf i{display:none}
.ac-rt{flex:1;min-height:0;padding:6px 10px 4px;display:flex;flex-direction:column;gap:5px;overflow:hidden}
.ac-rt table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d3e4e0;border-radius:9px;overflow:hidden;font-size:10.5px}
.ac-rt th{background:var(--ac-teal);color:#fff;font-weight:700;padding:3px 6px;text-align:left}
.ac-rt td{padding:2.5px 6px;border-top:1px solid #e3eeeb;vertical-align:middle}
.ac-rt tbody tr:nth-child(even) td{background:#f3f9f7}
.ac-td-d{white-space:nowrap;width:1%}
.ac-td-d b{font-weight:800;color:var(--ac-deep)}
.ac-td-d em{font-style:normal;color:var(--ac-mute);margin-left:5px;font-size:9.5px}
.ac-td-s{font-weight:600}
.ac-td-s i{display:block;font-style:normal;font-weight:500;color:var(--ac-gold-d);font-size:9.5px}
.ac-time{align-self:flex-start;background:#fff4d6;border:1px solid #f0d89a;color:#6b4300;border-radius:99px;padding:2px 10px;font-size:10px;font-weight:700}
.ac-empty{padding:14px 8px;color:var(--ac-mute);text-align:center}
.ac-d2 .ac-rt table{font-size:9.5px}
.ac-d2 .ac-rt td{padding:1.5px 6px}
.ac-d3 .ac-rt table{font-size:8.5px}
.ac-d3 .ac-rt td{padding:1px 5px}
.ac-d3 .ac-rt th{padding:2px 5px}
.ac-foot{flex:none;padding:4px 10px 10px}
.ac-note{font-size:9.5px;color:#5b3f00;background:#fff7e6;border:1px solid #f3dcaa;border-radius:8px;padding:3px 8px;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ac-sig{display:flex;gap:22px;margin-top:16px}
.ac-sig div{flex:1;border-top:1.2px solid var(--ac-ink);text-align:center;font-size:10px;font-weight:700;padding-top:2px}
.ac-m2 .ac-stu{padding:14px 16px 10px}
.ac-m2 .ac-rt{padding:6px 16px 4px}
.ac-m2 .ac-foot{padding:4px 16px 14px}
.ac-m2 .ac-name{font-size:17px}

@media print{
  body.ac-pm > :not(#app){display:none !important}
  body.ac-pm{background:#fff !important;background-image:none !important;padding:0 !important;margin:0 !important}
  body.ac-pm #app{padding:0 !important;margin:0 !important;max-width:none !important;background:none !important}
  body.ac-pm .ac-ui,body.ac-pm .ac-pglbl{display:none !important}
  body.ac-pm .ac-sheet{--pg:#fff;margin:0;padding:0}
  body.ac-pm .ac-page{display:grid;gap:5mm;justify-content:center;align-items:start;break-after:page;page-break-after:always}
  body.ac-pm .ac-m4 .ac-page{grid-template-columns:repeat(2,94mm)}
  body.ac-pm .ac-m2 .ac-page{grid-template-columns:194mm}
  body.ac-pm .ac-page:last-child{break-after:auto;page-break-after:auto}
  body.ac-pm .ac-card{zoom:1 !important;box-shadow:none;break-inside:avoid;page-break-inside:avoid}
}`;
    document.head.appendChild(st);
  }

  // ================= ন্যাভ ট্যাব =================
  if (typeof teacherMoreTabs !== 'undefined' && !teacherMoreTabs.some(t => t.key === 'admitcard')) {
    const i = teacherMoreTabs.findIndex(t => t.key === 'examroutine');
    teacherMoreTabs.splice(i > -1 ? i + 1 : 0, 0, { key: 'admitcard', label: 'এডমিট কার্ড', icon: '\u{1F3AB}' });
  }

  // ================= সহায়ক =================
  function madrasaBrand() {
    let name = '', logo = '';
    try {
      if (typeof appSettings === 'object' && appSettings) {
        name = appSettings.madrasaName || '';
        logo = appSettings.logo || appSettings.logoUrl || appSettings.logoDataUrl || appSettings.madrasaLogo || '';
      }
    } catch (e) { /* ignore */ }
    try {
      const h = document.querySelector('header');
      if (h && !logo) { const im = h.querySelector('img'); if (im) logo = im.getAttribute('src') || ''; }
    } catch (e) { /* ignore */ }
    if (!/^(data:image\/|https?:\/\/|[\w.\-\/]+$)/i.test(String(logo))) logo = '';
    return { name: String(name || '').slice(0, 60), logo: String(logo || '') };
  }
  function dp(iso) {
    if (!isIso(iso)) return null;
    const d = new Date(iso + 'T00:00:00');
    return { day: bn(iso.slice(8, 10)), month: d.toLocaleDateString('bn-BD', { month: 'long' }), wd: WD[d.getDay()] };
  }
  const keyT = t => String(t || '').replace(/\s+/g, '').replace(/পর্যন্ত/g, '');
  function commonTime(rows) {
    const c = {};
    rows.forEach(x => { const k = keyT(x.time); if (k) c[k] = (c[k] || 0) + 1; });
    let best = '';
    Object.keys(c).forEach(k => { if (!best || c[k] > c[best]) best = k; });
    if (best && c[best] * 2 > rows.length) {
      const row = rows.find(x => keyT(x.time) === best);
      return { key: best, text: String(row.time).replace(/\s+/g, ' ').trim() };
    }
    return null;
  }
  function rollCmp(a, b) {
    const ra = a.roll == null ? '' : String(a.roll), rb = b.roll == null ? '' : String(b.roll);
    const na = Number(ra), nb = Number(rb);
    if (ra !== '' && rb !== '' && !isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return ra.localeCompare(rb, 'bn') || String(a.name).localeCompare(String(b.name), 'bn');
  }

  // ================= কার্ড =================
  function routineHtml(r) {
    const rows = Array.isArray(r.rows) ? r.rows : [];
    if (!rows.length) return '<div class="ac-rt"><div class="ac-empty">রুটিন ছবি আকারে দেওয়া আছে, শ্রেণি শিক্ষকের কাছ থেকে দেখে নিন।</div></div>';
    const ct = commonTime(rows);
    const body = rows.map(x => {
      const p = dp(x.date);
      const own = keyT(x.time) && (!ct || keyT(x.time) !== ct.key);
      return `<tr><td class="ac-td-d">${p ? `<b>${p.day} ${esc(p.month)}</b><em>${esc(p.wd)}</em>` : esc(x.date || '')}</td>`
        + `<td class="ac-td-s">${esc(x.subject)}${own ? `<i>${esc(String(x.time).trim())}</i>` : ''}</td></tr>`;
    }).join('');
    return `<div class="ac-rt"><table><thead><tr><th>তারিখ</th><th>বিষয়</th></tr></thead><tbody>${body}</tbody></table>`
      + (ct ? `<div class="ac-time">প্রতিদিন: ${esc(ct.text)}</div>` : '') + '</div>';
  }

  function cardHtml(s, r, b) {
    const rows = Array.isArray(r.rows) ? r.rows : [];
    const dens = rows.length >= 12 ? ' ac-d3' : rows.length >= 9 ? ' ac-d2' : '';
    const father = fatherOf(s.id);
    const photo = okPhoto(acPhotos[s.id]) ? acPhotos[s.id] : '';
    const cls = String(s.className || '').trim();
    const clsText = cls && !/শ্রেণি/.test(cls) ? cls + ' শ্রেণি' : cls;
    return `<div class="ac-card${dens}">
  <div class="ac-head">
    ${b.logo ? `<img class="ac-logo" src="${esc(b.logo)}" alt="">` : ''}
    ${b.name ? `<div class="ac-mname">${esc(b.name)}</div>` : ''}
    <div class="ac-title">প্রবেশপত্র</div>
    ${r.examName ? `<div class="ac-pill">${esc(r.examName)}</div>` : ''}
  </div>
  <div class="ac-stu">
    <div class="ac-photo">${photo ? `<img src="${esc(photo)}" alt="">` : esc(Array.from(s.name || '?')[0])}</div>
    <div class="ac-f">
      <div class="ac-name">${esc(s.name)}</div>
      ${father ? `<div class="ac-kv"><span>পিতা</span><b>${esc(father)}</b></div>` : ''}
      ${clsText ? `<div class="ac-kv"><span>শ্রেণি</span><b>${esc(clsText)}</b></div>` : ''}
    </div>
    ${s.roll ? `<div class="ac-roll"><small>রোল</small><b>${esc(bn(s.roll))}</b></div>` : ''}
  </div>
  <div class="ac-perf"><i></i><i></i></div>
  ${routineHtml(r)}
  <div class="ac-foot">
    ${r.note ? `<div class="ac-note">নির্দেশনা: ${esc(String(r.note).replace(/\s+/g, ' '))}</div>` : ''}
    <div class="ac-sig"><div>শ্রেণি শিক্ষক</div><div>অধ্যক্ষ / মুহতামিম</div></div>
  </div>
</div>`;
  }

  // ================= স্ক্রিন =================
  function ctx() {
    const classes = typeof getClassList === 'function' ? getClassList() : [];
    if (!acClass || classes.indexOf(acClass) < 0) acClass = classes[0] || '';
    const students = (typeof studentsCache !== 'undefined' ? studentsCache : []).filter(s => (s.className || '') === acClass).sort(rollCmp);
    const routines = (acData ? acData.list : []).filter(r => r.className === acClass).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!routines.some(r => r.id === acRid)) acRid = routines[0] ? routines[0].id : '';
    const routine = routines.find(x => x.id === acRid) || null;
    const picked = students.filter(s => !acOff.has(s.id));
    return { classes, students, routines, routine, picked };
  }

  function fit() {
    const sh = el('acSheet');
    if (!sh) return;
    const w = (acMode === '2' ? 194 : 94) * 3.7795;
    sh.style.setProperty('--z', String(Math.min(1, (sh.clientWidth || w) / w)));
  }

  function paintSheet(c) {
    const sh = el('acSheet'), sum = el('acSum'), btn = el('acPrintBtn');
    if (!sh) return;
    sh.className = 'ac-sheet ac-m' + acMode;
    const per = acMode === '2' ? 2 : 4;
    const cards = (c.routine && c.picked.length) ? c.picked.length : 0;
    const pages = Math.ceil(cards / per);
    if (sum) sum.textContent = cards ? bn(cards) + 'টি কার্ড, ' + bn(pages) + 'টি পাতা' : 'কোনো কার্ড তৈরি হয়নি';
    if (btn) btn.disabled = !cards;
    if (!cards) { sh.innerHTML = ''; return; }
    const b = madrasaBrand();
    let html = '';
    for (let p = 0; p < pages; p++) {
      html += `<div class="ac-pglbl">পাতা ${bn(p + 1)} / ${bn(pages)}</div><div class="ac-page">`
        + c.picked.slice(p * per, (p + 1) * per).map(s => cardHtml(s, c.routine, b)).join('') + '</div>';
    }
    sh.innerHTML = html;
    fit();
    loadPhotos(c.picked);
  }

  // অ্যাডমিনের জন্য: বাছাই করা শিক্ষার্থীদের ছবি একবার করে এনে কার্ড আবার আঁকা
  function loadPhotos(list) {
    if (!isAdmin()) return;
    const need = list.filter(s => !acAsked.has(s.id));
    if (!need.length) return;
    need.forEach(s => acAsked.add(s.id));
    Promise.all(need.map(s => db.collection('student_photos').doc(s.id).get()
      .then(d => { acPhotos[s.id] = d.exists ? (d.data().photo || '') : ''; })
      .catch(() => { acPhotos[s.id] = ''; })
    )).then(() => { if (el('acSheet')) paintSheet(ctx()); });
  }

  function paintUi(c) {
    const ui = el('acUi');
    if (!ui) return;
    const opt = (v, t, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(t)}</option>`;
    ui.innerHTML = `<h2>এডমিট কার্ড</h2>
      ${acErr ? `<p class="muted" style="color:#dc2626;">রুটিন লোড করতে সমস্যা: ${esc(acErr)}</p>` : ''}
      <label>শ্রেণি</label>
      <select onchange="acPickClass(this.value)">${c.classes.length ? c.classes.map(x => opt(x, x, x === acClass)).join('') : '<option value="">কোনো শ্রেণি নেই</option>'}</select>
      <label>পরীক্ষা</label>
      ${c.routines.length
        ? `<select onchange="acPickRoutine(this.value)">${c.routines.map(r => opt(r.id, r.examName || 'পরীক্ষা', r.id === acRid)).join('')}</select>`
        : `<p class="muted">এই শ্রেণির কোনো পরীক্ষার রুটিন নেই। আগে রুটিন তৈরি করলে এডমিট কার্ড বানানো যাবে।</p><button class="secondary" onclick="teacherTab('examroutine')">পরীক্ষার রুটিনে যান</button>`}
      <label>প্রতি পাতায় কার্ড</label>
      <div class="ac-seg"><button class="ac-segb${acMode === '4' ? ' on' : ''}" onclick="acSetMode('4')">৪টি (সাশ্রয়ী)</button><button class="ac-segb${acMode === '2' ? ' on' : ''}" onclick="acSetMode('2')">২টি (বড়)</button></div>
      <details${acOpen ? ' open' : ''} ontoggle="acSetOpen(this.open)">
        <summary>শিক্ষার্থী বাছাই (${bn(c.picked.length)}/${bn(c.students.length)})</summary>
        <div class="ac-tools"><button class="secondary small" onclick="acAll(true)">সবাই</button><button class="secondary small" onclick="acAll(false)">কেউ না</button></div>
        <div class="ac-stulist">${c.students.map(s => `<label class="ac-row"><input type="checkbox" ${acOff.has(s.id) ? '' : 'checked'} onchange="acTog('${jsq(s.id)}')"><span>${esc(s.name)}</span><small>${s.roll ? 'রোল ' + esc(bn(s.roll)) : ''}</small></label>`).join('') || '<p class="muted">এই শ্রেণিতে কোনো শিক্ষার্থী নেই</p>'}</div>
      </details>
      <p id="acSum" class="ac-sum"></p>
      ${isAdmin() ? '' : '<p class="muted" style="font-size:12.5px;">শিক্ষার্থীর ছবি শুধু অ্যাডমিন শিক্ষকের লগইনে কার্ডে আসে।</p>'}
      <button id="acPrintBtn" onclick="acPrint()">প্রিন্ট / PDF করুন</button>
      <button class="secondary small" style="margin-top:8px;" onclick="acReload()">রুটিন নতুন করে আনুন</button>`;
  }

  function paint() {
    if (!el('acUi')) return;
    const c = ctx();
    paintUi(c);
    paintSheet(c);
  }

  function load(cb) {
    if (acData && acData.mid === madrasaId && Date.now() - acData.ts < 300000) { cb(); return; }
    acErr = '';
    db.collection('examRoutines').where('madrasaId', '==', madrasaId).get()
      .then(snap => { acData = { ts: Date.now(), mid: madrasaId, list: snap.docs.map(d => Object.assign({ id: d.id }, d.data())) }; cb(); })
      .catch(e => { acErr = e && e.message ? e.message : 'অজানা সমস্যা'; cb(); });
  }

  function show() {
    acOff = new Set();
    setScreen('<div class="ac-wrap" id="acWrap"><div class="ac-ui card" id="acUi">লোড হচ্ছে...</div><div class="ac-sheet ac-m4" id="acSheet"></div></div>');
    let tries = 0;
    const go = () => {
      if (!el('acUi')) return;
      // শিক্ষার্থী তালিকা দেরিতে এলে একটু অপেক্ষা
      if ((typeof studentsCache === 'undefined' || !studentsCache.length) && tries++ < 20) { setTimeout(go, 400); return; }
      load(paint);
    };
    go();
  }

  // ================= ক্রিয়া =================
  window.acPickClass = v => { acClass = v; acOff = new Set(); acRid = ''; paint(); };
  window.acPickRoutine = v => { acRid = v; paint(); };
  window.acSetMode = m => { acMode = m; paint(); };
  window.acSetOpen = o => { acOpen = !!o; };
  window.acAll = on => { acOff = on ? new Set() : new Set(ctx().students.map(s => s.id)); paint(); };
  window.acTog = id => {
    if (acOff.has(id)) acOff.delete(id); else acOff.add(id);
    const c = ctx();
    paintSheet(c); // তালিকা না আঁকলে স্ক্রল জায়গায় থাকে
    const sm = document.querySelector('#acUi summary');
    if (sm) sm.textContent = 'শিক্ষার্থী বাছাই (' + bn(c.picked.length) + '/' + bn(c.students.length) + ')';
  };
  window.acReload = () => { acData = null; const u = el('acUi'); if (u) u.textContent = 'লোড হচ্ছে...'; load(paint); };
  window.acPrint = function () {
    const sh = el('acSheet');
    if (!sh || !sh.querySelector('.ac-card')) return;
    document.body.classList.add('ac-pm');
    const pg = document.createElement('style');
    pg.textContent = '@page{size:A4;margin:8mm}';
    document.head.appendChild(pg);
    const done = () => { document.body.classList.remove('ac-pm'); if (pg.parentNode) pg.parentNode.removeChild(pg); };
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 150);
  };
  window.addEventListener('resize', fit);

  // ================= ট্যাব-ডিসপ্যাচে জোড়া লাগানো =================
  const prevTab = window.teacherTab;
  window.teacherTab = function (tab) {
    if (tab === 'admitcard') {
      if (typeof window.stopTeacherDashboard === 'function') window.stopTeacherDashboard();
      if (typeof renderTeacherNav === 'function') renderTeacherNav('admitcard');
      show();
      return;
    }
    return prevTab.apply(this, arguments);
  };
})();
