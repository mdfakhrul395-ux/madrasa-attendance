/* ShikkhaOS — এডমিট কার্ড (প্রবেশপত্র): শিক্ষক শ্রেণি বেছে পুরো ক্লাসের কার্ড একসাথে প্রিন্ট/PDF করেন
 *
 * index.html-এ teacher-attendance.js এর নিচে, teacher-gate.js এর আগে লোড হবে:
 *   <script defer src="admit-card.js"></script>
 *
 * app.js ও অন্য কোনো ফাইল বদলাতে হয় না। প্রিন্ট: A4 আড়াআড়ি (Landscape) কাগজে এক পাতায় ৪টি কার্ড (২×২),
 * প্রতিটি ১৪০×৯৬ মিমি। হালকা জমিন ও পাতলা রঙিন হেডার, তাই কালি কম লাগে, সাধারণ প্রিন্টারেও স্পষ্ট আসে।
 * পিতার নাম আসে student_contacts থেকে। কার্ডে শিক্ষার্থীর ছবি নেই (আপাতত), তাই student_photos পড়া হয় না।
 * কার্ডের সাজসজ্জার লেখা এই ফোনের localStorage-এ মনে থাকে (Firestore-এ কিছু লেখা হয় না)।
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
  const en = s => String(s).replace(/[০-৯]/g, c => '০১২৩৪৫৬৭৮৯'.indexOf(c));
  const el = id => document.getElementById(id);
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  const fatherOf = id => {
    const c = (typeof studentContactsCache !== 'undefined' && studentContactsCache[id]) || {};
    return String(c.fatherName || '').trim();
  };

  const DEFAULT_NOTE = [
    'পরীক্ষা শুরুর ৩০ মিনিট পূর্বে হলে প্রবেশ করতে হবে।',
    'পরীক্ষার হলে প্রবেশপত্র নিয়ে উপস্থিত হওয়া আবশ্যক।',
    'কোনো প্রকার অসদুপায় অবলম্বন করা যাবে না।',
    'পরীক্ষা চলাকালীন মোবাইল ফোন ব্যবহার সম্পূর্ণ নিষিদ্ধ।'
  ].join('\n');

  const OLD_SIGS = ['শ্রেণি শিক্ষক, পরীক্ষা নিয়ন্ত্রক, অধ্যক্ষ', 'শ্রেণি শিক্ষক, পরীক্ষা নিয়ন্ত্রক, সুপার/অধ্যক্ষ'];
  const NEW_SIGS = 'শ্রেণি শিক্ষক, সুপার/অধ্যক্ষ';
  let acClass = '', acOpen = false, acOpen2 = false;
  let acOff = new Set();
  let typeTimer = null;
  let cfg = null;

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
    return { name: String(name || '').slice(0, 80), logo: String(logo || '') };
  }
  function baseCfg() {
    const aman = /দারুল\s*আমান/.test(madrasaBrand().name);
    return {
      exam: '', year: bn(new Date().getFullYear()), date: '', time: '',
      name: aman ? 'দারুল আমান মাদ্রাসা, মুছাপুর' : '',
      addr: aman ? 'মুছাপুর, কোম্পানীগঞ্জ, নোয়াখালী' : '',
      cl: 'শ্রেণি',
      sigs: NEW_SIGS,
      tag: aman ? 'শিক্ষাই মানুষের শ্রেষ্ঠ সম্পদ' : '',
      note: DEFAULT_NOTE
    };
  }
  function loadCfg() {
    let saved = {};
    try { saved = JSON.parse(ls.get('ac3_cfg', '{}')) || {}; } catch (e) { saved = {}; }
    cfg = Object.assign(baseCfg(), saved);
    if (OLD_SIGS.indexOf(cfg.sigs) > -1) cfg.sigs = NEW_SIGS;
    if (cfg.addr === 'মুছাপুর, কোম্পানীগঞ্জ, নোয়াখালী-৩৮০০') cfg.addr = 'মুছাপুর, কোম্পানীগঞ্জ, নোয়াখালী';   // আগের ডিফল্টের পোস্টকোড বাদ   // আগের ডিফল্ট থাকলে নতুন পদে বদলে দেওয়া
  }
  function saveCfg() { ls.set('ac3_cfg', JSON.stringify(cfg)); }

  // ================= ডিজাইন =================
  const PAT_W = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='.13'%3E%3Crect x='8' y='8' width='24' height='24'/%3E%3Crect x='8' y='8' width='24' height='24' transform='rotate(45 20 20)'/%3E%3C/g%3E%3C/svg%3E\")";
  const PAT_T = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='none' stroke='%231d4ed8' stroke-opacity='.06'%3E%3Crect x='8' y='8' width='24' height='24'/%3E%3Crect x='8' y='8' width='24' height='24' transform='rotate(45 20 20)'/%3E%3C/g%3E%3C/svg%3E\")";
  const old = el('acStyle');
  if (old) old.remove();
  const st = document.createElement('style');
  st.id = 'acStyle';
  st.textContent = `
.ac-wrap{--nv:#1e3a8a;--bl:#1d63d6;--gr:#15803d;--gd:#d4a73a;--ink:#12233f;--pg:#f2f5f7}
.ac-ui details{margin:14px 0 4px;background:#f6f9f9;border-radius:14px;padding:10px 12px}
.ac-ui summary{font-weight:700;cursor:pointer}
.ac-hint{font-size:12.5px;color:#64748b;margin:6px 2px 0;line-height:1.55}
.ac-stulist{display:grid;gap:6px;margin-top:10px;max-height:260px;overflow:auto}
.ac-tools{display:flex;gap:8px;margin-top:10px}
.ac-tools button{width:auto;margin:0;flex:1}
.ac-ui .ac-row{display:flex;align-items:center;gap:10px;margin:0;padding:8px 10px;border-radius:12px;background:#fff;font-weight:600;font-size:14px}
.ac-ui .ac-row input{width:18px;height:18px;margin:0;flex:none}
.ac-row small{margin-left:auto;color:#64748b;font-weight:500}
.ac-sum{margin:12px 2px 10px;font-weight:700;color:var(--nv)}
.ac-sheet{margin-top:6px;padding-bottom:20px}
.ac-pglbl{margin:16px 2px 8px;font-size:12.5px;font-weight:700;color:#64748b}
.ac-page{display:flex;flex-direction:column;align-items:flex-start;gap:14px}

/* ---------- কার্ড: ৫৬০×৩৮৪ ডিজাইন-পিক্সেল (১৪০×৯৬ মিমি), zoom দিয়ে ছোট-বড় হয় ---------- */
.ac-card{position:relative;box-sizing:border-box;width:560px;height:384px;flex:none;overflow:hidden;border:4px solid transparent;border-radius:14px;color:var(--ink);line-height:1.3;zoom:var(--z,1);-webkit-print-color-adjust:exact;print-color-adjust:exact;
  background:${PAT_T} 0 0/40px 40px padding-box,linear-gradient(#fffdf6,#fffdf6) padding-box,linear-gradient(135deg,#1e3a8a,#1aa37a 55%,#d4a73a) border-box;box-shadow:0 10px 24px -14px rgba(30,58,138,.55)}
.ac-card::before{content:"";position:absolute;inset:0;background:var(--wm,none) center 62%/34% no-repeat;opacity:.05;pointer-events:none}
.ac-card>*{position:absolute}
.ac-fit{display:block;width:100%;overflow:hidden;white-space:nowrap}
.ac-hd{left:0;top:0;width:552px;height:66px;background:${PAT_W},linear-gradient(100deg,#1e3a8a 0%,#1d63d6 58%,#0f8f86 100%)}
.ac-logo{left:12px;top:8px;width:50px;height:50px;border-radius:50%;background:#fff;box-shadow:0 0 0 2.5px var(--gd);overflow:hidden;display:grid;place-items:center}
.ac-logo img{width:100%;height:100%;object-fit:contain;padding:3px;box-sizing:border-box}
.ac-nm{left:72px;top:6px;width:468px;height:32px;text-align:center;color:#fff;font-size:27px;font-weight:800;line-height:1.2;text-shadow:0 2px 5px rgba(0,0,0,.3)}
.ac-ad{left:72px;top:39px;width:468px;height:18px;text-align:center;color:#e3efff;font-size:12px;font-weight:600;line-height:1.4}
.ac-ban{left:176px;top:53px;width:200px;height:34px}
.ac-bt{left:176px;top:53px;width:200px;height:30px;text-align:center;color:#fff;font-size:21px;font-weight:800;line-height:30px;text-shadow:0 1px 3px rgba(0,0,0,.3)}
.ac-or{width:36px;height:30px;top:55px}
.ac-ex{left:16px;top:91px;width:520px;height:22px;display:flex;align-items:center;gap:8px}
.ac-ex i{flex:1;height:1.5px;background:linear-gradient(90deg,transparent,var(--gd))}
.ac-ex i:last-child{background:linear-gradient(270deg,transparent,var(--gd))}
.ac-ex .ac-fit{width:auto;max-width:430px;text-align:center;font-size:15px;font-weight:800;color:var(--nv)}
.ac-fs{left:20px;top:118px;width:512px;height:100px;display:flex;flex-direction:column;justify-content:space-between}
.ac-fs.full{width:512px}
.ac-fl{display:flex;gap:18px;height:23px}
.ac-f{flex:1;min-width:0;display:flex;align-items:flex-end;gap:5px}
.ac-f.w2{flex:1.5}
.ac-f b{flex:none;font-size:13px;font-weight:800;color:var(--nv);white-space:nowrap;line-height:1.5}
.ac-f span.v{flex:1;min-width:0;border-bottom:1.4px dotted #6f84b0;padding:0 4px 1px;height:21px;display:flex;align-items:flex-end}
.ac-f .ac-fit{font-size:15px;font-weight:800;color:var(--ink);line-height:1.35}
.ac-sg{left:20px;right:20px;top:254px;display:flex;gap:26px}
.ac-sg div{flex:1;border-top:1.3px solid var(--nv);text-align:center;font-size:11.5px;font-weight:800;color:var(--nv);padding-top:1px;white-space:nowrap;overflow:hidden}
.ac-in{left:14px;top:280px;width:524px;height:74px;box-sizing:border-box;background:linear-gradient(180deg,#eef9ef,#e6f4ff);border:1.5px solid #8fcf9d;border-radius:12px;padding:16px 12px 2px}
.ac-in h4{position:absolute;left:14px;top:-10px;margin:0;background:linear-gradient(90deg,#15803d,#22a55a);color:#fff;border-radius:99px;padding:1px 14px 2px;font-size:12.5px;font-weight:800;line-height:1.5;box-shadow:0 0 0 2px #fffdf6,0 0 0 3.5px var(--gd)}
.ac-in ul{list-style:none;margin:0;padding:0}
.ac-in li{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;line-height:1.3;height:14px;overflow:hidden;white-space:nowrap}
.ac-in li svg{flex:none}
.ac-in.s5{padding-top:14px}
.ac-in.s5 li{font-size:10.2px;height:12px}
.ac-bd{left:0;top:358px;width:552px;height:18px;background:${PAT_W},linear-gradient(90deg,#1e3a8a,#1d63d6 55%,#15803d);color:#fff;text-align:center;font-size:11px;font-weight:700;line-height:18px}
.ac-bd .ac-fit{text-align:center}

@media print{
  body.ac-pm > :not(#app){display:none !important}
  body.ac-pm{background:#fff !important;background-image:none !important;padding:0 !important;margin:0 !important}
  body.ac-pm #app{padding:0 !important;margin:0 !important;max-width:none !important;background:none !important}
  body.ac-pm .ac-ui,body.ac-pm .ac-pglbl{display:none !important}
  body.ac-pm .ac-sheet{--pg:#fff;margin:0;padding:0}
  body.ac-pm .ac-page{display:grid;grid-template-columns:repeat(2,140mm);gap:5mm;justify-content:center;align-content:start;break-after:page;page-break-after:always}
  body.ac-pm .ac-page:last-child{break-after:auto;page-break-after:auto}
  body.ac-pm .ac-card{zoom:.9449 !important;box-shadow:none;break-inside:avoid;page-break-inside:avoid}
}`;
  document.head.appendChild(st);

  if (typeof teacherMoreTabs !== 'undefined' && !teacherMoreTabs.some(t => t.key === 'admitcard')) {
    const i = teacherMoreTabs.findIndex(t => t.key === 'examroutine');
    teacherMoreTabs.splice(i > -1 ? i + 1 : 0, 0, { key: 'admitcard', label: 'এডমিট কার্ড', icon: '\u{1F3AB}' });
  }

  // ================= সহায়ক =================
  function rollCmp(a, b) {
    const ra = a.roll == null ? '' : String(a.roll), rb = b.roll == null ? '' : String(b.roll);
    const na = Number(en(ra)), nb = Number(en(rb));
    if (ra !== '' && rb !== '' && !isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return ra.localeCompare(rb, 'bn') || String(a.name).localeCompare(String(b.name), 'bn');
  }
  function noteLines() {
    return String(cfg.note || '').split(/\n+/)
      .map(t => t.replace(/^\s*(?:[\d০-৯]+\s*[.)।]|[•\-–#*])\s*/, '').trim())
      .filter(Boolean).slice(0, 5);
  }
  const sigList = () => String(cfg.sigs || '').split(/[,،]/).map(t => t.trim()).filter(Boolean).slice(0, 3);

  const bannerSvg = '<svg class="ac-ban" viewBox="0 0 200 34"><defs><linearGradient id="acgb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22a55a"/><stop offset="1" stop-color="#0f6e34"/></linearGradient></defs><path d="M14 1.5 H186 Q186 9 198.5 11 V23 Q186 25 186 32.5 H14 Q14 25 1.5 23 V11 Q14 9 14 1.5Z" fill="url(#acgb)" stroke="#d4a73a" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  const ornSvg = '<svg viewBox="0 0 36 30"><path d="M18 1 L35 15 L18 29 L1 15Z" fill="#16a34a" stroke="#d4a73a" stroke-width="1.6"/><path d="M18 7 L28 15 L18 23 L8 15Z" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="18" cy="15" r="2.6" fill="#fff"/></svg>';
  const chkSvg = '<svg width="12" height="12" viewBox="0 0 17 17"><circle cx="8.5" cy="8.5" r="8.5" fill="#15803d"/><path d="M4.6 8.8l2.7 2.7 5-5.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const logoDefault = '<svg viewBox="0 0 50 50" width="34" height="34"><path d="M10 38 Q25 6 40 38Z" fill="#15803d"/><rect x="9" y="38" width="32" height="4" rx="1.5" fill="#1e3a8a"/></svg>';

  // ================= কার্ড =================
  function cardHtml(s, b) {
    const father = fatherOf(s.id);
    const cls = String(s.className || '').trim();
    const clsText = cls && !/শ্রেণি/.test(cls) && /^শ্রেণি$/.test(cfg.cl) ? cls + ' শ্রেণি' : cls;
    const nameBn = (cfg.name || b.name || '').trim();
    const f = (label, val, w2) => `<div class="ac-f${w2 ? ' w2' : ''}"><b>${esc(label)} :</b><span class="v"><span class="ac-fit" data-fit="9" style="font-size:15px">${esc(val)}</span></span></div>`;
    const yr = String(cfg.year || '').trim();
    let exam = String(cfg.exam || '').trim();
    if (exam && yr && en(exam).indexOf(en(yr)) < 0) exam += ' ' + yr;   // "৩য় সেমিস্টার পরীক্ষা ২০২৬"
    const rows = [`<div class="ac-fl">${f('শিক্ষার্থীর নাম', s.name)}</div>`];
    if (father) rows.push(`<div class="ac-fl">${f('পিতার নাম', father)}</div>`);
    rows.push(`<div class="ac-fl">${f(cfg.cl || 'শ্রেণি', clsText, true)}${f('রোল', s.roll ? bn(s.roll) : '')}${yr ? f('শিক্ষাবর্ষ', yr) : ''}</div>`);
    rows.push(`<div class="ac-fl">${f('পরীক্ষার তারিখ', cfg.date, true)}${cfg.time ? f('সময়', cfg.time) : ''}</div>`);
    const lines = noteLines();
    const sg = sigList();
    return `<div class="ac-card">
  <div class="ac-hd"></div>
  <div class="ac-logo">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : logoDefault}</div>
  ${nameBn ? `<div class="ac-nm"><span class="ac-fit" data-fit="14" style="font-size:27px;text-align:center">${esc(nameBn)}</span></div>` : ''}
  ${cfg.addr ? `<div class="ac-ad"><span class="ac-fit" data-fit="8" style="font-size:12px;text-align:center">${esc(cfg.addr)}</span></div>` : ''}
  <div class="ac-or" style="left:134px">${ornSvg}</div><div class="ac-or" style="left:382px">${ornSvg}</div>
  ${bannerSvg}<div class="ac-bt">প্রবেশপত্র</div>
  <div class="ac-ex"><i></i><span class="ac-fit" data-fit="9" style="font-size:15px">${esc(exam)}</span><i></i></div>
  <div class="ac-fs">${rows.join('')}</div>
  ${sg.length ? `<div class="ac-sg">${sg.map(t => `<div>${esc(t)}</div>`).join('')}</div>` : ''}
  ${lines.length ? `<div class="ac-in${lines.length > 4 ? ' s5' : ''}"><h4>নির্দেশনা</h4><ul>${lines.map(t => `<li>${chkSvg}<span>${esc(t)}</span></li>`).join('')}</ul></div>` : ''}
  <div class="ac-bd">${cfg.tag ? `<span class="ac-fit" data-fit="8" style="font-size:11px">${esc(cfg.tag)}</span>` : ''}</div>
</div>`;
  }

  function fitText() {
    document.querySelectorAll('#acSheet [data-fit]').forEach(e => {
      let fs = parseFloat(e.style.fontSize) || 14;
      const min = Number(e.getAttribute('data-fit')) || 9;
      let guard = 0;
      while (e.scrollWidth > e.clientWidth + 1 && fs > min && guard++ < 40) { fs -= 0.5; e.style.fontSize = fs + 'px'; }
    });
  }

  // ================= স্ক্রিন =================
  function ctx() {
    const classes = typeof getClassList === 'function' ? getClassList() : [];
    if (!acClass || classes.indexOf(acClass) < 0) acClass = classes[0] || '';
    const students = (typeof studentsCache !== 'undefined' ? studentsCache : []).filter(s => (s.className || '') === acClass).sort(rollCmp);
    return { classes, students, picked: students.filter(s => !acOff.has(s.id)) };
  }
  function fit() {
    const sh = el('acSheet');
    if (sh) sh.style.setProperty('--z', String(Math.min(1, (sh.clientWidth || 560) / 560)));
  }

  function paintSheet(c) {
    const sh = el('acSheet'), sum = el('acSum'), btn = el('acPrintBtn');
    if (!sh) return;
    const cards = c.picked.length;
    const pages = Math.ceil(cards / 4);
    const ready = !!cfg.exam.trim() && cards > 0;
    if (sum) sum.textContent = !cfg.exam.trim() ? 'প্রথমে পরীক্ষার নাম লিখুন' : cards ? bn(cards) + 'টি কার্ড, ' + bn(pages) + 'টি পাতা (প্রতি পাতায় ৪টি)' : 'কোনো শিক্ষার্থী বাছা হয়নি';
    if (btn) btn.disabled = !ready;
    if (!cards) { sh.innerHTML = ''; return; }
    const b = madrasaBrand();
    let html = '';
    for (let p = 0; p < pages; p++) {
      html += `<div class="ac-pglbl">পাতা ${bn(p + 1)} / ${bn(pages)}</div><div class="ac-page">`
        + c.picked.slice(p * 4, p * 4 + 4).map(s => cardHtml(s, b)).join('') + '</div>';
    }
    sh.innerHTML = html;
    sh.style.setProperty('--wm', b.logo ? 'url("' + b.logo.replace(/"/g, '%22') + '")' : 'none');
    fit();
    fitText();
  }

  function paintUi(c) {
    const ui = el('acUi');
    if (!ui) return;
    const opt = (v, t, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(t)}</option>`;
    const inp = (k, label, ph) => `<label>${label}</label><input value="${esc(cfg[k])}" placeholder="${esc(ph || '')}" oninput="acCfg('${k}',this.value)">`;
    ui.innerHTML = `<h2>এডমিট কার্ড</h2>
      <label>শ্রেণি</label>
      <select onchange="acPickClass(this.value)">${c.classes.length ? c.classes.map(x => opt(x, x, x === acClass)).join('') : '<option value="">কোনো শ্রেণি নেই</option>'}</select>
      ${inp('exam', 'পরীক্ষার নাম', 'যেমন: ৩য় সেমিস্টার পরীক্ষা')}
      ${inp('year', 'শিক্ষাবর্ষ (পরীক্ষার নামের পাশেও বসবে)', 'যেমন: ২০২৬')}
      ${inp('date', 'পরীক্ষার তারিখ (ঐচ্ছিক)', 'যেমন: ১৫ ডিসেম্বর ২০২৬ থেকে')}
      ${inp('time', 'পরীক্ষার সময় (ঐচ্ছিক)', 'যেমন: সকাল ১০:০০ টা')}
      <label>নির্দেশনা (প্রতি লাইনে একটি, সর্বোচ্চ ৫টি)</label>
      <textarea rows="5" oninput="acCfg('note',this.value)">${esc(cfg.note)}</textarea>
      <details${acOpen2 ? ' open' : ''} ontoggle="acSetOpen2(this.open)">
        <summary>কার্ডের সাজসজ্জা (একবার ঠিক করলেই হবে)</summary>
        ${inp('name', 'মাদ্রাসার নাম (কার্ডের জন্য)', 'ফাঁকা রাখলে সেটিংসের নাম আসবে')}
        ${inp('addr', 'ঠিকানা ও মোবাইল (হেডারের নিচের লাইন)', 'যেমন: মুছাপুর, নোয়াখালী, মোবাইল: ০১৭…')}
        ${inp('cl', 'শ্রেণির লেবেল', 'শ্রেণি অথবা জামায়াত')}
        ${inp('sigs', 'স্বাক্ষরের পদ (কমা দিয়ে, সর্বোচ্চ ৩টি)', 'শ্রেণি শিক্ষক, সুপার/অধ্যক্ষ')}
        ${inp('tag', 'নিচের লাইনের লেখা (ঐচ্ছিক)', '')}
        
      </details>
      <details${acOpen ? ' open' : ''} ontoggle="acSetOpen(this.open)">
        <summary>শিক্ষার্থী বাছাই (${bn(c.picked.length)}/${bn(c.students.length)})</summary>
        <div class="ac-tools"><button class="secondary small" onclick="acAll(true)">সবাই</button><button class="secondary small" onclick="acAll(false)">কেউ না</button></div>
        <div class="ac-stulist">${c.students.map(s => `<label class="ac-row"><input type="checkbox" ${acOff.has(s.id) ? '' : 'checked'} onchange="acTog('${jsq(s.id)}')"><span>${esc(s.name)}</span><small>${s.roll ? 'রোল ' + esc(bn(s.roll)) : ''}</small></label>`).join('') || '<p class="muted">এই শ্রেণিতে কোনো শিক্ষার্থী নেই</p>'}</div>
      </details>
      <p id="acSum" class="ac-sum"></p>
      <p class="ac-hint" style="margin:0 2px 10px;">প্রিন্টের সময় কাগজ A4 আড়াআড়ি (Landscape), স্কেল ১০০% রাখবেন।</p>
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
    loadCfg();
    setScreen('<div class="ac-wrap" id="acWrap"><div class="ac-ui card" id="acUi">লোড হচ্ছে...</div><div class="ac-sheet" id="acSheet"></div></div>');
    let tries = 0;
    const go = () => {
      if (!el('acUi')) return;
      if ((typeof studentsCache === 'undefined' || !studentsCache.length) && tries++ < 20) { setTimeout(go, 400); return; }
      paint();
    };
    go();
  }

  // ================= ক্রিয়া =================
  const later = () => { clearTimeout(typeTimer); typeTimer = setTimeout(() => { if (el('acSheet')) paintSheet(ctx()); }, 250); };
  window.acCfg = (k, v) => { cfg[k] = (typeof v === 'boolean') ? v : String(v == null ? '' : v); saveCfg(); later(); };
  window.acRepaint = () => { if (el('acSheet')) paintSheet(ctx()); };
  window.acPickClass = v => { acClass = v; acOff = new Set(); paint(); };
  window.acSetOpen = o => { acOpen = !!o; };
  window.acSetOpen2 = o => { acOpen2 = !!o; };
  window.acAll = on => { acOff = on ? new Set() : new Set(ctx().students.map(s => s.id)); paint(); };
  window.acTog = id => {
    if (acOff.has(id)) acOff.delete(id); else acOff.add(id);
    const c = ctx();
    paintSheet(c);
    const sms = document.querySelectorAll('#acUi summary');
    if (sms[1]) sms[1].textContent = 'শিক্ষার্থী বাছাই (' + bn(c.picked.length) + '/' + bn(c.students.length) + ')';
  };
  window.acPrint = function () {
    const sh = el('acSheet');
    if (!sh || !sh.querySelector('.ac-card') || !cfg.exam.trim()) return;
    document.body.classList.add('ac-pm');
    const pg = document.createElement('style');
    pg.textContent = '@page{size:A4 landscape;margin:5mm}';
    document.head.appendChild(pg);
    const done = () => { document.body.classList.remove('ac-pm'); if (pg.parentNode) pg.parentNode.removeChild(pg); };
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 150);
  };
  window.addEventListener('resize', fit);

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
