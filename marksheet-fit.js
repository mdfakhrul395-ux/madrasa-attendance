// ================= মার্কশিট ফিট + গ্রেড ব্যাজ (marksheet-fit.js) =================
// কাজ:
//  ১) গ্রেড "A+" / "A-" এখন এক লাইনে সুন্দর পিল-ব্যাজ হয়ে দেখায়
//  ২) সবগুলো কলাম স্ক্রিনের প্রস্থে ঢোকে — ডানে/বামে স্ক্রল লাগে না
//  ৩) হিসাব, গ্রেড, GPA, প্রিন্ট — কোনো ডেটা বা লজিক বদলায় না (শুধু দেখানোর ধরন)
// লোড ক্রম: index.html-এ সবার শেষে (marks-split.js এর পরে):
//   <script src="marksheet-fit.js"></script>
(function () {
  'use strict';
  if (window.__marksheetFitInstalled) return;
  window.__marksheetFitInstalled = true;

  var GRADE_RE = /^[A-F][+\-\u2212\u2013]?$/;
  var FALLBACK = {
    'A+': ['#bbf7d0', '#14532d'], 'A': ['#dcfce7', '#166534'], 'A-': ['#dbeafe', '#1e40af'],
    'B': ['#dbeafe', '#1e40af'], 'C': ['#fef9c3', '#854d0e'], 'D': ['#ffedd5', '#9a3412'], 'F': ['#fee2e2', '#991b1b']
  };
  // কলামের শিরোনাম অনুযায়ী প্রস্থ (%) — গ্রেডকে বেশি জায়গা দেওয়া হয়েছে
  var WIDTHS = [
    ['বিষয়', 21], ['পূর্ণ', 11], ['মূল্যায়ন', 14], ['সেমিস্টার', 16],
    ['প্রাপ্ত', 12], ['গ্রেড', 13], ['GPA', 13]
  ];

  function colorsFor(g) {
    try {
      if (typeof gradeColor === 'function') {
        var c = gradeColor(g);
        if (c && c.bg && c.fg) return { bg: c.bg, fg: c.fg };
      }
    } catch (e) { /* fallback */ }
    var f = FALLBACK[g] || FALLBACK[g.charAt(0)] || ['#e5e7eb', '#374151'];
    return { bg: f[0], fg: f[1] };
  }

  // ---------- স্টাইল ----------
  (function addStyles() {
    if (document.getElementById('marksheetFitStyle')) return;
    var st = document.createElement('style');
    st.id = 'marksheetFitStyle';
    st.textContent =
      '#marksheetPrintArea { max-width: 100%; }' +
      '#marksheetPrintArea div[style*="overflow"] { overflow-x: visible !important; }' +
      '#marksheetPrintArea table { width: 100%; max-width: 100%; border-collapse: collapse; }' +
      '#marksheetPrintArea table[data-split] { table-layout: fixed; }' +
      '#marksheetPrintArea table thead th { vertical-align: middle; line-height: 1.25; }' +
      '#marksheetPrintArea table tbody td { vertical-align: middle; font-variant-numeric: tabular-nums; }' +
      '#marksheetPrintArea table tbody tr:nth-child(even) td:first-child { background: #f9fafb; }' +
      '#marksheetPrintArea table th:not(:first-child), #marksheetPrintArea table td:not(:first-child) { word-break: normal !important; overflow-wrap: normal !important; }' +
      '#marksheetPrintArea table tbody td:not(:first-child) { white-space: nowrap; }' +
      '#marksheetPrintArea table thead th:not(:first-child) { overflow-wrap: anywhere !important; overflow: hidden; font-size: 11.5px !important; padding-left: 2px !important; padding-right: 2px !important; }' +
      '#marksheetPrintArea td.ms-grade-cell { white-space: nowrap; text-align: center; padding-left: 2px !important; padding-right: 2px !important; }' +
      '#marksheetPrintArea td.ms-gpa-cell { font-weight: 700; color: #3730a3; }' +
      '.ms-grade { display: inline-block; white-space: nowrap; min-width: 36px; padding: 3px 8px; border-radius: 999px;' +
      '  font-weight: 800; font-size: 13px; line-height: 1.3; letter-spacing: .2px; text-align: center;' +
      '  border: 1px solid rgba(0,0,0,.07); box-shadow: 0 1px 2px rgba(0,0,0,.06);' +
      '  -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '@media (max-width: 380px) {' +
      '  #marksheetPrintArea table[data-split] th, #marksheetPrintArea table[data-split] td { font-size: 12px !important; }' +
      '  .ms-grade { min-width: 32px; padding: 2px 6px; font-size: 12px; }' +
      '}' +
      '@media print { .ms-grade { box-shadow: none; } }';
    document.head.appendChild(st);
  })();

  // ---------- টেবিল ঠিক করা (idempotent) ----------
  function findTable(area) {
    var tables = area.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var ths = tables[i].querySelectorAll('thead th');
      if (ths.length >= 5 && ths[0].textContent.trim() === 'বিষয়') return tables[i];
    }
    return null;
  }

  function headerIndex(ths, key) {
    key = key.toLowerCase();
    for (var i = 0; i < ths.length; i++) {
      if (ths[i].textContent.replace(/\s+/g, '').toLowerCase().indexOf(key) === 0) return i;
    }
    return -1;
  }

  function fixColumns(table, ths) {
    if (ths.length !== 7) return; // মূল্যায়ন/সেমিস্টার কলামসহ ৭টি হলে প্রস্থ ঠিক করা হয়
    var widths = [];
    for (var i = 0; i < ths.length; i++) {
      var t = ths[i].textContent.replace(/\s+/g, '').toLowerCase(), w = null;
      for (var k = 0; k < WIDTHS.length; k++) {
        if (t.indexOf(WIDTHS[k][0].toLowerCase()) === 0) { w = WIDTHS[k][1]; break; }
      }
      if (w === null) return; // অচেনা কলাম — কিছু বদলাবো না
      widths.push(w);
    }
    var cg = table.querySelector('colgroup');
    if (!cg) {
      cg = document.createElement('colgroup');
      for (var j = 0; j < 7; j++) cg.appendChild(document.createElement('col'));
      table.insertBefore(cg, table.firstChild);
    }
    var cols = cg.children;
    if (cols.length !== 7) return;
    for (var c = 0; c < 7; c++) {
      var v = widths[c] + '%';
      if (cols[c].style.width !== v) cols[c].style.width = v;
    }
    if (!table.hasAttribute('data-split')) table.setAttribute('data-split', 'fit');
  }

  function polishGrades(table, ths) {
    var gi = headerIndex(ths, 'গ্রেড');
    var pi = headerIndex(ths, 'gpa');
    if (pi < 0) pi = headerIndex(ths, 'জিপিএ');
    var rows = table.querySelectorAll('tbody tr');
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].children;
      if (cells.length !== ths.length) continue;
      if (pi >= 0 && !cells[pi].classList.contains('ms-gpa-cell') && cells[pi].textContent.trim() !== '') {
        cells[pi].classList.add('ms-gpa-cell');
      }
      if (gi < 0) continue;
      var td = cells[gi];
      if (td.getAttribute('data-ms') === '1') continue;
      var g = td.textContent.replace(/\s+/g, '');
      if (!GRADE_RE.test(g)) continue;
      var shown = g.replace(/[\u2212\u2013]/g, '-');
      var c = colorsFor(shown);
      td.innerHTML = '<span class="ms-grade" style="background:' + c.bg + ';color:' + c.fg + ';">' + shown + '</span>';
      td.classList.add('ms-grade-cell');
      td.setAttribute('data-ms', '1');
    }
  }

  function run() {
    var area = document.getElementById('marksheetPrintArea');
    if (!area) return;
    var table = findTable(area);
    if (!table) return;
    var ths = table.querySelectorAll('thead th');
    try { fixColumns(table, ths); polishGrades(table, ths); }
    catch (e) { console.error('[marksheet-fit]', e); }
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || setTimeout)(function () { queued = false; run(); });
  }

  (function watch() {
    var app = document.getElementById('app');
    if (!app) { setTimeout(watch, 200); return; }
    new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
    schedule();
  })();
})();
