/* ShikkhaOS — এডমিট কার্ড (প্রবেশপত্র): শিক্ষক শ্রেণি বেছে পুরো ক্লাসের কার্ড একসাথে প্রিন্ট/PDF করেন
 *
 * index.html-এ teacher-attendance.js এর নিচে, teacher-gate.js এর আগে লোড হবে:
 *   <script defer src="admit-card.js"></script>
 *
 * app.js ও অন্য কোনো ফাইল বদলাতে হয় না। কার্ডে রুটিন নেই, তাই examRoutines কালেকশন পড়াও হয় না।
 * কার্ডে যা থাকে: বিসমিল্লাহ, মাদ্রাসার লোগো ও নাম, "প্রবেশপত্র", পরীক্ষার নাম,
 * শিক্ষার্থীর ছবি (কমানের খিলানে)/নাম/রোল/শ্রেণি/পিতার নাম, নির্দেশনা, আসন নং ও কক্ষ নং-এর ঘর, স্বাক্ষর।
 * পিতার নাম আসে student_contacts থেকে; ছবি আসে student_photos থেকে
 * (শুধু অ্যাডমিন শিক্ষকের লগইনে, কারণ ছবির নিয়মই তাই)।
 * প্রতি পাতায় ৬টি (সাশ্রয়ী) অথবা ৪টি (নির্দেশনাসহ বড় কার্ড), দুটোই A4-এ কাটার দাগসহ।
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
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  // পিতার নাম: student_contacts (parent-names.js যেখানে জমা করে) — অ্যাপের studentContactsCache থেকে
  const fatherOf = id => {
    const c = (typeof studentContactsCache !== 'undefined' && studentContactsCache[id]) || {};
    return String(c.fatherName || '').trim();
  };
  // ছবি: সুরক্ষিত student_photos কালেকশন (student-photo.js)। নিয়ম অনুযায়ী শুধু অ্যাডমিন শিক্ষক পড়তে পারেন
  const isAdmin = () => typeof myTeacherIsAdmin !== 'undefined' && myTeacherIsAdmin === true;
  const JPEG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  const okPhoto = p => typeof p === 'string' && p.length < 80000 && JPEG_RE.test(p);

  const DEFAULT_NOTE = [
    'প্রবেশপত্র ছাড়া পরীক্ষার হলে প্রবেশ করা যাবে না।',
    'পরীক্ষা শুরুর ১৫ মিনিট আগে হলে উপস্থিত হতে হবে।',
    'কলম, পেন্সিলসহ প্রয়োজনীয় সামগ্রী নিজে সাথে আনতে হবে।',
    'অসদুপায় অবলম্বন করলে পরীক্ষা বাতিল করা হবে।'
  ].join('\n');

  let acClass = '', acOpen = false;
  let acMode = ls.get('ac_mode', '6') === '4' ? '4' : '6';
  let acExam = ls.get('ac_exam', '');
  let acNote = ls.get('ac_note', DEFAULT_NOTE);
  let acOff = new Set();        // বাদ দেওয়া শিক্ষার্থী
  const acPhotos = {};          // studentId -> JPEG data URL ('' = ছবি নেই)
  const acAsked = new Set();    // যাদের ছবি আনার অনুরোধ আগেই গেছে (সেশনে একবারই)
  let typeTimer = null;

  // ================= ডিজাইন =================
  const PAT_W = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='.12'%3E%3Crect x='10' y='10' width='28' height='28'/%3E%3Crect x='10' y='10' width='28' height='28' transform='rotate(45 24 24)'/%3E%3C/g%3E%3C/svg%3E\")";
  const PAT_T = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%230f766e' stroke-opacity='.07'%3E%3Crect x='10' y='10' width='28' height='28'/%3E%3Crect x='10' y='10' width='28' height='28' transform='rotate(45 24 24)'/%3E%3C/g%3E%3C/svg%3E\")";
  const old = el('acStyle');
  if (old) old.remove();
  const st = document.createElement('style');
  st.id = 'acStyle';
  st.textContent = `
.ac-wrap{--ac-teal:#0f766e;--ac-deep:#0a3a35;--ac-gold:#e0b04f;--ac-gold-d:#8a5a00;--ac-ink:#14302c;--ac-mute:#5b716d;--ac-paper:#fffcf3;--pg:#f2f5f7}
.ac-ui .ac-segb{width:auto;margin:0;flex:1;padding:10px 8px;border:0;border-radius:12px;background:#eef2f5;color:#334155;font:inherit;font-weight:700;cursor:pointer}
.ac-ui .ac-segb.on{background:var(--ac-deep);color:#fff}
.ac-seg{display:flex;gap:8px;margin-top:4px}
.ac-hint{font-size:12.5px;color:#64748b;margin:6px 2px 0;line-height:1.55}
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

/* ---------- কার্ড ---------- */
.ac-card{position:relative;box-sizing:border-box;width:94mm;height:136mm;border:2.5px solid transparent;border-radius:17px;overflow:hidden;display:flex;flex-direction:column;color:var(--ac-ink);font-size:11px;line-height:1.4;zoom:var(--z,1);-webkit-print-color-adjust:exact;print-color-adjust:exact;
  background:${PAT_T} 0 0/48px 48px padding-box,linear-gradient(var(--ac-paper),var(--ac-paper)) padding-box,linear-gradient(135deg,#f6dc8e,#b9811a 48%,#f6dc8e) border-box;box-shadow:0 12px 26px -14px rgba(10,58,53,.55)}
.ac-m6 .ac-card{height:89mm}
.ac-card::before{content:"";position:absolute;inset:0;background:var(--wm,none) center 70%/40% no-repeat;opacity:.05;pointer-events:none}
.ac-card::after{content:"";position:absolute;inset:4px;border:1px solid rgba(185,129,26,.45);border-radius:13px;pointer-events:none;z-index:5}
.ac-card>*{position:relative;z-index:1}
.ac-card>.ac-bar{position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(90deg,#0a3a35,#0f766e 45%,#e0b04f);z-index:3}

.ac-head{flex:none;text-align:center;color:#fff;padding:7px 10px 28px;background:${PAT_W},linear-gradient(160deg,#0a3a35 0%,#0f766e 100%);border-bottom:3px solid var(--ac-gold);border-radius:0 0 28px 28px}
.ac-m6 .ac-head{padding:5px 10px 21px}
.ac-bism{font-family:'Noto Naskh Arabic','Amiri','Scheherazade New',serif;direction:rtl;font-size:13px;line-height:1.6;color:var(--ac-gold)}
.ac-m6 .ac-bism{font-size:11.5px;line-height:1.5}
.ac-brand{display:flex;flex-direction:column;align-items:center;gap:3px}
.ac-m6 .ac-brand{flex-direction:row;justify-content:center;gap:7px}
.ac-logo{width:36px;height:36px;border-radius:50%;background:#fff;object-fit:contain;padding:3px;box-sizing:border-box;box-shadow:0 0 0 2px rgba(224,176,79,.95);display:block}
.ac-m6 .ac-logo{width:28px;height:28px;padding:2px}
.ac-mname{font-size:12.5px;font-weight:700;line-height:1.4}
.ac-title{font-size:23px;font-weight:800;line-height:1.25;margin-top:2px;text-shadow:0 2px 6px rgba(0,0,0,.25)}
.ac-m6 .ac-title{font-size:19px;margin-top:0}
.ac-orn{display:flex;align-items:center;gap:6px;margin:3px 30px 5px}
.ac-m6 .ac-orn{margin:1px 34px 3px}
.ac-orn:before,.ac-orn:after{content:"";flex:1;height:1px;background:rgba(224,176,79,.85)}
.ac-orn i{width:6px;height:6px;background:var(--ac-gold);transform:rotate(45deg);flex:none}
.ac-pill{display:inline-block;max-width:100%;padding:2px 14px;border-radius:99px;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(224,176,79,.8);font-size:11.5px;font-weight:600;line-height:1.5}

.ac-stu{flex:none;display:flex;align-items:center;gap:11px;margin:-17px 12px 0;padding:10px 11px;background:#fff;border-radius:15px;box-shadow:0 9px 20px -9px rgba(10,58,53,.5),0 0 0 1px #e6dcc0;z-index:2}
.ac-m6 .ac-stu{margin-top:-14px;padding:8px 10px}
.ac-photo{flex:none;width:58px;height:72px;margin:2px;border-radius:29px 29px 10px 10px;background:linear-gradient(160deg,#14b8a6,#0f766e);box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--ac-gold);overflow:hidden;display:grid;place-items:center;color:#fff;font-size:27px;font-weight:800}
.ac-m6 .ac-photo{width:52px;height:64px;border-radius:26px 26px 9px 9px}
.ac-photo img{width:100%;height:100%;object-fit:cover;display:block}
.ac-f{flex:1;min-width:0}
.ac-lbl{font-size:9px;font-weight:700;letter-spacing:.3px;color:var(--ac-gold-d)}
.ac-name{font-size:15.5px;font-weight:800;color:var(--ac-deep);line-height:1.3;overflow-wrap:anywhere}
.ac-name::after{content:"";display:block;width:28px;height:3px;border-radius:2px;background:var(--ac-gold);margin:3px 0 4px}
.ac-kv{display:flex;gap:6px;margin-top:1px}
.ac-kv span{color:var(--ac-mute);flex:none}
.ac-kv b{font-weight:700;overflow-wrap:anywhere}
.ac-roll{flex:none;min-width:48px;box-sizing:border-box;border-radius:13px;background:linear-gradient(160deg,#f6dc8e,#e0b04f);color:var(--ac-deep);text-align:center;padding:7px 6px 8px;box-shadow:0 5px 10px -5px rgba(138,90,0,.7)}
.ac-roll small{display:block;font-size:9.5px;font-weight:700;color:#6b4300}
.ac-roll b{display:block;font-size:22px;line-height:1.15;font-weight:800}

.ac-ins{flex:1;min-height:0;padding:16px 16px 2px;overflow:hidden}
.ac-ins-h{display:flex;align-items:center;gap:8px;color:var(--ac-gold-d);font-weight:800;font-size:12px;margin-bottom:10px}
.ac-ins-h:before,.ac-ins-h:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(185,129,26,.6))}
.ac-ins-h:after{background:linear-gradient(270deg,transparent,rgba(185,129,26,.6))}
.ac-ins ul{list-style:none;margin:0;padding:0}
.ac-ins li{position:relative;padding-left:15px;font-size:10.9px;line-height:1.6;margin-bottom:7px}
.ac-ins li:before{content:"";position:absolute;left:3px;top:.62em;width:5px;height:5px;background:var(--ac-gold);transform:rotate(45deg)}
.ac-grow{flex:1;min-height:0}
.ac-fill{flex:none;display:flex;gap:16px;padding:6px 15px 0}
.ac-m6 .ac-fill{padding-top:4px}
.ac-fill div{flex:1;display:flex;align-items:flex-end;gap:6px;font-size:10px;font-weight:700;color:var(--ac-deep)}
.ac-fill i{flex:1;height:13px;border-bottom:1.3px dotted #6b7f7b}
.ac-foot{flex:none;padding:3px 15px 15px}
.ac-sig{display:flex;gap:26px;margin-top:14px}
.ac-m6 .ac-sig{margin-top:12px}
.ac-sig div{flex:1;border-top:1.2px solid var(--ac-ink);text-align:center;font-size:10px;font-weight:700;padding-top:2px}

@media print{
  body.ac-pm > :not(#app){display:none !important}
  body.ac-pm{background:#fff !important;background-image:none !important;padding:0 !important;margin:0 !important}
  body.ac-pm #app{padding:0 !important;margin:0 !important;max-width:none !important;background:none !important}
  body.ac-pm .ac-ui,body.ac-pm .ac-pglbl{display:none !important}
  body.ac-pm .ac-sheet{--pg:#fff;margin:0;padding:0}
  body.ac-pm .ac-page{display:grid;grid-template-columns:repeat(2,94mm);gap:5mm;justify-content:center;align-content:start;break-after:page;page-break-after:always}
  body.ac-pm .ac-page:last-child{break-after:auto;page-break-after:auto}
  body.ac-pm .ac-card{zoom:1 !important;box-shadow:none;break-inside:avoid;page-break-inside:avoid}
}`;
  document.head.appendChild(st);

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
  function rollCmp(a, b) {
    const ra = a.roll == null ? '' : String(a.roll), rb = b.roll == null ? '' : String(b.roll);
    const na = Number(ra), nb = Number(rb);
    if (ra !== '' && rb !== '' && !isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return ra.localeCompare(rb, 'bn') || String(a.name).localeCompare(String(b.name), 'bn');
  }
  // নির্দেশনার প্রতি লাইন একটি পয়েন্ট; আগের ১. ২. বা • চিহ্ন বাদ যায়
  function noteLines() {
    return String(acNote || '').split(/\n+/)
      .map(t => t.replace(/^\s*(?:[\d০-৯]+\s*[.)।]|[•\-–#*])\s*/, '').trim())
      .filter(Boolean).slice(0, 6);
  }

  // ================= কার্ড =================
  function cardHtml(s, b) {
    const father = fatherOf(s.id);
    const photo = okPhoto(acPhotos[s.id]) ? acPhotos[s.id] : '';
    const cls = String(s.className || '').trim();
    const clsText = cls && !/শ্রেণি/.test(cls) ? cls + ' শ্রেণি' : cls;
    const lines = acMode === '4' ? noteLines() : [];
    return `<div class="ac-card">
  <div class="ac-head">
    <div class="ac-bism">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
    <div class="ac-brand">${b.logo ? `<img class="ac-logo" src="${esc(b.logo)}" alt="">` : ''}${b.name ? `<div class="ac-mname">${esc(b.name)}</div>` : ''}</div>
    <div class="ac-title">প্রবেশপত্র</div>
    <div class="ac-orn"><i></i></div>
    ${acExam ? `<div class="ac-pill">${esc(acExam)}</div>` : ''}
  </div>
  <div class="ac-stu">
    <div class="ac-photo">${photo ? `<img src="${esc(photo)}" alt="">` : esc(Array.from(s.name || '?')[0])}</div>
    <div class="ac-f">
      <div class="ac-lbl">পরীক্ষার্থী</div>
      <div class="ac-name">${esc(s.name)}</div>
      ${father ? `<div class="ac-kv"><span>পিতা</span><b>${esc(father)}</b></div>` : ''}
      ${clsText ? `<div class="ac-kv"><span>শ্রেণি</span><b>${esc(clsText)}</b></div>` : ''}
    </div>
    ${s.roll ? `<div class="ac-roll"><small>রোল</small><b>${esc(bn(s.roll))}</b></div>` : ''}
  </div>
  ${lines.length ? `<div class="ac-ins"><div class="ac-ins-h">নির্দেশনা</div><ul>${lines.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '<div class="ac-grow"></div>'}
  <div class="ac-fill"><div><span>আসন নং</span><i></i></div><div><span>কক্ষ নং</span><i></i></div></div>
  <div class="ac-foot"><div class="ac-sig"><div>শ্রেণি শিক্ষক</div><div>অধ্যক্ষ / মুহতামিম</div></div></div>
  <div class="ac-bar"></div>
</div>`;
  }

  // ================= স্ক্রিন =================
  function ctx() {
    const classes = typeof getClassList === 'function' ? getClassList() : [];
    if (!acClass || classes.indexOf(acClass) < 0) acClass = classes[0] || '';
    const students = (typeof studentsCache !== 'undefined' ? studentsCache : []).filter(s => (s.className || '') === acClass).sort(rollCmp);
    const picked = students.filter(s => !acOff.has(s.id));
    return { classes, students, picked };
  }

  function fit() {
    const sh = el('acSheet');
    if (!sh) return;
    const w = 94 * 3.7795;
    sh.style.setProperty('--z', String(Math.min(1, (sh.clientWidth || w) / w)));
  }

  function paintSheet(c) {
    const sh = el('acSheet'), sum = el('acSum'), btn = el('acPrintBtn');
    if (!sh) return;
    sh.className = 'ac-sheet ac-m' + acMode;
    const per = acMode === '4' ? 4 : 6;
    const cards = c.picked.length;
    const pages = Math.ceil(cards / per);
    const ready = !!acExam.trim() && cards > 0;
    if (sum) sum.textContent = !acExam.trim() ? 'প্রথমে পরীক্ষার নাম লিখুন' : cards ? bn(cards) + 'টি কার্ড, ' + bn(pages) + 'টি পাতা' : 'কোনো শিক্ষার্থী বাছা হয়নি';
    if (btn) btn.disabled = !ready;
    if (!cards) { sh.innerHTML = ''; return; }
    const b = madrasaBrand();
    let html = '';
    for (let p = 0; p < pages; p++) {
      html += `<div class="ac-pglbl">পাতা ${bn(p + 1)} / ${bn(pages)}</div><div class="ac-page">`
        + c.picked.slice(p * per, (p + 1) * per).map(s => cardHtml(s, b)).join('') + '</div>';
    }
    sh.innerHTML = html;
    sh.style.setProperty('--wm', b.logo ? 'url("' + b.logo.replace(/"/g, '%22') + '")' : 'none');
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
      <label>শ্রেণি</label>
      <select onchange="acPickClass(this.value)">${c.classes.length ? c.classes.map(x => opt(x, x, x === acClass)).join('') : '<option value="">কোনো শ্রেণি নেই</option>'}</select>
      <label>পরীক্ষার নাম</label>
      <input id="acExam" value="${esc(acExam)}" placeholder="যেমন: ৩য় সেমিস্টার পরীক্ষা ২০২৬" oninput="acSetExam(this.value)">
      <label>প্রতি পাতায় কার্ড</label>
      <div class="ac-seg"><button class="ac-segb${acMode === '6' ? ' on' : ''}" onclick="acSetMode('6')">৬টি (সাশ্রয়ী)</button><button class="ac-segb${acMode === '4' ? ' on' : ''}" onclick="acSetMode('4')">৪টি (নির্দেশনাসহ)</button></div>
      ${acMode === '4' ? `<label>নির্দেশনা (প্রতি লাইনে একটি পয়েন্ট)</label>
      <textarea id="acNote" rows="5" oninput="acSetNote(this.value)">${esc(acNote)}</textarea>
      <p class="ac-hint">সর্বোচ্চ ৬টি পয়েন্ট কার্ডে ছাপা হবে।</p>` : ''}
      <details${acOpen ? ' open' : ''} ontoggle="acSetOpen(this.open)">
        <summary>শিক্ষার্থী বাছাই (${bn(c.picked.length)}/${bn(c.students.length)})</summary>
        <div class="ac-tools"><button class="secondary small" onclick="acAll(true)">সবাই</button><button class="secondary small" onclick="acAll(false)">কেউ না</button></div>
        <div class="ac-stulist">${c.students.map(s => `<label class="ac-row"><input type="checkbox" ${acOff.has(s.id) ? '' : 'checked'} onchange="acTog('${jsq(s.id)}')"><span>${esc(s.name)}</span><small>${s.roll ? 'রোল ' + esc(bn(s.roll)) : ''}</small></label>`).join('') || '<p class="muted">এই শ্রেণিতে কোনো শিক্ষার্থী নেই</p>'}</div>
      </details>
      <p id="acSum" class="ac-sum"></p>
      ${isAdmin() ? '' : '<p class="ac-hint" style="margin:0 2px 10px;">শিক্ষার্থীর ছবি শুধু অ্যাডমিন শিক্ষকের লগইনে কার্ডে আসে।</p>'}
      <button id="acPrintBtn" onclick="acPrint()">প্রিন্ট / PDF করুন</button>`;
  }

  function paint() {
    if (!el('acUi')) return;
    const c = ctx();
    paintUi(c);
    paintSheet(c);
  }

  function show() {
    acOff = new Set();
    setScreen('<div class="ac-wrap" id="acWrap"><div class="ac-ui card" id="acUi">লোড হচ্ছে...</div><div class="ac-sheet ac-m6" id="acSheet"></div></div>');
    let tries = 0;
    const go = () => {
      if (!el('acUi')) return;
      // শিক্ষার্থী তালিকা দেরিতে এলে একটু অপেক্ষা
      if ((typeof studentsCache === 'undefined' || !studentsCache.length) && tries++ < 20) { setTimeout(go, 400); return; }
      paint();
    };
    go();
  }

  // ================= ক্রিয়া =================
  const later = () => { clearTimeout(typeTimer); typeTimer = setTimeout(() => { if (el('acSheet')) paintSheet(ctx()); }, 250); };
  window.acPickClass = v => { acClass = v; acOff = new Set(); paint(); };
  window.acSetExam = v => { acExam = String(v || ''); ls.set('ac_exam', acExam); later(); };
  window.acSetNote = v => { acNote = String(v || ''); ls.set('ac_note', acNote); later(); };
  window.acSetMode = m => { acMode = m === '4' ? '4' : '6'; ls.set('ac_mode', acMode); paint(); };
  window.acSetOpen = o => { acOpen = !!o; };
  window.acAll = on => { acOff = on ? new Set() : new Set(ctx().students.map(s => s.id)); paint(); };
  window.acTog = id => {
    if (acOff.has(id)) acOff.delete(id); else acOff.add(id);
    const c = ctx();
    paintSheet(c); // তালিকা না আঁকলে স্ক্রল জায়গায় থাকে
    const sm = document.querySelector('#acUi summary');
    if (sm) sm.textContent = 'শিক্ষার্থী বাছাই (' + bn(c.picked.length) + '/' + bn(c.students.length) + ')';
  };
  window.acPrint = function () {
    const sh = el('acSheet');
    if (!sh || !sh.querySelector('.ac-card') || !acExam.trim()) return;
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
