/* ShikkhaOS — পরীক্ষার রুটিন (শিক্ষক টেবিল ও/অথবা ছবি দেন, শিক্ষার্থীরা নিজের শ্রেণির রুটিন দেখেন)
 *
 * index.html-এ homework.js এর ঠিক নিচে লোড হবে:
 *   <script src="dashboard.js"></script>
 *   <script src="homework.js"></script>
 *   <script src="exam-routine.js"></script>
 *
 * app.js / dashboard.js / homework.js এর কিছুই বদলাতে হয় না।
 *
 * কালেকশন 'examRoutines' (অপরিবর্তিত):
 *   { madrasaId, className, examName, rows:[{date,subject,time}], note,
 *     imageDataUrl, imageType, createdAt }
 * কোয়েরিতে orderBy নেই (সাজানো হয় ব্রাউজারে), তাই নতুন Firestore index লাগবে না।
 *
 * এই সংস্করণে: সম্পূর্ণ নতুন ডিজাইন — হেডার, "কত দিন বাকি" কাউন্টডাউন, টাইমলাইন কার্ড,
 * বিষয়ের আইকন, পরবর্তী পরীক্ষার হাইলাইট, প্রিন্ট/PDF ও শেয়ার বোতাম (স্টাইল নিজে থেকেই যুক্ত হয়)।
 */
