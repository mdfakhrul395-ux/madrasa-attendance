// ================= মূল্যায়ন + সেমিস্টার পরীক্ষার নম্বর (marks-split.js) =================
// প্রতিটি বিষয়ের প্রাপ্ত নম্বর এখন দুই ভাগে ঢোকানো যায়:
//   মূল্যায়ন (ডিফল্ট পূর্ণ নম্বর ২০) + সেমিস্টার পরীক্ষা (বাকি নম্বর) = প্রাপ্ত নম্বর
// - প্রাপ্ত নম্বর, গ্রেড, GPA, মেধাক্রম, চূড়ান্ত ফলাফল — সবকিছু আগের মতোই "obtained" থেকে হিসাব হয়।
// - subject-এর ভেতরে শুধু বাড়তি তিনটি ফিল্ড জমা হয়: evalFull, eval, sem
// - পুরনো রেজাল্টে এই ফিল্ড নেই, সেখানে নতুন দুই কলামে "–" দেখাবে; কিছু ভাঙবে না।
// লোড ক্রম: index.html-এ এই ফাইলটি সবার শেষে (final-result.js-এর পরে) বসবে।
(function () {
  if (window.__marksSplitInstalled) return;
  window.__marksSplitInstalled = true;

  var EVAL_KEY = 'evalFullMarks';
  var C = {
    evalBg: '#fff7ed', evalFg: '#9a3412', evalBorder: '#fed7aa',
    semBg: '#ecfeff', semFg: '#155e75', semBorder: '#a5f3fc',
    totBg: '#eef2ff', totFg: '#3730a3', totBorder: '#c7d2fe',
    err: '#b91c1c', hint: '#6b7280'
  };

  function evalFullDefault() {
    var v = Number(localStorage.getItem(EVAL_KEY));
    return v > 0 ? v : 20;
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  function hasSplit(s) { return !!s && isNum(s.eval) && isNum(s.sem); }
  function el(id) { return document.getElementById(id); }

  // Firestore-এ undefined ফিল্ড লেখা যায় না, তাই শুধু থাকা ফিল্ডগুলো রাখা হয়
  function cleanSubject(s) {
    var o = { name: s.name, full: s.full, obtained: s.obtained };
    if (isNum(s.evalFull)) o.evalFull = s.evalFull;
    if (isNum(s.eval)) o.eval = s.eval;
    if (isNum(s.sem)) o.sem = s.sem;
    return o;
  }

  function chip(label, value, bg, fg, border) {
    return '<span style="display:inline-block;background:' + bg + ';color:' + fg + ';border:1px solid ' + border +
      ';border-radius:999px;padding:2px 10px;font-size:12px;">' + label + ' <b>' + esc(value) + '</b></span>';
  }

  // ---------- নম্বর এন্ট্রি ফর্ম ----------
  function transformForm() {
    var obt = el('resSubjectObtained');
    if (!obt || el('splitMarksBox')) return;
    var lab = obt.previousElementSibling;
    var box = document.createElement('div');
    box.id = 'splitMarksBox';
    box.style.cssText = 'background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0 4px;';
    box.innerHTML =
      '<label style="font-size:13px;margin-top:0;">মূল্যায়নের পূর্ণ নম্বর</label>' +
      '<input id="resEvalFull" type="number" inputmode="decimal" value="' + evalFullDefault() + '">' +
      '<p id="resSemFullHint" style="margin:4px 0 10px;font-size:12px;color:' + C.hint + ';"></p>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
        '<div style="background:' + C.evalBg + ';border:1px solid ' + C.evalBorder + ';border-radius:10px;padding:8px 10px;">' +
          '<label style="font-size:12px;margin-top:0;color:' + C.evalFg + ';">মূল্যায়নের নম্বর</label>' +
          '<input id="resSubjectEval" type="number" inputmode="decimal" placeholder="যেমন: 18">' +
        '</div>' +
        '<div style="background:' + C.semBg + ';border:1px solid ' + C.semBorder + ';border-radius:10px;padding:8px 10px;">' +
          '<label style="font-size:12px;margin-top:0;color:' + C.semFg + ';">সেমিস্টার পরীক্ষার নম্বর</label>' +
          '<input id="resSubjectSem" type="number" inputmode="decimal" placeholder="যেমন: 62">' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-size:13px;color:' + C.hint + ';">প্রাপ্ত নম্বর (স্বয়ংক্রিয় যোগফল)</span>' +
        '<span id="resSubjectTotalChip" style="background:' + C.totBg + ';color:' + C.totFg + ';border:1px solid ' + C.totBorder +
          ';border-radius:999px;padding:3px 14px;font-weight:bold;font-size:15px;">0 / 100</span>' +
      '</div>' +
      '<p id="resSplitWarn" style="margin:6px 0 0;font-size:12px;color:' + C.err + ';min-height:16px;"></p>';

    var anchor = (lab && lab.tagName === 'LABEL') ? lab : obt;
    anchor.parentNode.insertBefore(box, anchor);
    if (lab && lab.tagName === 'LABEL') lab.remove();
    obt.remove();

    ['resSubjectFull', 'resEvalFull', 'resSubjectEval', 'resSubjectSem'].forEach(function (id) {
      var e = el(id);
      if (e) e.addEventListener('input', updatePreview);
    });
    var nameEl = el('resSubjectName');
    if (nameEl) nameEl.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); el('resSubjectEval').focus(); } };
    el('resSubjectEval').onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); el('resSubjectSem').focus(); } };
    el('resSubjectSem').onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); window.addSubjectRow(); } };
  }

  function updatePreview() {
    var chipEl = el('resSubjectTotalChip');
    if (!chipEl) return;
    var full = Number(el('resSubjectFull').value) || 0;
    var ef = Number(el('resEvalFull').value) || 0;
    var e = Number(el('resSubjectEval').value) || 0;
    var s = Number(el('resSubjectSem').value) || 0;
    var semFull = r2(full - ef);
    var hint = el('resSemFullHint');
    if (hint) hint.textContent = (ef > 0 && ef < full)
      ? 'সেমিস্টার পরীক্ষার পূর্ণ নম্বর: ' + semFull + ' (পূর্ণ ' + full + ' − মূল্যায়ন ' + ef + ')'
      : '';
    chipEl.textContent = r2(e + s) + ' / ' + full;
    var warn = el('resSplitWarn');
    if (!warn) return;
    var msg = '';
    if (full > 0 && (ef <= 0 || ef >= full)) msg = 'মূল্যায়নের পূর্ণ নম্বর ০ থেকে বেশি এবং পূর্ণ নম্বরের চেয়ে কম হতে হবে';
    else if (e > ef) msg = 'মূল্যায়নের নম্বর ' + ef + '-এর বেশি হতে পারে না';
    else if (s > semFull) msg = 'সেমিস্টারের নম্বর ' + semFull + '-এর বেশি হতে পারে না';
    warn.textContent = msg;
  }

  // ---------- বিষয় যোগ / তালিকা / সম্পাদনা ----------
  window.attachResultsFastEntryHandlers = function () { /* হ্যান্ডলার transformForm() বসায় */ };

  window.addSubjectRow = function () {
    var nameEl = el('resSubjectName');
    var fullEl = el('resSubjectFull');
    var evalFullEl = el('resEvalFull');
    var evalEl = el('resSubjectEval');
    var semEl = el('resSubjectSem');
    if (!nameEl || !fullEl || !evalFullEl || !evalEl || !semEl) return;

    var name = nameEl.value.trim();
    var full = Number(fullEl.value);
    var evalFull = Number(evalFullEl.value);
    if (!name) return alert('বিষয়ের নাম লিখুন');
    if (!full || full <= 0) return alert('পূর্ণ নম্বর সঠিকভাবে দিন');
    if (!evalFull || evalFull <= 0 || evalFull >= full) return alert('মূল্যায়নের পূর্ণ নম্বর ০ থেকে বেশি এবং পূর্ণ নম্বরের চেয়ে কম হতে হবে');
    if (evalEl.value === '' || isNaN(Number(evalEl.value))) return alert('মূল্যায়নের নম্বর দিন');
    if (semEl.value === '' || isNaN(Number(semEl.value))) return alert('সেমিস্টার পরীক্ষার নম্বর দিন');
    var e = Number(evalEl.value), s = Number(semEl.value);
    if (e < 0 || s < 0) return alert('নম্বর ঋণাত্মক হতে পারে না');
    if (e > evalFull) return alert('মূল্যায়নের নম্বর ' + evalFull + '-এর বেশি হতে পারে না');
    if (s > full - evalFull) return alert('সেমিস্টার পরীক্ষার নম্বর ' + r2(full - evalFull) + '-এর বেশি হতে পারে না');

    currentMarksheetSubjects.push({ name: name, full: full, obtained: r2(e + s), evalFull: evalFull, eval: e, sem: s });
    lastUsedSubjectFullMarks = full;
    try { localStorage.setItem(EVAL_KEY, String(evalFull)); } catch (err) { /* ignore */ }

    nameEl.value = '';
    evalEl.value = '';
    semEl.value = '';
    fullEl.value = String(full);
    window.renderSubjectRows();
    updatePreview();
    nameEl.focus();
  };

  window.renderSubjectRows = function () {
    var wrap = el('subjectRowsWrap');
    if (!wrap) return;
    if (currentMarksheetSubjects.length === 0) {
      wrap.innerHTML = '<p class="muted">এখনো কোনো বিষয় যোগ করা হয়নি</p>';
      return;
    }
    wrap.innerHTML = currentMarksheetSubjects.map(function (s, i) {
      var chips = '';
      if (hasSplit(s)) {
        chips += chip('মূল্যায়ন', s.eval + '/' + (s.evalFull || '?'), C.evalBg, C.evalFg, C.evalBorder) + ' ';
        chips += chip('সেমিস্টার', s.sem + '/' + (isNum(s.evalFull) ? r2(s.full - s.evalFull) : '?'), C.semBg, C.semFg, C.semBorder) + ' ';
      }
      chips += chip('প্রাপ্ত', s.obtained + '/' + s.full, C.totBg, C.totFg, C.totBorder);
      return '<div class="student-row" style="display:block;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
          '<b>' + esc(s.name) + '</b>' +
          '<span><button class="small secondary" onclick="editSubjectRowValue(' + i + ')">✎ সম্পাদনা</button> ' +
          '<button class="small danger" onclick="removeSubjectRow(' + i + ')">✕</button></span>' +
        '</div>' +
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">' + chips + '</div>' +
      '</div>';
    }).join('');
  };

  window.editSubjectRowValue = function (index) {
    var s = currentMarksheetSubjects[index];
    if (!s) return;
    var ask = function (msg, def) {
      var v = prompt(msg, def === undefined ? '' : def);
      if (v === null) return null;
      v = toEnglishDigits(v).trim();
      return v === '' || isNaN(Number(v)) ? NaN : Number(v);
    };
    var full = ask('পূর্ণ নম্বর (' + s.name + '):', s.full);
    if (full === null) return;
    if (isNaN(full) || full <= 0) return alert('পূর্ণ নম্বর সঠিকভাবে দিন');
    var evalFull = ask('মূল্যায়নের পূর্ণ নম্বর:', isNum(s.evalFull) ? s.evalFull : evalFullDefault());
    if (evalFull === null) return;
    if (isNaN(evalFull) || evalFull <= 0 || evalFull >= full) return alert('মূল্যায়নের পূর্ণ নম্বর ০ থেকে বেশি এবং পূর্ণ নম্বরের চেয়ে কম হতে হবে');
    var e = ask('মূল্যায়নের নম্বর (সর্বোচ্চ ' + evalFull + '):', isNum(s.eval) ? s.eval : '');
    if (e === null) return;
    if (isNaN(e) || e < 0 || e > evalFull) return alert('মূল্যায়নের নম্বর ০ থেকে ' + evalFull + '-এর মধ্যে দিন');
    var semFull = r2(full - evalFull);
    var m = ask('সেমিস্টার পরীক্ষার নম্বর (সর্বোচ্চ ' + semFull + '):', isNum(s.sem) ? s.sem : '');
    if (m === null) return;
    if (isNaN(m) || m < 0 || m > semFull) return alert('সেমিস্টারের নম্বর ০ থেকে ' + semFull + '-এর মধ্যে দিন');
    currentMarksheetSubjects[index] = { name: s.name, full: full, obtained: r2(e + m), evalFull: evalFull, eval: e, sem: m };
    window.renderSubjectRows();
  };

  // ---------- রেজাল্ট স্ক্রিনের মোড়ক ----------
  var origRenderResults = window.renderResultsScreen;
  window.renderResultsScreen = function (isTeacher) {
    var out = origRenderResults.apply(this, arguments);
    if (isTeacher) {
      try { transformForm(); updatePreview(); window.renderSubjectRows(); }
      catch (err) { console.error('marks-split form error:', err); }
    }
    return out;
  };

  // সম্পাদনার সময় পুরনো কোড শুধু name/full/obtained রাখে — ফিল্ডগুলো আবার ফিরিয়ে আনা হয়
  var origEdit = window.editMarksheet;
  if (typeof origEdit === 'function') {
    window.editMarksheet = function (studentId, docId) {
      var out = origEdit.apply(this, arguments);
      db.collection('results').doc(docId).get().then(function (doc) {
        if (!doc.exists) return;
        var subs = doc.data().subjects;
        if (!Array.isArray(subs) || !subs.some(hasSplit)) return;
        var tries = 0;
        (function wait() {
          var same = currentMarksheetSubjects.length === subs.length &&
            currentMarksheetSubjects.every(function (x, i) { return x.name === subs[i].name; });
          if (same) {
            currentMarksheetSubjects = currentMarksheetSubjects.map(function (x, i) {
              var o = cleanSubject(x);
              if (isNum(subs[i].evalFull)) o.evalFull = subs[i].evalFull;
              if (isNum(subs[i].eval)) o.eval = subs[i].eval;
              if (isNum(subs[i].sem)) o.sem = subs[i].sem;
              return o;
            });
            window.renderSubjectRows();
          } else if (++tries < 30) {
            setTimeout(wait, 100);
          }
        })();
      }).catch(function () { /* ignore */ });
      return out;
    };
  }

  // ---------- মার্কশিট দেখা: টেবিলে নতুন দুই কলাম ----------
  function findSubjectTable(area) {
    var tables = area.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var ths = tables[i].querySelectorAll('thead th');
      if (ths.length >= 5 && ths[0].textContent.trim() === 'বিষয়') return tables[i];
    }
    return null;
  }

  function cellHtml(value, full, fg, bold) {
    return '<span style="color:' + fg + ';font-weight:' + (bold ? 'bold' : '500') + ';">' + esc(value) + '</span>' +
      (full !== null ? '<div style="font-size:10px;color:#9ca3af;font-weight:normal;line-height:1.2;">/' + esc(full) + '</div>' : '');
  }

  function augment(data) {
    var area = el('marksheetPrintArea');
    if (!area || !data) return false;
    var subs = Array.isArray(data.subjects) ? data.subjects : [];
    if (!subs.some(hasSplit)) return true; // পুরনো রেজাল্ট — কিছু করার নেই
    var table = findSubjectTable(area);
    if (!table) return false;
    if (table.getAttribute('data-split')) return true;

    var ths = table.querySelectorAll('thead th');
    var idx = -1;
    for (var i = 0; i < ths.length; i++) { if (ths[i].textContent.indexOf('প্রাপ্ত') > -1) { idx = i; break; } }
    if (idx < 0) return false;

    var thBase = ths[idx].getAttribute('style') || '';
    function mkTh(text, bg, fg) {
      var th = document.createElement('th');
      th.setAttribute('style', thBase + ';background:' + bg + ';color:' + fg + ';');
      th.textContent = text;
      return th;
    }
    ths[idx].parentNode.insertBefore(mkTh('মূল্যায়ন', C.evalBg, C.evalFg), ths[idx]);
    ths[idx].parentNode.insertBefore(mkTh('সেমিস্টার পরীক্ষা', C.semBg, C.semFg), ths[idx]);

    var eSum = 0, eFull = 0, sSum = 0, sFull = 0;
    subs.forEach(function (s) {
      if (!hasSplit(s)) return;
      eSum += s.eval; sSum += s.sem;
      if (isNum(s.evalFull)) { eFull += s.evalFull; sFull += r2(s.full - s.evalFull); }
    });
    eSum = r2(eSum); sSum = r2(sSum);

    var rows = table.querySelectorAll('tbody tr');
    var subjIdx = 0;
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].children;
      if (cells.length !== ths.length) continue;
      var ref = cells[idx];
      var base = ref.getAttribute('style') || '';
      var isTotal = cells[0].textContent.trim() === 'মোট';
      var s2 = isTotal ? null : subs[subjIdx++];
      var e, m;
      if (isTotal) {
        e = cellHtml(eSum, eFull || null, C.evalFg, true);
        m = cellHtml(sSum, sFull || null, C.semFg, true);
      } else if (s2 && hasSplit(s2)) {
        e = cellHtml(s2.eval, isNum(s2.evalFull) ? s2.evalFull : null, C.evalFg, false);
        m = cellHtml(s2.sem, isNum(s2.evalFull) ? r2(s2.full - s2.evalFull) : null, C.semFg, false);
      } else {
        e = m = '<span style="color:#9ca3af;">–</span>';
      }
      var tdE = document.createElement('td');
      tdE.setAttribute('style', base + ';background:' + C.evalBg + '66;');
      tdE.innerHTML = e;
      var tdS = document.createElement('td');
      tdS.setAttribute('style', base + ';background:' + C.semBg + '99;');
      tdS.innerHTML = m;
      rows[r].insertBefore(tdE, ref);
      rows[r].insertBefore(tdS, ref);
    }
    table.setAttribute('data-split', '1');

    // নিচের রঙিন বক্সের সারিতে দুটি নতুন বক্স
    var boxes = area.querySelector('div[style*="margin-top:14px"][style*="flex-wrap"]');
    if (boxes && !boxes.getAttribute('data-split-boxes')) {
      var mkBox = function (label, val, full, bg, fg) {
        return '<div style="flex:1;min-width:90px;background:' + bg + ';border-radius:10px;padding:10px;text-align:center;">' +
          '<div class="muted" style="font-size:11px;">' + label + '</div>' +
          '<div style="font-size:18px;font-weight:bold;color:' + fg + ';">' + esc(val) +
          (full ? '<span style="font-size:11px;color:#9ca3af;font-weight:normal;">/' + esc(full) + '</span>' : '') + '</div></div>';
      };
      boxes.insertAdjacentHTML('afterbegin',
        mkBox('মূল্যায়ন', eSum, eFull, C.evalBg, C.evalFg) + mkBox('সেমিস্টার পরীক্ষা', sSum, sFull, C.semBg, C.semFg));
      boxes.setAttribute('data-split-boxes', '1');
    }
    return true;
  }

  var currentObs = null;
  function watch(data) {
    if (currentObs) { currentObs.disconnect(); currentObs = null; }
    var app = el('app');
    if (!app) return;
    if (augment(data) && el('marksheetPrintArea')) {
      // টেবিল বসে গেছে; অন্য প্যাচ পুনরায় আঁকলে ধরার জন্য অল্প সময় নজর রাখা হয়
    }
    var obs = new MutationObserver(function () { augment(data); });
    obs.observe(app, { childList: true, subtree: true });
    currentObs = obs;
    setTimeout(function () { obs.disconnect(); if (currentObs === obs) currentObs = null; }, 10000);
  }

  // ---------- প্রিন্ট: মার্কশিটের উপরের অংশ (টেবিল + নম্বরের বক্স) যেন ১ম পেজে ধরে ----------
  (function addPrintStyle() {
    if (document.getElementById('marksSplitPrintStyle')) return;
    var st = document.createElement('style');
    st.id = 'marksSplitPrintStyle';
    st.textContent =
      '@media print {' +
      '  @page { margin: 6mm; }' +
      '  html, body, #app { margin: 0 !important; padding: 0 !important; }' +
      '  #marksheetPrintArea { margin: 0 !important; padding: 6px 8px !important; box-shadow: none !important; }' +
      '  #marksheetPrintArea hr { margin: 5px 0 !important; }' +
      '  #marksheetPrintArea table th, #marksheetPrintArea table td { padding: 3px 5px !important; line-height: 1.2 !important; }' +
      '  #marksheetPrintArea table { margin-top: 6px !important; }' +
      '  #marksheetPrintArea div[style*="flex-wrap"][style*="margin-top:14px"] { margin-top: 6px !important; gap: 6px !important; break-inside: avoid; page-break-inside: avoid; }' +
      '  #marksheetPrintArea div[style*="flex-wrap"][style*="margin-top:14px"] > div { padding: 5px 6px !important; }' +
      '  #marksheetPrintArea p.muted { margin: 6px 0 0 !important; }' +
      '}';
    document.head.appendChild(st);
  })();

  var origView = window.viewMarksheet;
  if (typeof origView === 'function') {
    window.viewMarksheet = function (studentId, docId) {
      var out = origView.apply(this, arguments);
      db.collection('results').doc(docId).get().then(function (doc) {
        if (doc.exists) watch(doc.data());
      }).catch(function () { /* ignore */ });
      return out;
    };
  }
})();
