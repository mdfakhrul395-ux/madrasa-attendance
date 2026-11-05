/* ShikkhaOS — শিক্ষার্থীর পিতার নাম ও মাতার নাম (ধাপ ১: যোগ করা + তালিকায় দেখানো)
 *
 * index.html-এ সবার শেষে (ui-polish.js / final-result.js এর পরে) লোড করুন:
 *   <script src="parent-names.js"></script>
 *
 * app.js বা অন্য কোনো ফাইল বদলাতে হয় না।
 * পিতা-মাতার নাম মোবাইল নম্বরের মতোই সুরক্ষিত student_contacts কালেকশনে জমা হয়
 * (students কালেকশনে নয়, কারণ সেটি লগইনের আগে পড়া যায়)।
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || typeof renderStudentsScreen !== 'function' ||
      typeof addStudent !== 'function' || typeof renderStudentsList !== 'function') {
    console.error('[parent-names] app.js ও বাকি প্যাচ ফাইলের নিচে এই ফাইলটি লোড করুন।');
    return;
  }

  // ---- ১) ফর্মে দুটি নতুন ঘর (মোবাইল নম্বরের ঠিক আগে) ----
  const prevScreen = window.renderStudentsScreen;
  window.renderStudentsScreen = function () {
    const r = prevScreen.apply(this, arguments);
    const phone = document.getElementById('newPhone');
    if (phone && !document.getElementById('newFather')) {
      const prevEl = phone.previousElementSibling;
      const anchor = (prevEl && prevEl.tagName === 'LABEL') ? prevEl : phone;
      const tmp = document.createElement('div');
      tmp.innerHTML =
        '<label>পিতার নাম</label><input id="newFather" placeholder="পিতার নাম">' +
        '<label>মাতার নাম</label><input id="newMother" placeholder="মাতার নাম">';
      while (tmp.firstChild) anchor.parentNode.insertBefore(tmp.firstChild, anchor);
    }
    return r;
  };

  // ---- ২) যোগ করার সময় পিতা-মাতার নাম সংরক্ষণ ----
  const prevAdd = window.addStudent;
  window.addStudent = function () {
    const fEl = document.getElementById('newFather');
    const mEl = document.getElementById('newMother');
    const father = fEl ? fEl.value.trim() : '';
    const mother = mEl ? mEl.value.trim() : '';
    if (!father && !mother) return prevAdd.apply(this, arguments);

    // মূল addStudent() শিক্ষার্থী যোগ করার মুহূর্তে (synchronously) db.collection('students').add চালায়।
    // শুধু সেই একটি কলের ফলাফলে নতুন ডকের আইডি ধরে পিতা-মাতার নাম লিখে দিই।
    const origCol = db.collection;
    let hooked = false;
    db.collection = function (name) {
      const c = origCol.apply(db, arguments);
      if (name === 'students' && !hooked) {
        hooked = true;
        const origAdd = c.add;
        c.add = function (data) {
          return origAdd.call(c, data).then(ref => {
            return db.collection('student_contacts').doc(ref.id)
              .set({ madrasaId: data.madrasaId, fatherName: father, motherName: mother }, { merge: true })
              .then(() => { if (fEl) fEl.value = ''; if (mEl) mEl.value = ''; })
              .catch(e => {
                alert('শিক্ষার্থী যোগ হয়েছে, কিন্তু পিতা-মাতার নাম সংরক্ষণ ব্যর্থ: ' + e.message);
                if (typeof showDiagBanner === 'function') showDiagBanner('পিতা-মাতার নাম সংরক্ষণ ব্যর্থ: ' + (e.code || '') + ' ' + e.message);
              })
              .then(() => ref);
          });
        };
      }
      return c;
    };
    try {
      return prevAdd.apply(this, arguments);
    } finally {
      db.collection = origCol; // আগের অবস্থায় ফিরিয়ে দিই (usage-tracker এর wrapper সহ)
    }
  };

  // ---- ৩) শিক্ষার্থী তালিকায় পিতা-মাতার নাম দেখানো ----
  const prevList = window.renderStudentsList;
  window.renderStudentsList = function () {
    const r = prevList.apply(this, arguments);
    const wrap = document.getElementById('studentsListWrap');
    if (!wrap) return r;
    wrap.querySelectorAll('button').forEach(b => {
      const m = /^setStudentPin\('([^']*)'\)/.exec(b.getAttribute('onclick') || '');
      if (!m) return;
      const row = b.closest('.student-row');
      if (!row || row.querySelector('[data-parents]')) return;
      const c = (typeof studentContactsCache !== 'undefined' && studentContactsCache[m[1]]) || {};
      if (!c.fatherName && !c.motherName) return;
      const line = document.createElement('div');
      line.className = 'muted';
      line.setAttribute('data-parents', '1');
      line.style.marginTop = '2px';
      const parts = [];
      if (c.fatherName) parts.push('পিতা: ' + c.fatherName);
      if (c.motherName) parts.push('মাতা: ' + c.motherName);
      line.textContent = '👪 ' + parts.join(' | ');
      b.parentNode.parentNode.insertBefore(line, b.parentNode);
    });
    return r;
  };

  // ---- ৪) মার্কশিট ও মাসিক রিপোর্টে পিতা-মাতার নাম (ধাপ ২) ----
  function parentLineText(studentId) {
    const c = (typeof studentContactsCache !== 'undefined' && studentContactsCache[studentId]) || {};
    const parts = [];
    if (c.fatherName) parts.push('পিতা: ' + c.fatherName);
    if (c.motherName) parts.push('মাতা: ' + c.motherName);
    return parts.join('   |   ');
  }

  // কোন শিক্ষার্থীর মার্কশিট খোলা হয়েছে সেটা মনে রাখা
  let lastMarksheetStudentId = null;
  if (typeof window.viewMarksheet === 'function') {
    const prevView = window.viewMarksheet;
    window.viewMarksheet = function (studentId) {
      lastMarksheetStudentId = studentId;
      return prevView.apply(this, arguments);
    };
  }

  function injectParents() {
    // মার্কশিট
    const ms = document.getElementById('marksheetPrintArea');
    if (ms && !ms.querySelector('[data-parents-line]') && lastMarksheetStudentId) {
      const text = parentLineText(lastMarksheetStudentId);
      if (text) {
        const line = document.createElement('div');
        line.setAttribute('data-parents-line', '1');
        line.style.cssText = 'font-size:14px;margin-top:6px;';
        line.textContent = text;
        let anchor = null;
        ms.querySelectorAll('b').forEach(b => {
          if (!anchor && b.textContent.trim() === 'নাম:') anchor = b.parentNode.parentNode;
        });
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(line, anchor.nextSibling);
        else {
          const tbl = ms.querySelector('table');
          if (tbl && tbl.parentNode) tbl.parentNode.insertBefore(line, tbl);
        }
      }
    }

    // মাসিক উপস্থিতি রিপোর্ট (একজন শিক্ষার্থীর)
    const rp = document.getElementById('reportPrintArea');
    if (rp && !rp.querySelector('[data-parents-line]') && typeof reportMode !== 'undefined' &&
        reportMode === 'monthly' && typeof reportStudentId !== 'undefined' && reportStudentId) {
      const h = rp.querySelector('h2');
      if (h && h.textContent.indexOf('মাসিক উপস্থিতি রিপোর্ট') > -1) {
        const text = parentLineText(reportStudentId);
        const nameP = h.nextElementSibling;
        if (text && nameP) {
          const line = document.createElement('p');
          line.className = 'muted';
          line.setAttribute('data-parents-line', '1');
          line.style.cssText = 'text-align:center;margin-top:0;';
          line.textContent = text;
          nameP.parentNode.insertBefore(line, nameP.nextSibling);
        }
      }
    }
  }

  const appEl = document.getElementById('app');
  if (appEl && typeof MutationObserver !== 'undefined') {
    new MutationObserver(injectParents).observe(appEl, { childList: true, subtree: true });
  }

  // ---- ৫) "✏️ সম্পাদনা" ফর্মে পিতা-মাতার নাম বদলানো (ধাপ ৩, student-edit.js এর ওপর) ----
  if (typeof window.editStudentInfo === 'function') {
    const prevEdit = window.editStudentInfo;
    window.editStudentInfo = function (id) {
      prevEdit.apply(this, arguments);
      const modal = document.getElementById('stuEditModal');
      if (!modal || document.getElementById('seFather')) return; // মডাল খোলেনি (অ্যাডমিন নন) বা আগেই যোগ হয়েছে
      const errEl = document.getElementById('seError');
      const saveBtn = document.getElementById('seSave');
      if (!errEl || !saveBtn) return;

      const c = (typeof studentContactsCache !== 'undefined' && studentContactsCache[id]) || {};
      const tmp = document.createElement('div');
      tmp.innerHTML =
        '<label>পিতার নাম</label><input id="seFather" placeholder="পিতার নাম">' +
        '<label>মাতার নাম</label><input id="seMother" placeholder="মাতার নাম">';
      while (tmp.firstChild) errEl.parentNode.insertBefore(tmp.firstChild, errEl);
      document.getElementById('seFather').value = c.fatherName || '';
      document.getElementById('seMother').value = c.motherName || '';

      const origSave = saveBtn.onclick;
      saveBtn.onclick = function () {
        const f = document.getElementById('seFather').value.trim();
        const m = document.getElementById('seMother').value.trim();
        const name = document.getElementById('seName').value.trim();
        const old = (typeof studentContactsCache !== 'undefined' && studentContactsCache[id]) || {};
        if (name && (f !== (old.fatherName || '') || m !== (old.motherName || ''))) {
          db.collection('student_contacts').doc(id)
            .set({ madrasaId: madrasaId, fatherName: f, motherName: m }, { merge: true })
            .catch(e => {
              alert('পিতা-মাতার নাম সংরক্ষণ ব্যর্থ: ' + e.message);
              if (typeof showDiagBanner === 'function') showDiagBanner('পিতা-মাতার নাম সংরক্ষণ ব্যর্থ: ' + (e.code || '') + ' ' + e.message);
            });
        }
        return origSave.apply(this, arguments);
      };
    };
  } else {
    console.warn('[parent-names] student-edit.js আগে লোড করুন, নইলে সম্পাদনা ফর্মে পিতা-মাতার ঘর আসবে না।');
  }
})();
