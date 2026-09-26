/* ShikkhaOS — হোমওয়ার্ক (শিক্ষক টেক্সট/ছবি হোমওয়ার্ক দেন, শিক্ষার্থীরা দেখেন)
 *
 * index.html-এ dashboard.js এর ঠিক নিচে (এবং tenant-link.js থাকলে তার পরে/আগে,
 * ক্রম গুরুত্বপূর্ণ নয়) এভাবে লোড হবে:
 *   <script src="dashboard.js"></script>
 *   <script src="homework.js"></script>
 *
 * app.js বা dashboard.js এর একটি অক্ষরও বদলাতে হয় না — dashboard.js নিজেই যেভাবে
 * app.js-কে "wrap" করে, এই ফাইলও ঠিক সেভাবে dashboard.js-কে wrap করে।
 *
 * ছবি ফ্রি প্ল্যানে (সরাসরি Firestore-এ, আলাদা Storage/Blaze প্ল্যান ছাড়াই) রাখার
 * জন্য আপলোডের সময় ব্রাউজারে canvas দিয়ে ছোট করে (compress) সংরক্ষণ করা হয়,
 * যাতে ডকুমেন্ট সাইজ নিরাপদ সীমার (Firestore-এর ১MB ডকুমেন্ট লিমিটের অনেক নিচে) মধ্যে থাকে।
 *
 * ডেটা মডেল (নতুন কালেকশন 'homework'):
 *   { madrasaId, className, subject, text, imageDataUrl, imageType, date, createdAt }
 *
 * XSS সুরক্ষা: app.js/dashboard.js এর মতোই esc()/jsq()/safeDataUrl() ব্যবহার করা হয়েছে।
 */
