/* ShikkhaOS — পরীক্ষার রুটিন (শিক্ষক টেবিল ও/অথবা ছবি দেন, শিক্ষার্থীরা নিজের শ্রেণির রুটিন দেখেন)
 *
 * index.html-এ homework.js এর ঠিক নিচে লোড হবে:
 *   <script src="dashboard.js"></script>
 *   <script src="homework.js"></script>
 *   <script src="exam-routine.js"></script>
 *
 * app.js / dashboard.js / homework.js এর কিছুই বদলাতে হয় না।
 *
 * নতুন কালেকশন 'examRoutines':
 *   { madrasaId, className, examName, rows:[{date,subject,time}], note,
 *     imageDataUrl, imageType, createdAt }
 * কোয়েরিতে orderBy নেই (সাজানো হয় ব্রাউজারে), তাই নতুন Firestore index লাগবে না।
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

  const ER_MAX_IMG_DIM = 1400;            // হাতের লেখা পড়া যাওয়ার জন্য একটু বড়
  const ER_MAX_IMG_BYTES = 380 * 1024;    // Firestore ১MB সীমার অনেক নিচে

  let examClassFilter = 'all';
  let examUnsub = null;

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
  function rowHtml() {
    return `<div class="erRow" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px;">
      <label>তারিখ</label>
      <input type="date" class="erDate">
      <label>বিষয়</label>
      <input class="erSubject" placeholder="যেমন: আরবি প্রথম পত্র">
      <label>সময়</label>
      <input class="erTime" placeholder="যেমন: সকাল ১০:০০ - ১:০০">
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

  function fmtDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return esc(iso || '');
    try {
      return esc(new Date(iso + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    } catch (e) { return esc(iso); }
  }

  // ================= স্ক্রিন (শিক্ষক ও শিক্ষার্থী) =================
  function renderExamScreen(isTeacher) {
    let html = '';
    if (isTeacher) {
      const classes = getClassList();
      const classOpts = classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      html += `
        <div class="card">
          <h2>নতুন পরীক্ষার রুটিন দিন</h2>
          <label>শ্রেণি</label>
          <select id="erClass">${classOpts || '<option value="">কোনো শ্রেণি পাওয়া যায়নি, আগে শিক্ষার্থী যোগ করুন</option>'}</select>
          <label>পরীক্ষার নাম</label>
          <input id="erExamName" placeholder="যেমন: প্রথম সাময়িক পরীক্ষা ২০২৬">
          <h3 style="margin:12px 0 6px;">তারিখ-বিষয়-সময় (টেবিল)</h3>
          <div id="erRows">${rowHtml()}</div>
          <button type="button" class="secondary small" onclick="erAddRow()">+ আরেকটি বিষয় যোগ করুন</button>
          <label style="margin-top:12px;">রুটিনের ছবি (ঐচ্ছিক, হাতে লেখা রুটিন)</label>
          <input type="file" id="erImage" accept="image/*">
          <label>বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
          <textarea id="erNote" rows="2" placeholder="যেমন: প্রবেশপত্র সাথে আনতে হবে"></textarea>
          <p id="erError" class="muted" style="color:#dc2626;"></p>
          <button id="erSubmitBtn" onclick="addExamRoutine()">রুটিন প্রকাশ করুন</button>
        </div>
        <div class="card">
          <h2>দেওয়া রুটিনের তালিকা</h2>
          <div id="erFilterWrap"></div>
          <div id="erWrap">লোড হচ্ছে...</div>
        </div>`;
    } else {
      html += `<div class="card"><h2>পরীক্ষার রুটিন</h2><div id="erWrap">লোড হচ্ছে...</div></div>`;
    }
    setScreen(html);

    if (isTeacher) {
      const fw = document.getElementById('erFilterWrap');
      if (fw) fw.innerHTML = classFilterDropdownHtml(examClassFilter, 'onExamClassFilterChange');
    }

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
      wrap.innerHTML = docs.map(d => {
        const r = d.data();
        const rows = Array.isArray(r.rows) ? r.rows : [];
        const imgUrl = safeDataUrl(r.imageDataUrl);
        const table = rows.length ? `
          <div style="overflow-x:auto;margin-top:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="background:#f3f4f6;">
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">তারিখ ও বার</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">বিষয়</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">সময়</th>
              </tr></thead>
              <tbody>${rows.map(x => `<tr>
                <td style="border:1px solid #e5e7eb;padding:6px;">${fmtDate(x.date)}</td>
                <td style="border:1px solid #e5e7eb;padding:6px;">${esc(x.subject)}</td>
                <td style="border:1px solid #e5e7eb;padding:6px;">${esc(x.time)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>` : '';
        return `<div class="student-row" style="display:block;">
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <b>${esc(r.className || '-')}${r.examName ? ' - ' + esc(r.examName) : ''}</b>
            <span class="muted">${r.createdAt ? esc(new Date(r.createdAt).toLocaleDateString('bn-BD')) : ''}</span>
          </div>
          ${table}
          ${r.note ? `<div style="margin-top:6px;"><b>নির্দেশনা:</b> ${esc(r.note).replace(/\n/g, '<br>')}</div>` : ''}
          ${imgUrl ? `<div style="margin-top:6px;"><img src="${esc(imgUrl)}" style="max-width:100%;border-radius:8px;" alt="পরীক্ষার রুটিনের ছবি"></div>` : ''}
          ${isTeacher ? `<button class="small danger" onclick="deleteExamRoutine('${jsq(d.id)}')" style="margin-top:6px;">মুছুন</button>` : ''}
        </div>`;
      }).join('');
    }, err => {
      const wrap = document.getElementById('erWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(err.message) + '</p>';
      if (err.code !== 'permission-denied' && typeof showDiagBanner === 'function') showDiagBanner('পরীক্ষার রুটিন লোড এরর: ' + err.message);
    });
  }

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
    if (rows.length === 0 && !file) {
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
        renderExamScreen(true);
      }).catch(e => {
        if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message;
        if (typeof showDiagBanner === 'function') showDiagBanner('পরীক্ষার রুটিন সংরক্ষণ ব্যর্থ: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'রুটিন প্রকাশ করুন'; }
      });
    };

    if (!file) { save(); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'ছবি প্রস্তুত করা হচ্ছে...'; }
    compressImage(file, (dataUrl) => save(dataUrl, 'image/jpeg'), (e) => {
      if (errEl) errEl.textContent = e.message;
      if (btn) { btn.disabled = false; btn.textContent = 'রুটিন প্রকাশ করুন'; }
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

  // ================= ট্যাব-ডিসপ্যাচে জোড়া লাগানো =================
  const origTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    if (examUnsub) { examUnsub(); examUnsub = null; }
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
