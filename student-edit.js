/* ShikkhaOS — শিক্ষার্থীর নাম, রোল ও শ্রেণি সংশোধন (শুধু অ্যাডমিন)
 *
 * index.html-এ dashboard.js-এর ঠিক নিচে (এবং বাকি প্যাচ ফাইলগুলোর আগে বা পরে, সমস্যা নেই) লোড করুন:
 *   <script src="student-edit.js"></script>
 *
 * app.js ও dashboard.js একটুও বদলাতে হয় না।
 * শ্রেণি বদলালে ফলাফলের মেধাক্রম নিজে থেকেই নতুন করে হিসাব হয়
 * (কারণ মেধাক্রম শিক্ষার্থীর বর্তমান শ্রেণি ধরে হিসাব হয়)।
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || typeof studentsCache === 'undefined' || typeof renderStudentsList !== 'function') {
    console.error('[student-edit] app.js ও dashboard.js এর নিচে এই ফাইলটি লোড করুন।');
    return;
  }

  const isAdmin = () => !!((typeof myTeacherIsAdmin !== 'undefined' && myTeacherIsAdmin) || (typeof isSuperAdminUser !== 'undefined' && isSuperAdminUser));

  function closeModal() {
    const m = document.getElementById('stuEditModal');
    if (m) m.remove();
  }

  // শ্রেণি বদলালে সব পরীক্ষার মেধাক্রম নতুন করে হিসাব (আগের ও নতুন দুই শ্রেণিই ঠিক হয়ে যায়)
  function recomputeAllRanks() {
    return db.collection('results').where('madrasaId', '==', madrasaId).get().then(snap => {
      const combos = {};
      snap.docs.forEach(d => {
        const r = d.data();
        if (!r.examName) return;
        combos[r.examName + '||' + (r.academicYear || '')] = { e: r.examName, y: r.academicYear || '' };
      });
      let chain = Promise.resolve();
      Object.keys(combos).forEach(k => { chain = chain.then(() => recomputeMeritRanks(combos[k].e, combos[k].y)); });
      return chain;
    });
  }

  window.editStudentInfo = function (id) {
    if (!isAdmin()) { alert('শিক্ষার্থীর তথ্য সংশোধন শুধু অ্যাডমিন শিক্ষক করতে পারেন'); return; }
    const s = studentsCache.find(x => x.id === id);
    if (!s) { alert('শিক্ষার্থী খুঁজে পাওয়া যায়নি'); return; }
    closeModal();

    const ov = document.createElement('div');
    ov.id = 'stuEditModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;';
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px 16px 24px;max-height:90vh;overflow-y:auto;';
    box.innerHTML = `
      <h2 style="margin-top:0;">শিক্ষার্থীর তথ্য সংশোধন</h2>
      <label>নাম</label><input id="seName">
      <label>রোল</label><input id="seRoll" inputmode="numeric">
      <label>শ্রেণি</label><input id="seClass" list="seClassList" autocomplete="off">
      <datalist id="seClassList"></datalist>
      <p class="muted" style="font-size:12px;">শ্রেণির নাম আগের মতোই লিখুন (তালিকা থেকে বেছে নিলে বানান মিলবে)।</p>
      <p id="seError" class="muted" style="color:#dc2626;"></p>
      <button id="seSave">সংরক্ষণ করুন</button>
      <button class="secondary" id="seCancel" style="margin-top:8px;">বাতিল</button>`;
    ov.appendChild(box);
    document.body.appendChild(ov);

    // মান বসানো হয় .value দিয়ে, তাই নামে বিশেষ চিহ্ন থাকলেও নিরাপদ
    document.getElementById('seName').value = s.name || '';
    document.getElementById('seRoll').value = s.roll || '';
    document.getElementById('seClass').value = s.className || '';
    const dl = document.getElementById('seClassList');
    getClassList().forEach(c => { const o = document.createElement('option'); o.value = c; dl.appendChild(o); });

    document.getElementById('seCancel').onclick = closeModal;
    document.getElementById('seSave').onclick = function () {
      const btn = this;
      const errEl = document.getElementById('seError');
      errEl.textContent = '';
      const name = document.getElementById('seName').value.trim();
      const roll = toEnglishDigits(document.getElementById('seRoll').value.trim());
      const cls = document.getElementById('seClass').value.trim();
      if (!name) { errEl.textContent = 'নাম দিন'; return; }

      const oldClass = s.className || '';
      const classChanged = cls !== oldClass;
      if (name === (s.name || '') && roll === String(s.roll || '') && !classChanged) { closeModal(); return; }

      const dup = roll && studentsCache.find(x => x.id !== id && (x.className || '') === cls && String(x.roll || '') === roll);
      if (dup && !confirm('এই শ্রেণিতে রোল ' + roll + ' আগে থেকেই আছে (' + dup.name + ')। তবুও সংরক্ষণ করবেন?')) return;

      if (classChanged && !confirm(
        'শ্রেণি "' + (oldClass || 'নেই') + '" থেকে "' + (cls || 'নেই') + '" করা হচ্ছে।\n\n' +
        '• পুরনো ফলাফল নতুন শ্রেণির মেধাতালিকায় যাবে, মেধাক্রম নতুন করে হিসাব হবে\n' +
        '• হাজিরা, বেতন ও ছুটির তথ্য যেমন আছে তেমনই থাকবে\n' +
        '• ডায়েরি এখন থেকে নতুন শ্রেণির দেখাবে\n\nএগিয়ে যাবেন?')) return;

      btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...';
      db.collection('students').doc(id).update({ name, roll, className: cls })
        .then(() => {
          s.name = name; s.roll = roll; s.className = cls; // মেধাক্রমের হিসাবের আগে স্থানীয় তালিকাও হালনাগাদ
          closeModal();
          if (document.getElementById('studentsScreen')) renderStudentsList();
          if (classChanged) return recomputeAllRanks().then(() => alert('সংরক্ষণ হয়েছে। মেধাক্রম নতুন করে হিসাব করা হয়েছে।'));
          alert('সংরক্ষণ হয়েছে');
        })
        .catch(e => {
          btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন';
          errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message;
          if (typeof showDiagBanner === 'function') showDiagBanner('শিক্ষার্থী সংশোধন ব্যর্থ: ' + (e.code || '') + ' ' + e.message);
        });
    };
  };

  // তালিকার প্রতিটি সারিতে (শুধু অ্যাডমিনের জন্য) "সম্পাদনা" বাটন যোগ
  const prev = window.renderStudentsList;
  window.renderStudentsList = function () {
    const r = prev.apply(this, arguments);
    if (isAdmin()) {
      const wrap = document.getElementById('studentsListWrap');
      if (wrap) {
        wrap.querySelectorAll('button').forEach(b => {
          const oc = b.getAttribute('onclick') || '';
          if (/^setStudentPin\(/.test(oc) && !b.parentNode.querySelector('[data-edit-info]')) {
            const nb = document.createElement('button');
            nb.className = 'small';
            nb.setAttribute('data-edit-info', '1');
            nb.textContent = '✏️ সম্পাদনা';
            nb.setAttribute('onclick', oc.replace(/^setStudentPin/, 'editStudentInfo'));
            b.parentNode.insertBefore(nb, b);
          }
        });
      }
    }
    return r;
  };
})();