(function () {
  'use strict';

  if (typeof teacherTab !== 'function' || typeof db === 'undefined') {
    console.error('[homework] app.js/dashboard.js এর পরে homework.js লোড করুন। index.html-এ script এর ক্রম দেখুন।');
    return;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jsq = s => esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, ' '));
  const safeDataUrl = u => (/^data:/i.test(String(u || '')) ? String(u) : '');

  const HW_MAX_IMG_DIM = 1000;             // ছবির দীর্ঘতম পাশ সর্বোচ্চ এতো পিক্সেল
  const HW_MAX_IMG_BYTES = 280 * 1024;     // কমপ্রেসের পর সর্বোচ্চ আনুমানিক আকার (~280KB)

  let homeworkClassFilter = 'all';
  let homeworkUnsub = null;

  // ================= ন্যাভ: "হোমওয়ার্ক" ট্যাব যোগ =================
  if (typeof teacherMoreTabs !== 'undefined' && !teacherMoreTabs.some(t => t.key === 'homework')) {
    teacherMoreTabs.unshift({ key: 'homework', label: 'হোমওয়ার্ক', icon: '\u{1F4DA}' });
  }
  if (typeof studentMoreTabs !== 'undefined' && !studentMoreTabs.some(t => t.key === 'homework')) {
    studentMoreTabs.unshift({ key: 'homework', label: 'হোমওয়ার্ক', icon: '\u{1F4DA}' });
  }
  if (typeof unreadCounts !== 'undefined') unreadCounts.homework = 0;

  // ================= ছবি ছোট করা (client-side compress) =================
  function compressImage(file, onDone, onError) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > HW_MAX_IMG_DIM || h > HW_MAX_IMG_DIM) {
          const scale = HW_MAX_IMG_DIM / Math.max(w, h);
          w = Math.round(w * scale); h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let guard = 0;
        while (dataUrl.length * 0.75 > HW_MAX_IMG_BYTES && quality > 0.25 && guard < 12) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          guard++;
        }
        if (dataUrl.length * 0.75 > HW_MAX_IMG_BYTES) {
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

  // ================= স্ক্রিন (শিক্ষক ও শিক্ষার্থী উভয়ে) =================
  function renderHomeworkScreen(isTeacher) {
    let html = '';
    if (isTeacher) {
      const classes = getClassList();
      const classOpts = classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      html += `
        <div class="card">
          <h2>নতুন হোমওয়ার্ক দিন</h2>
          <label>শ্রেণি</label>
          <select id="hwClass">${classOpts || '<option value="">কোনো শ্রেণি পাওয়া যায়নি, আগে শিক্ষার্থী যোগ করুন</option>'}</select>
          <label>বিষয় (ঐচ্ছিক)</label>
          <input id="hwSubject" placeholder="যেমন: আরবি">
          <label>হোমওয়ার্ক লিখুন</label>
          <textarea id="hwText" rows="4" placeholder="যা পড়তে/করতে দিচ্ছেন তা লিখুন"></textarea>
          <label>ছবি সংযুক্ত করুন (ঐচ্ছিক)</label>
          <input type="file" id="hwImage" accept="image/*">
          <p id="hwError" class="muted" style="color:#dc2626;"></p>
          <button id="hwSubmitBtn" onclick="addHomework()">হোমওয়ার্ক দিন</button>
        </div>
        <div class="card">
          <h2>দেওয়া হোমওয়ার্কের তালিকা</h2>
          <div id="hwFilterWrap"></div>
          <div id="hwWrap">লোড হচ্ছে...</div>
        </div>`;
    } else {
      html += `<div class="card"><h2>হোমওয়ার্ক</h2><div id="hwWrap">লোড হচ্ছে...</div></div>`;
    }
    setScreen(html);

    if (isTeacher) {
      const filterWrap = document.getElementById('hwFilterWrap');
      if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(homeworkClassFilter, 'onHomeworkClassFilterChange');
    }

    if (homeworkUnsub) { homeworkUnsub(); homeworkUnsub = null; }

    let q;
    if (isTeacher) {
      q = db.collection('homework').where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc');
    } else {
      const me = studentsCache.find(s => s.id === myStudentId);
      const myClass = me ? me.className : null;
      if (!myClass) {
        const wrap = document.getElementById('hwWrap');
        if (wrap) wrap.innerHTML = '<p class="muted">শ্রেণি তথ্য পাওয়া যায়নি</p>';
        return;
      }
      q = db.collection('homework').where('madrasaId', '==', madrasaId).where('className', '==', myClass).orderBy('createdAt', 'desc');
    }

    homeworkUnsub = q.onSnapshot(snap => {
      const wrap = document.getElementById('hwWrap');
      if (!wrap) return;
      let docs = snap.docs;
      if (isTeacher && homeworkClassFilter !== 'all') {
        docs = docs.filter(d => d.data().className === homeworkClassFilter);
      }
      if (docs.length === 0) { wrap.innerHTML = '<p class="muted">কোনো হোমওয়ার্ক নেই</p>'; return; }
      wrap.innerHTML = docs.map(d => {
        const r = d.data();
        const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('bn-BD') : '';
        const imgUrl = safeDataUrl(r.imageDataUrl);
        return `<div class="student-row" style="display:block;">
          <div style="display:flex;justify-content:space-between;">
            <b>${esc(r.className || '-')}${r.subject ? ' - ' + esc(r.subject) : ''}</b>
            <span class="muted">${esc(date)}</span>
          </div>
          ${r.text ? `<div style="margin-top:4px;">${esc(r.text).replace(/\n/g, '<br>')}</div>` : ''}
          ${imgUrl ? `<div style="margin-top:6px;"><img src="${esc(imgUrl)}" style="max-width:100%;border-radius:8px;" alt="হোমওয়ার্ক ছবি"></div>` : ''}
          ${isTeacher ? `<button class="small danger" onclick="deleteHomeworkEntry('${jsq(d.id)}')" style="margin-top:6px;">মুছুন</button>` : ''}
        </div>`;
      }).join('');
    }, err => {
      const wrap = document.getElementById('hwWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(err.message) + '</p>';
      if (err.code !== 'permission-denied') showDiagBanner('হোমওয়ার্ক লোড এরর: ' + err.message);
    });
  }

  window.onHomeworkClassFilterChange = function (value) {
    homeworkClassFilter = value;
    renderHomeworkScreen(true);
  };

  window.addHomework = function () {
    const classEl = document.getElementById('hwClass');
    const className = classEl ? classEl.value : '';
    const subject = document.getElementById('hwSubject').value.trim();
    const text = document.getElementById('hwText').value.trim();
    const fileInput = document.getElementById('hwImage');
    const errEl = document.getElementById('hwError');
    const btn = document.getElementById('hwSubmitBtn');
    if (errEl) errEl.textContent = '';

    if (!className) { if (errEl) errEl.textContent = 'শ্রেণি নির্বাচন করুন'; return; }
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!text && !file) { if (errEl) errEl.textContent = 'হোমওয়ার্কের লেখা লিখুন অথবা ছবি দিন'; return; }

    const save = (imageDataUrl, imageType) => {
      if (btn) { btn.disabled = true; btn.textContent = 'সংরক্ষণ করা হচ্ছে...'; }
      db.collection('homework').add({
        madrasaId, className, subject: subject || '', text: text || '',
        imageDataUrl: imageDataUrl || '', imageType: imageType || '',
        date: todayLocal(), createdAt: Date.now()
      }).then(() => {
        document.getElementById('hwSubject').value = '';
        document.getElementById('hwText').value = '';
        if (fileInput) fileInput.value = '';
      }).catch(e => {
        if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message;
        showDiagBanner('হোমওয়ার্ক সংরক্ষণ ব্যর্থ: ' + e.message);
      }).finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'হোমওয়ার্ক দিন'; }
      });
    };

    if (!file) { save(); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'ছবি প্রস্তুত করা হচ্ছে...'; }
    compressImage(file, (dataUrl) => save(dataUrl, 'image/jpeg'), (e) => {
      if (errEl) errEl.textContent = e.message;
      if (btn) { btn.disabled = false; btn.textContent = 'হোমওয়ার্ক দিন'; }
    });
  };

  window.deleteHomeworkEntry = function (id) {
    if (!confirm('এই হোমওয়ার্ক মুছতে চান?')) return;
    db.collection('homework').doc(id).delete()
      .catch(e => { alert('মুছতে ব্যর্থ: ' + e.message); showDiagBanner('হোমওয়ার্ক মুছতে ব্যর্থ: ' + e.message); });
  };

  // ================= শিক্ষার্থী: আনরিড ব্যাজ (নোটিশ/ডায়েরীর প্যাটার্নের মতোই) =================
  function homeworkSeenKey() { return 'lastSeenHomework_' + (myStudentId || 'x'); }
  let unreadHomeworkUnsub = null;

  function startHomeworkUnreadListener() {
    if (typeof role === 'undefined' || role !== 'student' || !myStudentId) return;
    const me = studentsCache.find(s => s.id === myStudentId);
    const myClass = me ? me.className : null;
    if (!myClass) return;
    if (unreadHomeworkUnsub && unreadHomeworkUnsub.className === myClass) return;
    if (unreadHomeworkUnsub && unreadHomeworkUnsub.unsub) unreadHomeworkUnsub.unsub();
    const unsub = db.collection('homework')
      .where('madrasaId', '==', madrasaId)
      .where('className', '==', myClass)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const lastSeen = Number(localStorage.getItem(homeworkSeenKey()) || 0);
        unreadCounts.homework = snap.docs.filter(d => (d.data().createdAt || 0) > lastSeen).length;
        if (role === 'student' && typeof renderStudentNav === 'function' && typeof currentStudentTab !== 'undefined') {
          renderStudentNav(currentStudentTab);
        }
      }, err => { if (typeof showDiagBanner === 'function') showDiagBanner('হোমওয়ার্ক আনরিড লোড এরর: ' + err.message); });
    unreadHomeworkUnsub = { unsub, className: myClass };
  }

  function stopHomeworkUnreadListener() {
    if (unreadHomeworkUnsub && unreadHomeworkUnsub.unsub) { unreadHomeworkUnsub.unsub(); unreadHomeworkUnsub = null; }
    if (typeof unreadCounts !== 'undefined') unreadCounts.homework = 0;
  }

  function markHomeworkSeen() {
    localStorage.setItem(homeworkSeenKey(), String(Date.now()));
    if (typeof unreadCounts !== 'undefined') unreadCounts.homework = 0;
  }

  const origStartUnreadListeners = window.startUnreadListeners;
  if (typeof origStartUnreadListeners === 'function') {
    window.startUnreadListeners = function () {
      origStartUnreadListeners.apply(this, arguments);
      startHomeworkUnreadListener();
    };
  }
  const origStopUnreadListeners = window.stopUnreadListeners;
  if (typeof origStopUnreadListeners === 'function') {
    window.stopUnreadListeners = function () {
      origStopUnreadListeners.apply(this, arguments);
      stopHomeworkUnreadListener();
    };
  }

  // শিক্ষার্থী তালিকা/শ্রেণি দেরিতে লোড হলে আনরিড লিসেনার আবার চালু করা
  const origListenStudents = window.listenStudents;
  if (typeof origListenStudents === 'function') {
    window.listenStudents = function () {
      const r = origListenStudents.apply(this, arguments);
      if (typeof role !== 'undefined' && role === 'student' && myStudentId) startHomeworkUnreadListener();
      return r;
    };
  }

  // ================= app.js/dashboard.js এর ট্যাব-ডিসপ্যাচে জোড়া লাগানো =================
  const origTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    if (homeworkUnsub) { homeworkUnsub(); homeworkUnsub = null; }
    if (tab === 'homework') {
      if (typeof renderTeacherNav === 'function') renderTeacherNav('homework');
      renderHomeworkScreen(true);
      return;
    }
    return origTeacherTab.apply(this, arguments);
  };

  const origStudentTab = window.studentTab;
  window.studentTab = function (tab) {
    if (homeworkUnsub) { homeworkUnsub(); homeworkUnsub = null; }
    if (tab === 'homework') {
      currentStudentTab = 'homework';
      markHomeworkSeen();
      if (typeof renderStudentNav === 'function') renderStudentNav('homework');
      renderHomeworkScreen(false);
      return;
    }
    return origStudentTab.apply(this, arguments);
  };
})();