(function () {
  'use strict';

  if (typeof teacherTab !== 'function' || typeof db === 'undefined') {
    console.error('[exam-routine] app.js/dashboard.js/homework.js এর পরে exam-routine.js লোড করুন।');
    return;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jsq = s => esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, ' '));
  const safeDataUrl = u => (/^data:/i.test(String(u || '')) ? String(u) : '');
  const bn = n => String(n).replace(/\d/g, c => '০১২৩৪৫৬৭৮৯'[c]);

  const ER_MAX_IMG_DIM = 1400;            // হাতের লেখা পড়া যাওয়ার জন্য একটু বড়
  const ER_MAX_IMG_BYTES = 380 * 1024;    // Firestore ১MB সীমার অনেক নিচে

  let examClassFilter = 'all';
  let examUnsub = null;
  let erEditId = null;                    // সম্পাদনার সময় কোন রুটিন বদলানো হচ্ছে
  let erLast = null;                      // সর্বশেষ আঁকা রুটিনের তালিকা (সেটিংস দেরিতে এলে আবার আঁকার জন্য)
  const erCache = {};                     // শেয়ার বোতামের জন্য সর্বশেষ রুটিনগুলো

  // ================= ডিজাইন (একবারই যুক্ত হয়) =================
  (function injectStyle() {
    if (document.getElementById('erStyle2')) return;
    const st = document.createElement('style');
    st.id = 'erStyle2';
    st.textContent = `
      .er-card{--er-teal:#0f766e;--er-dark:#0b5e57;--er-tint:#e8f4f1;--er-line:#dbe7e4;--er-ink:#16302c;--er-gold:#e3b04b;
        background:#fff;border:1px solid var(--er-line);border-radius:20px;overflow:hidden;margin-bottom:18px;
        box-shadow:0 2px 12px rgba(15,118,110,.10);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .er-hero{position:relative;color:#fff;text-align:center;padding:18px 16px 60px;
        background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='.13' stroke-width='1'%3E%3Crect x='10' y='10' width='28' height='28'/%3E%3Crect x='10' y='10' width='28' height='28' transform='rotate(45 24 24)'/%3E%3C/g%3E%3C/svg%3E"),#0b5e57;}
      .er-hero.er-flat{padding-bottom:18px;}
      .er-brand{display:flex;flex-direction:column;align-items:center;gap:8px;}
      .er-logo{width:54px;height:54px;border-radius:50%;background:#fff;object-fit:contain;padding:3px;box-sizing:border-box;}
      .er-mname{font-size:17px;font-weight:700;line-height:1.4;}
      .er-htitle{font-size:25px;font-weight:700;line-height:1.4;margin-top:10px;}
      .er-pill{display:inline-block;max-width:100%;margin-top:10px;background:rgba(255,255,255,.16);border-radius:999px;padding:5px 16px;font-size:13.5px;font-weight:600;line-height:1.5;color:#fff;}
      .er-posted{font-size:12px;color:#bfe0d8;margin-top:8px;}
      .er-hero-top{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;color:#bfe0d8;}
      .er-class{display:inline-block;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 12px;font-size:12.5px;font-weight:700;color:#fff;}
      .er-title{font-size:22px;font-weight:700;line-height:1.4;margin-top:10px;}
      .er-stats{position:relative;display:flex;margin:-40px 14px 0;background:#fff;border-radius:16px;padding:12px 4px;box-shadow:0 8px 22px rgba(11,94,87,.16);}
      .er-stat{flex:1;min-width:0;text-align:center;padding:0 4px;display:flex;flex-direction:column;gap:2px;justify-content:center;}
      .er-stat + .er-stat{border-left:1px solid var(--er-line);}
      .er-stat b{font-size:18px;color:var(--er-teal);line-height:1.4;}
      .er-stat span{font-size:12px;color:#4b635e;}
      .er-stat.er-wide{flex:1.5;}
      .er-stat.er-wide b{font-size:14.5px;}
      .er-body{padding:16px 10px 14px;}
      .er-tl{position:relative;display:flex;flex-direction:column;gap:10px;}
      .er-item{display:flex;gap:8px;align-items:stretch;}
      .er-dotcol{width:16px;display:flex;align-items:center;justify-content:center;flex:none;position:relative;}
      .er-dotcol:before{content:"";position:absolute;left:50%;margin-left:-1px;top:0;bottom:-10px;width:2px;background:#cfe0db;}
      .er-item:first-child .er-dotcol:before{top:50%;}
      .er-item:last-child .er-dotcol:before{bottom:50%;}
      .er-dot{position:relative;z-index:1;width:12px;height:12px;border-radius:50%;box-sizing:border-box;background:#fff;border:3px solid var(--er-teal);}
      .er-item.er-next .er-dot{background:var(--er-gold);border-color:var(--er-dark);box-shadow:0 0 0 4px #f7e9c6;}
      .er-item.er-past .er-dot{background:var(--er-teal);}
      .er-row{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--er-line);border-radius:16px;padding:10px 10px 10px 8px;
        box-shadow:0 1px 2px rgba(11,94,87,.06),0 4px 12px rgba(11,94,87,.06);}
      .er-item.er-next .er-row{border:2px solid var(--er-teal);}
      .er-item.er-past .er-row{opacity:.62;}
      .er-dateblk{width:50px;min-height:58px;border-radius:13px;background:var(--er-tint);color:var(--er-teal);display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;padding:6px 0;}
      .er-dateblk b{font-size:22px;line-height:1;}
      .er-dateblk small{font-size:11px;margin-top:4px;color:#4b635e;}
      .er-item.er-next .er-dateblk{background:var(--er-dark);color:#fff;}
      .er-item.er-next .er-dateblk small{color:var(--er-gold);}
      .er-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
      .er-sub{font-weight:700;font-size:15.5px;color:var(--er-ink);line-height:1.45;}
      .er-subitem + .er-subitem{margin-top:2px;padding-top:2px;border-top:1px dashed var(--er-line);}
      .er-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:#4b635e;}
      .er-tag{font-size:11px;font-weight:700;background:#fbebc4;color:#7a4f00;border-radius:999px;padding:2px 8px;}
      .er-time{display:inline-block;padding:2px 8px;border-radius:8px;background:#fff7e6;color:#8a5a00;border:1px solid #f3dcaa;font-weight:600;font-size:12.5px;line-height:1.4;}
      .er-glyph{width:34px;height:34px;border-radius:50%;background:var(--er-tint);color:var(--er-teal);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex:none;}
      .er-glyph.er-g2{background:#fbebc4;color:#7a4f00;}
      .er-note{margin-top:14px;padding:12px 14px;background:#fff7e6;border:1px solid #f3dcaa;border-radius:14px;color:#5b3f00;line-height:1.7;font-size:14.5px;}
      .er-note b{color:#7a4f00;}
      .er-img{margin-top:14px;}
      .er-img img{max-width:100%;border-radius:12px;border:1px solid var(--er-line);display:block;}
      .er-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
      .er-actions button{margin:0;width:auto;flex:1 1 40%;min-height:44px;padding:8px 10px;font-size:14px;border-radius:12px;}
      .er-actions .er-btn-line{background:#fff;color:var(--er-teal);border:1px solid var(--er-teal);}
      .erRow{background:#f8fbfa;border:1px solid #dbe7e4 !important;border-radius:12px !important;padding:10px !important;}
      .er-editbar{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff7e6;border:1px solid #f3dcaa;color:#7a4f00;border-radius:12px;padding:8px 12px;margin-bottom:10px;font-size:14px;font-weight:600;}
      .er-editbar button{margin:0;width:auto;flex:none;}
      /* ---- প্রিন্ট/PDF-এর আলাদা ফরমাল লেআউট (পর্দায় লুকানো থাকে) ---- */
      .er-print{display:none;color:#16302c;font-size:13pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .erp-head{text-align:center;}
      .erp-logo{width:62px;height:62px;border-radius:50%;object-fit:contain;display:block;margin:0 auto 4px;}
      .erp-mname{font-size:20pt;font-weight:700;color:#0b5e57;line-height:1.35;}
      .erp-orn{display:flex;align-items:center;gap:10px;margin:6px 36px 8px;}
      .erp-orn:before,.erp-orn:after{content:"";flex:1;height:2px;background:#0f766e;}
      .erp-orn i{width:10px;height:10px;background:#e3b04b;transform:rotate(45deg);flex:none;}
      .erp-title{font-size:26pt;font-weight:700;color:#0f766e;line-height:1.35;}
      .erp-sub{display:inline-block;margin-top:6px;padding:4px 24px;border:1.5px solid #0f766e;border-radius:999px;font-size:13.5pt;font-weight:600;color:#0b5e57;}
      .erp-info{display:flex;margin:14px 0 10px;background:#e8f4f1;border-radius:12px;}
      .erp-info > div{flex:1;text-align:center;padding:9px 6px;}
      .erp-info > div + div{border-left:1px solid #bfdad4;}
      .erp-info b{display:block;font-size:12.5pt;color:#0b5e57;line-height:1.5;}
      .erp-info span{font-size:10.5pt;color:#4b635e;}
      .erp-table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #cfe0db;border-radius:12px;overflow:hidden;font-size:13pt;}
      .erp-table thead{display:table-header-group;}
      .erp-table th{background:#0f766e;color:#fff;font-weight:700;padding:8px 8px;text-align:center;}
      .erp-table td{padding:6px 8px;border-top:1px solid #dbe7e4;text-align:center;vertical-align:middle;}
      .erp-table tbody tr:nth-child(even) td{background:#f4faf8;}
      .erp-table tr{break-inside:avoid;page-break-inside:avoid;}
      .erp-table td.erp-no{width:9%;color:#4b635e;}
      .erp-table td.erp-date{font-weight:700;color:#0b5e57;}
      .erp-table td.erp-subc{text-align:left;font-weight:700;}
      .erp-note{margin-top:12px;padding:8px 14px;background:#fff7e6;border:1px solid #f3dcaa;border-radius:12px;color:#5b3f00;font-size:11.5pt;line-height:1.6;white-space:pre-line;break-inside:avoid;page-break-inside:avoid;}
      .erp-note b{color:#7a4f00;}
      .erp-img{margin-top:14px;text-align:center;break-inside:avoid;page-break-inside:avoid;}
      .erp-img img{max-width:100%;max-height:230mm;border:1px solid #cfe0db;border-radius:8px;}
      .erp-foot{display:flex;justify-content:space-between;gap:40px;margin-top:24px;break-inside:avoid;page-break-inside:avoid;}
      .erp-foot > div{flex:1;text-align:center;border-top:1.5px solid #16302c;padding-top:6px;font-size:12pt;font-weight:600;}
      .erp-posted{margin-top:10px;text-align:right;font-size:10.5pt;color:#4b635e;}
      @media print{
        body.er-print-mode .er-hide{display:none !important;}
        body.er-print-mode{background:#fff !important;background-image:none !important;padding:0 !important;min-height:0 !important;}
        body.er-print-mode .screen{padding:0 !important;max-width:none !important;}
        body.er-print-mode .er-card.er-printing{margin:0;border:none;border-radius:0;box-shadow:none;overflow:visible;}
        body.er-print-mode .er-card.er-printing .er-hero,
        body.er-print-mode .er-card.er-printing .er-stats,
        body.er-print-mode .er-card.er-printing .er-body{display:none !important;}
        body.er-print-mode .er-card.er-printing .er-print{display:block !important;}
      }
    `;
    document.head.appendChild(st);
  })();

  // ================= ন্যাভ: "পরীক্ষার রুটিন" ট্যাব =================
  if (typeof teacherMoreTabs !== 'undefined' && !teacherMoreTabs.some(t => t.key === 'examroutine')) {
    teacherMoreTabs.unshift({ key: 'examroutine', label: 'পরীক্ষার রুটিন', icon: '\u{1F5D3}\uFE0F' });
  }
  if (typeof studentMoreTabs !== 'undefined' && !studentMoreTabs.some(t => t.key === 'examroutine')) {
    studentMoreTabs.unshift({ key: 'examroutine', label: 'পরীক্ষার রুটিন', icon: '\u{1F5D3}\uFE0F' });
  }
  if (typeof unreadCounts !== 'undefined') unreadCounts.examroutine = 0;

  // ================= ছবি ছোট করা =================
  function compressImage(file, onDone, onError) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > ER_MAX_IMG_DIM || h > ER_MAX_IMG_DIM) {
          const scale = ER_MAX_IMG_DIM / Math.max(w, h);
          w = Math.round(w * scale); h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let guard = 0;
        while (dataUrl.length * 0.75 > ER_MAX_IMG_BYTES && quality > 0.25 && guard < 12) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          guard++;
        }
        if (dataUrl.length * 0.75 > ER_MAX_IMG_BYTES) {
          onError(new Error('ছবিটি অনেক বড়, অন্য একটি ছোট/সহজ ছবি দিয়ে চেষ্টা করুন'));
          return;
        }
        onDone(dataUrl);
      };
      img.onerror = () => onError(new Error('ছবিটি পড়া যায়নি'));
      img.src = reader.result;
    };
    reader.onerror = () => onError(new Error('ফাইল পড়তে সমস্যা হয়েছে'));
    reader.readAsDataURL(file);
  }

  // ================= টেবিলের সারি (শিক্ষকের ফর্ম) =================
  function rowHtml(x) {
    x = x || {};
    return `<div class="erRow" style="margin-bottom:8px;">
      <label>তারিখ</label>
      <input type="date" class="erDate" value="${esc(x.date || '')}">
      <label>বিষয়</label>
      <input class="erSubject" placeholder="যেমন: আরবি প্রথম পত্র" value="${esc(x.subject || '')}">
      <label>সময়</label>
      <input class="erTime" placeholder="যেমন: সকাল ১০:০০ - ১:০০" value="${esc(x.time || '')}">
      <button type="button" class="small danger" onclick="erRemoveRow(this)" style="margin-top:6px;">সারি মুছুন</button>
    </div>`;
  }

  window.erAddRow = function () {
    const box = document.getElementById('erRows');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', rowHtml());
  };

  window.erRemoveRow = function (btn) {
    const row = btn && btn.closest ? btn.closest('.erRow') : null;
    if (row && row.parentNode) row.parentNode.removeChild(row);
  };

  // বিষয়: কমা দিয়ে আলাদা লাইনে; "বাংলা ১ম" ভাঙবে না
  function fmtSubject(text) {
    const parts = String(text == null ? '' : text).split(/\s*[,،]\s*/).filter(Boolean);
    if (!parts.length) return '';
    return parts.map(p => {
      const words = p.trim().split(/\s+/);
      let out;
      if (words.length >= 2 && /^[০-৯0-9]/.test(words[words.length - 1])) {
        const last = words.pop();
        const prev = words.pop();
        out = esc(words.concat([prev + '\u00A0' + last]).join(' '));
      } else {
        out = esc(p.trim());
      }
      return '<div class="er-subitem">' + out + '</div>';
    }).join('');
  }

  // ================= নতুন ডিজাইনের সহায়ক ফাংশন =================
  const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

  // তারিখ থেকে: তারিখের সংখ্যা, মাস, বার
  function dateParts(iso) {
    if (!isIso(iso)) return null;
    try {
      const d = new Date(iso + 'T00:00:00');
      return {
        day: bn(iso.slice(8, 10)),
        month: d.toLocaleDateString('bn-BD', { month: 'long' }),
        wd: d.toLocaleDateString('bn-BD', { weekday: 'long' }),
        year: bn(iso.slice(0, 4)),
        short: bn(iso.slice(8, 10)) + '/' + bn(iso.slice(5, 7)) + '/' + bn(iso.slice(2, 4))
      };
    } catch (e) { return null; }
  }

  // আজকের তারিখের সাথে প্রতিটি সারির দিনের ব্যবধান + "পরবর্তী পরীক্ষা" কোনটি
  function examStatus(rows) {
    const now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const df = rows.map(x => isIso(x.date) ? Math.round((new Date(x.date + 'T00:00:00').getTime() - t0) / 86400000) : NaN);
    let nextI = -1;
    df.forEach((v, i) => { if (!isNaN(v) && v >= 0 && (nextI === -1 || v < df[nextI])) nextI = i; });
    const anyValid = df.some(v => !isNaN(v));
    if (!anyValid) return { df, nextI, stat: null };
    if (nextI === -1) return { df, nextI, stat: { value: 'শেষ', label: 'পরীক্ষা সমাপ্ত' } };
    const d = df[nextI];
    const isFirst = !df.some(v => !isNaN(v) && v < 0);
    if (d === 0) return { df, nextI, stat: { value: 'আজ', label: 'পরীক্ষা আছে' } };
    if (d === 1) return { df, nextI, stat: { value: 'আগামীকাল', label: 'পরবর্তী পরীক্ষা' } };
    return { df, nextI, stat: { value: bn(d) + ' দিন', label: isFirst ? 'পরীক্ষা শুরু হতে বাকি' : 'পরবর্তী পরীক্ষা' } };
  }

  const SVG_ATTR = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  // বিষয়ের নাম দেখে আইকন (না মিললে নামের প্রথম অক্ষর)
  function subjectGlyph(subject) {
    const s = String(subject == null ? '' : subject).split(/[,،]/)[0].trim();
    let g = '', cls = '';
    if (/কুরআন|কোরআন|ক্বিরাত|কিরাত|কেরাত|তাজবীদ|তাজবিদ|হিফয|হিফজ/.test(s)) {
      g = `<svg ${SVG_ATTR}><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13"/></svg>`; cls = ' er-g2';
    } else if (/আরবি|আরবী/.test(s)) { g = 'ع'; cls = ' er-g2'; }
    else if (/ইংরেজি/.test(s)) g = 'Aa';
    else if (/বাংলাদেশ|বিশ্ব|ভূগোল/.test(s)) {
      g = `<svg ${SVG_ATTR}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>`;
    } else if (/বাংলা/.test(s)) g = 'অ';
    else if (/গণিত|অংক|অঙ্ক/.test(s)) g = '∑';
    else g = esc(Array.from(s)[0] || '•');
    return `<div class="er-glyph${cls}" aria-hidden="true">${g}</div>`;
  }

  // মাদ্রাসার নাম ও লোগো: অ্যাপের সেটিংস (appSettings.madrasaName) থেকে; লোগো না পেলে উপরের বার (header) থেকে
  function madrasaBrand() {
    let name = '', logo = '';
    try {
      if (typeof appSettings === 'object' && appSettings) {
        name = appSettings.madrasaName || '';
        logo = appSettings.logo || appSettings.logoUrl || appSettings.logoDataUrl || appSettings.madrasaLogo || '';
      }
    } catch (e) {}
    try {
      const h = document.querySelector('header');
      if (h) {
        if (!logo) { const im = h.querySelector('img'); if (im) logo = im.getAttribute('src') || ''; }
        if (!name) {
          const t = String(h.textContent || '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
          if (t && !/^ShikkhaOS$/i.test(t)) name = t;
        }
      }
    } catch (e) {}
    if (!/^(data:image\/|https?:\/\/|[\w.\-\/]+$)/i.test(String(logo))) logo = '';
    return { name: String(name || '').slice(0, 60), logo: String(logo || '') };
  }

  function heroHtml(r, posted) {
    const b = madrasaBrand();
    const cls = String(r.className || '').trim();
    const clsText = cls && !/শ্রেণি/.test(cls) ? cls + ' শ্রেণি' : cls;
    const pill = [clsText, String(r.examName || '').trim()].filter(Boolean).join(' · ');
    return (b.name ? `<div class="er-brand">${b.logo ? `<img class="er-logo" src="${esc(b.logo)}" alt="">` : ''}<div class="er-mname">${esc(b.name)}</div></div>` : '')
      + '<div class="er-htitle">পরীক্ষার রুটিন</div>'
      + (pill ? `<div class="er-pill">${esc(pill)}</div>` : '')
      + (posted ? `<div class="er-posted">${esc(posted)}</div>` : '');
  }

  // প্রিন্ট/PDF-এর ফরমাল পাতা: কেন্দ্রে হেডার, তথ্যের স্ট্রিপ, জেব্রা-টেবিল, নির্দেশনা, স্বাক্ষরের ঘর
  function printHtml(r, rows, o) {
    const b = madrasaBrand();
    const cls = String(r.className || '').trim();
    const clsText = cls && !/শ্রেণি/.test(cls) ? cls + ' শ্রেণি' : cls;
    const sub = [clsText, String(r.examName || '').trim()].filter(Boolean).join(' · ');
    const full = p => p.day + ' ' + p.month + ' ' + p.year;
    const isos = rows.map(x => x.date).filter(isIso).sort();
    const first = isos.length ? dateParts(isos[0]) : null;
    const last = isos.length ? dateParts(isos[isos.length - 1]) : null;
    const dailyTime = !!(o.commonTime && !o.hasException);
    const cells = [];
    if (first && last) { cells.push(['পরীক্ষা শুরু', full(first)]); cells.push(['পরীক্ষা শেষ', full(last)]); }
    if (rows.length) cells.push(['মোট বিষয়', bn(rows.length) + 'টি']);
    if (dailyTime) cells.push(['প্রতিদিনের সময়', o.commonTime]);
    const info = cells.length ? `<div class="erp-info">${cells.map(c => `<div><b>${esc(c[1])}</b><span>${esc(c[0])}</span></div>`).join('')}</div>` : '';
    const table = rows.length ? `<table class="erp-table">
        <thead><tr><th>ক্রম</th><th>তারিখ</th><th>বার</th><th>বিষয়</th>${dailyTime ? '' : '<th>সময়</th>'}</tr></thead>
        <tbody>${rows.map((x, i) => {
          const p = dateParts(x.date);
          return `<tr><td class="erp-no">${bn(i + 1)}</td><td class="erp-date">${p ? esc(full(p)) : esc(x.date || '')}</td><td>${p ? esc(p.wd) : ''}</td><td class="erp-subc">${fmtSubject(x.subject)}</td>${dailyTime ? '' : `<td>${esc(o.normT(x.time))}</td>`}</tr>`;
        }).join('')}</tbody>
      </table>` : '';
    return `<div class="er-print">
      <div class="erp-head">
        ${b.logo ? `<img class="erp-logo" src="${esc(b.logo)}" alt="">` : ''}
        ${b.name ? `<div class="erp-mname">${esc(b.name)}</div>` : ''}
        <div class="erp-orn"><i></i></div>
        <div class="erp-title">পরীক্ষার রুটিন</div>
        ${sub ? `<div class="erp-sub">${esc(sub)}</div>` : ''}
      </div>
      ${info}
      ${table}
      ${r.note ? `<div class="erp-note"><b>নির্দেশনা:</b> ${esc(String(r.note).replace(/\n\s*\n+/g, '\n'))}</div>` : ''}
      ${o.imgUrl ? `<div class="erp-img"><img src="${esc(o.imgUrl)}" alt=""></div>` : ''}
      <div class="erp-foot"><div>শ্রেণি শিক্ষক</div><div>অধ্যক্ষ / মুহতামিম</div></div>
      ${o.posted ? `<div class="erp-posted">${esc(o.posted)}</div>` : ''}
    </div>`;
  }

  // একটি রুটিনের পুরো কার্ড
  function examCardHtml(id, r, isTeacher) {
    const rows = Array.isArray(r.rows) ? r.rows : [];
    const imgUrl = safeDataUrl(r.imageDataUrl);
    const stt = examStatus(rows);
    const normT = t => String(t || '').replace(/\s*পর্যন্ত/g, ' পর্যন্ত').replace(/\s+/g, ' ').trim();
    const keyT = t => String(t || '').replace(/\s+/g, '').replace(/পর্যন্ত/g, '');
    const counts = {};
    let commonKey = '', commonTime = '';
    rows.forEach(x => { const k = keyT(x.time); if (k) counts[k] = (counts[k] || 0) + 1; });
    Object.keys(counts).forEach(k => { if (!commonKey || counts[k] > counts[commonKey]) commonKey = k; });
    if (commonKey && counts[commonKey] * 2 > rows.length) {
      commonTime = normT((rows.find(x => keyT(x.time) === commonKey) || {}).time);
    } else { commonKey = ''; }
    const hasException = !!commonTime && rows.some(x => keyT(x.time) && keyT(x.time) !== commonKey);

    const stats = rows.length ? `<div class="er-stats">
        ${stt.stat ? `<div class="er-stat"><b>${esc(stt.stat.value)}</b><span>${esc(stt.stat.label)}</span></div>` : ''}
        <div class="er-stat"><b>${bn(rows.length)}টি</b><span>বিষয়</span></div>
        ${commonTime ? `<div class="er-stat er-wide"><b>${esc(commonTime)}</b><span>${hasException ? 'অধিকাংশ দিনের সময়' : 'প্রতিদিনের সময়'}</span></div>` : ''}
      </div>` : '';

    const items = rows.map((x, i) => {
      const p = dateParts(x.date);
      const cls = 'er-item' + (i === stt.nextI ? ' er-next' : '') + (stt.df[i] < 0 ? ' er-past' : '');
      const timeChip = (keyT(x.time) && keyT(x.time) !== commonKey) ? `<span class="er-time">${esc(normT(x.time))}</span>` : '';
      return `<div class="${cls}">
        <div class="er-dotcol"><div class="er-dot"></div></div>
        <div class="er-row">
          <div class="er-dateblk">${p ? `<b>${esc(p.day)}</b><small>${esc(p.month)}</small>` : `<small>${esc(x.date || '')}</small>`}</div>
          <div class="er-info">
            <div class="er-sub">${fmtSubject(x.subject)}</div>
            <div class="er-meta">${p ? `<span>${esc(p.wd)}</span>` : ''}${i === stt.nextI ? '<span class="er-tag">পরবর্তী</span>' : ''}${timeChip}</div>
          </div>
          ${subjectGlyph(x.subject)}
        </div>
      </div>`;
    }).join('');

    const posted = r.createdAt ? 'প্রকাশ: ' + new Date(r.createdAt).toLocaleDateString('bn-BD') : '';

    return `<div class="er-card" id="erc_${esc(id)}">
      <div class="er-hero${rows.length ? '' : ' er-flat'}">
        ${heroHtml(r, posted)}
      </div>
      ${stats}
      <div class="er-body">
        ${rows.length ? `<div class="er-tl">${items}</div>` : ''}
        ${r.note ? `<div class="er-note"><b>নির্দেশনা:</b> ${esc(r.note).replace(/\n/g, '<br>')}</div>` : ''}
        ${imgUrl ? `<div class="er-img"><img src="${esc(imgUrl)}" alt="পরীক্ষার রুটিনের ছবি"></div>` : ''}
        <div class="er-actions">
          <button type="button" class="er-btn-line" onclick="erPrint('${jsq(id)}')">প্রিন্ট / PDF</button>
          <button type="button" onclick="erShare('${jsq(id)}')">শেয়ার</button>
          ${isTeacher ? `<button type="button" class="er-btn-line" onclick="editExamRoutine('${jsq(id)}')">সম্পাদনা</button><button type="button" class="danger" onclick="deleteExamRoutine('${jsq(id)}')">মুছুন</button>` : ''}
        </div>
      </div>
      ${printHtml(r, rows, { commonTime, hasException, normT, imgUrl, posted })}
    </div>`;
  }

  // শুধু এই কার্ডটি প্রিন্ট হয় (ফোনে "Save as PDF" বেছে নিলে PDF হয়)
  // A4-তে (উপরে ১০, নিচে ৭ মিমি মার্জিন) এক পাতায় না আঁটলে সামান্য ছোট করে আঁটানো; ০.৭২ এর নিচে নামে না
  function erFitZoom(pr) {
    try {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-10000px;top:0;width:186mm;visibility:hidden;';
      const clone = pr.cloneNode(true);
      clone.style.display = 'block';
      clone.style.zoom = '';
      probe.appendChild(clone);
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height;
      document.body.removeChild(probe);
      const avail = (297 - 17) * 96 / 25.4 - 6;
      return h > avail ? Math.max(0.72, avail / h) : 1;
    } catch (e) { return 1; }
  }

  window.erPrint = function (id) {
    const el = document.getElementById('erc_' + id);
    if (!el) return;
    const pr = el.querySelector('.er-print');
    const zoom = pr ? erFitZoom(pr) : 1;
    if (pr && zoom < 1) pr.style.zoom = String(zoom);
    // কার্ডের পথের বাইরের সব অংশ প্রিন্টে লুকানো হয় (শুধু প্রিন্টের সময়, পর্দায় কিছু বদলায় না)
    const hidden = [];
    let node = el;
    while (node && node !== document.body && node.parentElement) {
      Array.from(node.parentElement.children).forEach(ch => { if (ch !== node) { ch.classList.add('er-hide'); hidden.push(ch); } });
      node = node.parentElement;
    }
    el.classList.add('er-printing');
    document.body.classList.add('er-print-mode');
    const pg = document.createElement('style');
    pg.textContent = '@page{size:A4;margin:10mm 12mm 7mm}';
    document.head.appendChild(pg);
    const done = () => {
      el.classList.remove('er-printing');
      if (pr) pr.style.zoom = '';
      document.body.classList.remove('er-print-mode');
      hidden.forEach(h => h.classList.remove('er-hide'));
      if (pg.parentNode) pg.parentNode.removeChild(pg);
    };
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 120);
  };

  // টেক্সট আকারে শেয়ার (ফোনের শেয়ার মেনু; না থাকলে হোয়াটসঅ্যাপ)
  window.erShare = function (id) {
    const r = erCache[id];
    if (!r) return;
    const lines = [(r.className ? r.className + ' — ' : '') + (r.examName || 'পরীক্ষার রুটিন'), ''];
    (Array.isArray(r.rows) ? r.rows : []).forEach(x => {
      const p = dateParts(x.date);
      lines.push((p ? p.short + ' ' + p.wd : (x.date || '')) + ': ' + (x.subject || '') + (x.time ? ' (' + x.time + ')' : ''));
    });
    if (r.note) { lines.push('', 'নির্দেশনা: ' + r.note); }
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: r.examName || 'পরীক্ষার রুটিন', text }).catch(() => {});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  };

  // ================= স্ক্রিন (শিক্ষক ও শিক্ষার্থী) =================
  function paintExamCards() {
    const wrap = document.getElementById('erWrap');
    if (!wrap || !erLast) return;
    wrap.innerHTML = erLast.items.map(x => { erCache[x.id] = x.r; return examCardHtml(x.id, x.r, erLast.isTeacher); }).join('');
  }

  function renderExamScreen(isTeacher) {
    erLast = null;
    let html = '';
    if (isTeacher) {
      const classes = getClassList();
      const classOpts = classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      html += `
        <div class="card">
          <h2 id="erFormTitle">নতুন পরীক্ষার রুটিন দিন</h2>
          <div id="erEditBar"></div>
          <label>শ্রেণি</label>
          <select id="erClass">${classOpts || '<option value="">কোনো শ্রেণি পাওয়া যায়নি, আগে শিক্ষার্থী যোগ করুন</option>'}</select>
          <label>পরীক্ষার নাম</label>
          <input id="erExamName" placeholder="যেমন: প্রথম সাময়িক পরীক্ষা ২০২৬">
          <h3 style="margin:12px 0 6px;">তারিখ-বিষয়-সময় (টেবিল)</h3>
          <div id="erRows">${rowHtml()}</div>
          <button type="button" class="secondary small" onclick="erAddRow()">+ আরেকটি বিষয় যোগ করুন</button>
          <label style="margin-top:12px;">রুটিনের ছবি (ঐচ্ছিক, হাতে লেখা রুটিন)</label>
          <input type="file" id="erImage" accept="image/*">
          <div id="erImgInfo"></div>
          <label>বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
          <textarea id="erNote" rows="2" placeholder="যেমন: প্রবেশপত্র সাথে আনতে হবে"></textarea>
          <p id="erError" class="muted" style="color:#dc2626;"></p>
          <button id="erSubmitBtn" onclick="addExamRoutine()">রুটিন প্রকাশ করুন</button>
        </div>
        <div class="card">
          <h2>দেওয়া রুটিনের তালিকা</h2>
          <div id="erFilterWrap"></div>
        </div>
        <div id="erWrap">লোড হচ্ছে...</div>`;
    } else {
      html += `<div id="erWrap">লোড হচ্ছে...</div>`;
    }
    setScreen(html);

    if (isTeacher) {
      const fw = document.getElementById('erFilterWrap');
      if (fw) fw.innerHTML = classFilterDropdownHtml(examClassFilter, 'onExamClassFilterChange');
    }
    if (isTeacher && erEditId && erCache[erEditId]) fillEditForm(erCache[erEditId]);

    if (examUnsub) { examUnsub(); examUnsub = null; }

    let q;
    if (isTeacher) {
      q = db.collection('examRoutines').where('madrasaId', '==', madrasaId);
    } else {
      const me = studentsCache.find(s => s.id === myStudentId);
      const myClass = me ? me.className : null;
      if (!myClass) {
        const wrap = document.getElementById('erWrap');
        if (wrap) wrap.innerHTML = '<p class="muted">শ্রেণি তথ্য পাওয়া যায়নি</p>';
        return;
      }
      q = db.collection('examRoutines').where('madrasaId', '==', madrasaId).where('className', '==', myClass);
    }

    examUnsub = q.onSnapshot(snap => {
      const wrap = document.getElementById('erWrap');
      if (!wrap) return;
      let docs = snap.docs.slice().sort((a, b) => (b.data().createdAt || 0) - (a.data().createdAt || 0));
      if (isTeacher && examClassFilter !== 'all') {
        docs = docs.filter(d => d.data().className === examClassFilter);
      }
      if (docs.length === 0) { wrap.innerHTML = '<p class="muted">কোনো পরীক্ষার রুটিন নেই</p>'; return; }
      erLast = { items: docs.map(d => ({ id: d.id, r: d.data() })), isTeacher };
      paintExamCards();
    }, err => {
      const wrap = document.getElementById('erWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(err.message) + '</p>';
      if (err.code !== 'permission-denied' && typeof showDiagBanner === 'function') showDiagBanner('পরীক্ষার রুটিন লোড এরর: ' + err.message);
    });
  }

  // ================= সম্পাদনা =================
  function fillEditForm(r) {
    const sel = document.getElementById('erClass');
    if (sel) {
      if (!Array.from(sel.options).some(o => o.value === r.className)) {
        sel.insertAdjacentHTML('beforeend', `<option value="${esc(r.className)}">${esc(r.className)}</option>`);
      }
      sel.value = r.className;
    }
    const nm = document.getElementById('erExamName'); if (nm) nm.value = r.examName || '';
    const nt = document.getElementById('erNote'); if (nt) nt.value = r.note || '';
    const box = document.getElementById('erRows');
    const rows = Array.isArray(r.rows) ? r.rows : [];
    if (box) box.innerHTML = rows.length ? rows.map(x => rowHtml(x)).join('') : rowHtml();
    const title = document.getElementById('erFormTitle'); if (title) title.textContent = 'রুটিন সম্পাদনা করুন';
    const bar = document.getElementById('erEditBar');
    if (bar) bar.innerHTML = `<div class="er-editbar"><span>সম্পাদনা চলছে: ${esc(r.examName || '')}</span><button type="button" class="small secondary" onclick="cancelExamEdit()">বাতিল</button></div>`;
    const info = document.getElementById('erImgInfo');
    if (info && safeDataUrl(r.imageDataUrl)) {
      info.innerHTML = `<p class="muted">বর্তমানে একটি ছবি আছে। নতুন ছবি বাছলে সেটি বদলে যাবে।</p>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;"><input type="checkbox" id="erRemoveImg" style="width:auto;"> বর্তমান ছবিটি মুছে ফেলুন</label>`;
    }
    const btn = document.getElementById('erSubmitBtn'); if (btn) btn.textContent = 'পরিবর্তন সংরক্ষণ করুন';
  }

  window.editExamRoutine = function (id) {
    if (!erCache[id]) return;
    erEditId = id;
    renderExamScreen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.cancelExamEdit = function () {
    erEditId = null;
    renderExamScreen(true);
  };

  window.onExamClassFilterChange = function (value) {
    examClassFilter = value;
    renderExamScreen(true);
  };

  window.addExamRoutine = function () {
    const classEl = document.getElementById('erClass');
    const className = classEl ? classEl.value : '';
    const examName = document.getElementById('erExamName').value.trim();
    const note = document.getElementById('erNote').value.trim();
    const fileInput = document.getElementById('erImage');
    const errEl = document.getElementById('erError');
    const btn = document.getElementById('erSubmitBtn');
    if (errEl) errEl.textContent = '';

    if (!className) { if (errEl) errEl.textContent = 'শ্রেণি নির্বাচন করুন'; return; }
    if (!examName) { if (errEl) errEl.textContent = 'পরীক্ষার নাম লিখুন'; return; }

    const rows = [];
    document.querySelectorAll('#erRows .erRow').forEach(el => {
      const date = el.querySelector('.erDate').value;
      const subject = el.querySelector('.erSubject').value.trim();
      const time = el.querySelector('.erTime').value.trim();
      if (date || subject || time) rows.push({ date, subject, time });
    });
    if (rows.some(r => !r.date || !r.subject)) {
      if (errEl) errEl.textContent = 'প্রতিটি সারিতে তারিখ ও বিষয় দিন (অথবা খালি সারি মুছে দিন)';
      return;
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));

    const file = fileInput && fileInput.files && fileInput.files[0];
    const editId = erEditId;
    const old = editId ? erCache[editId] : null;
    const removeChk = document.getElementById('erRemoveImg');
    const keepUrl = (old && !(removeChk && removeChk.checked)) ? (old.imageDataUrl || '') : '';
    const keepType = keepUrl ? (old.imageType || '') : '';
    if (rows.length === 0 && !file && !keepUrl) {
      if (errEl) errEl.textContent = 'টেবিলে অন্তত একটি বিষয় দিন অথবা রুটিনের ছবি দিন';
      return;
    }

    const save = (imageDataUrl, imageType) => {
      if (btn) { btn.disabled = true; btn.textContent = 'সংরক্ষণ করা হচ্ছে...'; }
      db.collection('examRoutines').add({
        madrasaId, className, examName, rows, note: note || '',
        imageDataUrl: imageDataUrl || '', imageType: imageType || '',
        createdAt: Date.now()
      }).then(() => {
        // সম্পাদনা: নতুনটি সংরক্ষিত হওয়ার পর পুরনোটি মোছা হয় (শিক্ষার্থীরাও নতুন রুটিনের ব্যাজ পায়)
        if (!old) { erEditId = null; renderExamScreen(true); return; }
        return db.collection('examRoutines').doc(editId).delete()
          .catch(e => { alert('নতুন রুটিন সংরক্ষিত হয়েছে, কিন্তু পুরনোটি মুছতে পারিনি। তালিকা থেকে পুরনোটি মুছে দিন: ' + e.message); })
          .then(() => { erEditId = null; renderExamScreen(true); });
      }).catch(e => {
        if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message;
        if (typeof showDiagBanner === 'function') showDiagBanner('পরীক্ষার রুটিন সংরক্ষণ ব্যর্থ: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = erEditId ? 'পরিবর্তন সংরক্ষণ করুন' : 'রুটিন প্রকাশ করুন'; }
      });
    };

    if (!file) { save(keepUrl, keepType); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'ছবি প্রস্তুত করা হচ্ছে...'; }
    compressImage(file, (dataUrl) => save(dataUrl, 'image/jpeg'), (e) => {
      if (errEl) errEl.textContent = e.message;
      if (btn) { btn.disabled = false; btn.textContent = erEditId ? 'পরিবর্তন সংরক্ষণ করুন' : 'রুটিন প্রকাশ করুন'; }
    });
  };

  window.deleteExamRoutine = function (id) {
    if (!confirm('এই পরীক্ষার রুটিন মুছতে চান?')) return;
    db.collection('examRoutines').doc(id).delete()
      .catch(e => { alert('মুছতে ব্যর্থ: ' + e.message); if (typeof showDiagBanner === 'function') showDiagBanner('রুটিন মুছতে ব্যর্থ: ' + e.message); });
  };

  // ================= শিক্ষার্থী: আনরিড ব্যাজ =================
  function examSeenKey() { return 'lastSeenExamRoutine_' + (myStudentId || 'x'); }
  let unreadExamUnsub = null;

  function startExamUnreadListener() {
    if (typeof role === 'undefined' || role !== 'student' || !myStudentId) return;
    const me = studentsCache.find(s => s.id === myStudentId);
    const myClass = me ? me.className : null;
    if (!myClass) return;
    if (unreadExamUnsub && unreadExamUnsub.className === myClass) return;
    if (unreadExamUnsub && unreadExamUnsub.unsub) unreadExamUnsub.unsub();
    const unsub = db.collection('examRoutines')
      .where('madrasaId', '==', madrasaId)
      .where('className', '==', myClass)
      .onSnapshot(snap => {
        const lastSeen = Number(localStorage.getItem(examSeenKey()) || 0);
        unreadCounts.examroutine = snap.docs.filter(d => (d.data().createdAt || 0) > lastSeen).length;
        if (role === 'student' && typeof renderStudentNav === 'function' && typeof currentStudentTab !== 'undefined') {
          renderStudentNav(currentStudentTab);
        }
      }, err => { if (typeof showDiagBanner === 'function') showDiagBanner('রুটিন আনরিড লোড এরর: ' + err.message); });
    unreadExamUnsub = { unsub, className: myClass };
  }

  function stopExamUnreadListener() {
    if (unreadExamUnsub && unreadExamUnsub.unsub) { unreadExamUnsub.unsub(); unreadExamUnsub = null; }
    if (typeof unreadCounts !== 'undefined') unreadCounts.examroutine = 0;
  }

  function markExamSeen() {
    localStorage.setItem(examSeenKey(), String(Date.now()));
    if (typeof unreadCounts !== 'undefined') unreadCounts.examroutine = 0;
  }

  const origStart = window.startUnreadListeners;
  if (typeof origStart === 'function') {
    window.startUnreadListeners = function () {
      origStart.apply(this, arguments);
      startExamUnreadListener();
    };
  }
  const origStop = window.stopUnreadListeners;
  if (typeof origStop === 'function') {
    window.stopUnreadListeners = function () {
      origStop.apply(this, arguments);
      stopExamUnreadListener();
    };
  }
  const origListenStudents = window.listenStudents;
  if (typeof origListenStudents === 'function') {
    window.listenStudents = function () {
      const r = origListenStudents.apply(this, arguments);
      if (typeof role !== 'undefined' && role === 'student' && myStudentId) startExamUnreadListener();
      return r;
    };
  }

  // মাদ্রাসার সেটিংস (নাম/লোগো) দেরিতে লোড হলে হেডার আবার আঁকা
  const origDashOnSettings = window.dashOnSettings;
  window.dashOnSettings = function () {
    const r = typeof origDashOnSettings === 'function' ? origDashOnSettings.apply(this, arguments) : undefined;
    try { paintExamCards(); } catch (e) { /* ignore */ }
    return r;
  };

  // ================= ট্যাব-ডিসপ্যাচে জোড়া লাগানো =================
  const origTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    if (examUnsub) { examUnsub(); examUnsub = null; }
    if (tab !== 'examroutine') erEditId = null;
    if (tab === 'examroutine') {
      if (typeof renderTeacherNav === 'function') renderTeacherNav('examroutine');
      renderExamScreen(true);
      return;
    }
    return origTeacherTab.apply(this, arguments);
  };

  const origStudentTab = window.studentTab;
  window.studentTab = function (tab) {
    if (examUnsub) { examUnsub(); examUnsub = null; }
    if (tab === 'examroutine') {
      currentStudentTab = 'examroutine';
      markExamSeen();
      if (typeof renderStudentNav === 'function') renderStudentNav('examroutine');
      renderExamScreen(false);
      return;
    }
    return origStudentTab.apply(this, arguments);
  };
})();
