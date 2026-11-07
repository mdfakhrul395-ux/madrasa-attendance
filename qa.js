/* ShikkhaOS — প্রশ্ন-উত্তর বক্স (qa.js)
 *
 * dashboard.js / homework.js এর মতোই আলাদা প্যাচ ফাইল: app.js বা dashboard.js বদলাতে হয় না।
 * index.html এ dashboard.js এর পরে (icons.js এর আগে) লোড করুন।
 *
 * - শিক্ষার্থীর "আরও" মেনুতে "প্রশ্ন-উত্তর": বিষয় বেছে প্রশ্ন লেখা, নিজের প্রশ্ন ও উত্তর দেখা,
 *   উত্তর না আসা পর্যন্ত নিজের প্রশ্ন মুছে ফেলা
 * - শিক্ষকের "আরও" মেনুতে "প্রশ্ন-উত্তর": উত্তর বাকি / উত্তর দেওয়া তালিকা, উত্তর লেখা ও বদলানো,
 *   অনুপযুক্ত প্রশ্ন মোছা
 * - নতুন কালেকশন: questions (madrasaId, studentId, studentName, className, subject, text, createdAt,
 *   answer, answeredBy, answeredAt)
 */
(function () {
  'use strict';

  if (typeof teacherTab !== 'function' || typeof studentTab !== 'function' || typeof db === 'undefined') {
    console.error('[qa] app.js ও dashboard.js এর পরে qa.js লোড করুন।');
    return;
  }

  // ================= CSS =================
  const CSS = `
.qa{--pine:#0a3a35;--teal:#0f766e;--brass:#e0b04f;--ink:#1e293b;--mute:#64748b;--line:#e6ebef;--ok:#15803d;--bad:#b91c1c;--warn:#b45309;color:var(--ink);padding-bottom:8px}
.qa-title{font-size:20px;font-weight:800;color:var(--pine);margin:6px 2px 2px}
.qa-sub{font-size:13px;color:var(--mute);margin:0 2px 14px;line-height:1.5}
.qa-box{background:#fff;border-radius:18px;padding:16px;margin-bottom:14px;box-shadow:0 0 0 1px var(--line)}
.qa-box label{display:block;font-size:13px;font-weight:700;color:var(--pine);margin:0 0 6px}
.qa-box select,.qa-box textarea{width:100%;box-sizing:border-box;margin:0 0 12px;padding:11px 12px;border:0;border-radius:12px;background:#f4f7f9;font:inherit;font-size:14.5px;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.qa-box textarea{min-height:92px;resize:vertical;line-height:1.55}
.qa-count{font-size:11.5px;color:var(--mute);text-align:right;margin:-8px 2px 10px}
.qa-btn{width:auto;display:inline-block;margin:0;padding:10px 18px;border:0;border-radius:12px;background:var(--teal);color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
.qa-btn.full{width:100%}
.qa-btn.ghost{background:#eef2f5;color:#334155}
.qa-btn.no{background:#fff;color:var(--bad);box-shadow:inset 0 0 0 1.5px #f3b4b4}
.qa-btn[disabled]{opacity:.55}
.qa-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px}
.qa-chip{flex:none;width:auto;margin:0;padding:7px 14px;border:0;border-radius:99px;background:#eef2f5;color:#475569;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.qa-chip.on{background:var(--pine);color:#fff}
.qa-card{background:#fff;border-radius:18px;padding:14px 16px;margin-bottom:12px;box-shadow:0 0 0 1px var(--line)}
.qa-card.new{border-left:4px solid var(--brass);border-radius:6px 18px 18px 6px}
.qa-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.qa-name{font-weight:800;font-size:14.5px;color:var(--pine);overflow-wrap:anywhere}
.qa-badge{flex:none;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}
.qa-badge.wait{background:#fef3c7;color:var(--warn)}
.qa-badge.done{background:#dcfce7;color:var(--ok)}
.qa-badge.pub{background:#dbeafe;color:#1e40af}
.qa-meta{font-size:12px;color:var(--mute);margin-top:2px}
.qa-q{font-size:14px;line-height:1.65;margin:10px 0 0;overflow-wrap:anywhere;white-space:pre-wrap}
.qa-ans{margin-top:12px;padding:11px 13px;border-radius:12px;background:#e7f5f2}
.qa-ans b{display:block;font-size:12px;color:var(--teal);margin-bottom:4px}
.qa-ans p{margin:0;font-size:14px;line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap}
.qa-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.qa-card textarea{width:100%;box-sizing:border-box;margin:12px 0 0;padding:11px 12px;min-height:80px;border:0;border-radius:12px;background:#f4f7f9;font:inherit;font-size:14.5px;box-shadow:inset 0 0 0 1px var(--line);resize:vertical;line-height:1.55}
.qa-empty{text-align:center;color:var(--mute);font-size:13.5px;line-height:1.7;padding:26px 10px}
.qa-err{color:var(--bad);font-size:13px;line-height:1.6;padding:10px 2px}
.qa-nav-badge{position:absolute;top:-5px;right:-8px;min-width:16px;height:16px;line-height:16px;padding:0 4px;border-radius:99px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;text-align:center;box-sizing:border-box;pointer-events:none;z-index:2}
`;
  if (!document.getElementById('qaStyles')) {
    const st = document.createElement('style');
    st.id = 'qaStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ================= HELPERS =================
  const bn = n => (typeof toBanglaNumeral === 'function' ? toBanglaNumeral(n) : String(n));
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // onclick="fn('...')" এর ভেতরের আইডির জন্য (esc() একা যথেষ্ট নয়)
  const jsq = s => esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, ' '));
  const fmtWhen = ts => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' });
  };
  const subjectList = () => {
    const a = (typeof DIARY_SUBJECTS !== 'undefined' && Array.isArray(DIARY_SUBJECTS)) ? DIARY_SUBJECTS.slice() : [];
    if (a.indexOf('অন্যান্য') === -1) a.push('অন্যান্য');
    return a;
  };

  let unsubs = [];
  let token = 0;
  let Q = null;                 // বর্তমান ডেটা: { items, error }
  let pubUnsub = null;          // শিক্ষার্থীর "শ্রেণির প্রশ্নোত্তর" লিসেনার
  let filter = 'pending';       // শিক্ষকের তালিকার ফিল্টার
  let classFilter = '';         // শিক্ষকের তালিকার শ্রেণি ফিল্টার
  const drafts = {};            // শিক্ষকের লেখা অসম্পূর্ণ উত্তর (নতুন প্রশ্ন এলে যাতে মুছে না যায়)
  const editing = {};           // উত্তর দেওয়া প্রশ্নের উত্তর বদলানো হচ্ছে কিনা

  function stopPub() { if (pubUnsub) { try { pubUnsub(); } catch (e) { /* ignore */ } pubUnsub = null; } }

  function qaStop() {
    token++;
    stopPub();
    unsubs.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
    unsubs = [];
  }

  function diag(key, err) {
    console.error('[qa]', key, err);
    if (typeof showDiagBanner === 'function') showDiagBanner('প্রশ্ন-উত্তর (' + key + ') লোড এরর: ' + (err && err.code ? err.code + ' ' : '') + (err && err.message));
  }

  // =====================================================================
  //                          শিক্ষার্থীর পাশ
  // =====================================================================
  function stuHtml() {
    const opts = subjectList().map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    return `
<div id="qaStuScreen" class="qa">
  <div class="qa-title">প্রশ্ন-উত্তর বক্স</div>
  <div class="qa-sub">পড়ার কোনো বিষয়ে প্রশ্ন থাকলে এখানে লিখুন। শিক্ষক উত্তর দিলে এখানেই দেখতে পাবেন।</div>
  <div class="qa-chips">
    <button class="qa-chip on" id="qaTabMine" onclick="qaStuView('mine')">আমার প্রশ্ন</button>
    <button class="qa-chip" id="qaTabPub" onclick="qaStuView('pub')">শ্রেণির প্রশ্নোত্তর</button>
  </div>
  <div id="qaMineWrap">
  <div class="qa-box">
    <label for="qaSubj">বিষয়</label>
    <select id="qaSubj">${opts}</select>
    <label for="qaText">আপনার প্রশ্ন</label>
    <textarea id="qaText" maxlength="1000" placeholder="প্রশ্নটি স্পষ্ট করে লিখুন" oninput="qaCount()"></textarea>
    <div class="qa-count" id="qaCnt">০/১০০০</div>
    <button class="qa-btn full" id="qaSendBtn" onclick="qaSend()">প্রশ্ন পাঠান</button>
  </div>
  <div class="qa-title" style="font-size:16px">আমার প্রশ্নগুলো</div>
  <div id="qaStuList"><div class="qa-empty">লোড হচ্ছে...</div></div>
  </div>
  <div id="qaPubWrap" style="display:none">
    <div class="qa-sub">আপনার শ্রেণির কোনো শিক্ষার্থীর প্রশ্নের উত্তর শিক্ষক প্রকাশ করলে সেটি এখানে দেখা যাবে। প্রশ্নকারীর নাম দেখানো হয় না।</div>
    <div id="qaPubList"><div class="qa-empty">লোড হচ্ছে...</div></div>
  </div>
</div>`;
  }

  window.qaCount = function () {
    const t = el('qaText'), c = el('qaCnt');
    if (t && c) c.textContent = bn(t.value.length) + '/' + bn(1000);
  };

  window.qaSend = function () {
    const t = el('qaText'), s = el('qaSubj'), btn = el('qaSendBtn');
    if (!t || !s) return;
    const text = t.value.trim();
    if (!text) { alert('আগে প্রশ্নটি লিখুন।'); return; }
    const me = studentsCache.find(x => x.id === myStudentId);
    if (!me) { alert('আপনার তথ্য এখনো লোড হয়নি। একটু পরে আবার চেষ্টা করুন।'); return; }
    // বারবার পাঠানো ঠেকাতে ৩০ সেকেন্ডের বিরতি (অ্যাপের ভেতরের ব্যবস্থা)
    let last = 0;
    try { last = Number(localStorage.getItem('qaLastAsk') || 0); } catch (e) { /* ignore */ }
    if (Date.now() - last < 30000) { alert('একটু অপেক্ষা করে আবার প্রশ্ন পাঠান।'); return; }
    btn.disabled = true;
    db.collection('questions').add({
      madrasaId: madrasaId,
      studentId: myStudentId,
      studentName: String(me.name || '').slice(0, 80),
      className: String(me.className || '').slice(0, 60),
      subject: String(s.value || '').slice(0, 40),
      text: text,
      createdAt: Date.now()
    }).then(() => {
      try { localStorage.setItem('qaLastAsk', String(Date.now())); } catch (e) { /* ignore */ }
      t.value = '';
      window.qaCount();
      btn.disabled = false;
      alert('আপনার প্রশ্ন পাঠানো হয়েছে।');
    }).catch(err => {
      btn.disabled = false;
      diag('send', err);
      alert('প্রশ্ন পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
    });
  };

  window.qaStuDelete = function (id) {
    if (!confirm('এই প্রশ্নটি মুছে ফেলতে চান?')) return;
    db.collection('questions').doc(id).delete().catch(err => { diag('stuDelete', err); alert('মোছা যায়নি।'); });
  };

  function paintStuList() {
    const box = el('qaStuList');
    if (!box || !Q) return;
    if (Q.error) { box.innerHTML = '<div class="qa-err">প্রশ্নগুলো লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।</div>'; return; }
    if (!Q.items) return;
    if (!Q.items.length) { box.innerHTML = '<div class="qa-empty">এখনো কোনো প্রশ্ন করা হয়নি।</div>'; return; }
    box.innerHTML = Q.items.map(q => {
      const answered = !!q.answer;
      return `
<div class="qa-card${answered ? ' new' : ''}">
  <div class="qa-top"><span class="qa-name">${esc(q.subject || 'প্রশ্ন')}</span><span class="qa-badge ${answered ? 'done' : 'wait'}">${answered ? 'উত্তর এসেছে' : 'উত্তরের অপেক্ষায়'}</span></div>
  <div class="qa-meta">${esc(fmtWhen(q.createdAt))}${q.isPublic ? ' · শ্রেণির জন্য প্রকাশিত' : ''}</div>
  <p class="qa-q">${esc(q.text)}</p>
  ${answered ? `<div class="qa-ans"><b>শিক্ষকের উত্তর${q.answeredAt ? ' · ' + esc(fmtWhen(q.answeredAt)) : ''}</b><p>${esc(q.answer)}</p></div>` : `<div class="qa-act"><button class="qa-btn no" onclick="qaStuDelete('${jsq(q.id)}')">মুছুন</button></div>`}
</div>`;
    }).join('');
  }

  // ---------- শ্রেণির প্রশ্নোত্তর (শিক্ষক যেগুলো প্রকাশ করেছেন) ----------
  let P = null;

  window.qaStuView = function (v) {
    const mine = el('qaMineWrap'), pub = el('qaPubWrap');
    if (!mine || !pub) return;
    const isPub = v === 'pub';
    mine.style.display = isPub ? 'none' : '';
    pub.style.display = isPub ? '' : 'none';
    const a = el('qaTabMine'), b = el('qaTabPub');
    if (a) a.classList.toggle('on', !isPub);
    if (b) b.classList.toggle('on', isPub);
    if (isPub) startPub(); else stopPub();
  };

  function startPub() {
    if (pubUnsub) return;
    const tok = token;
    P = { items: null, error: false };
    const me = studentsCache.find(s => s.id === myStudentId);
    const myClass = me ? (me.className || '') : '';
    if (!myClass) { P.items = []; P.noClass = true; paintPub(); return; }
    paintPub();
    const col = db.collection('public_qa');
    const handle = snap => {
      if (tok !== token || !P) return;
      P.items = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.answeredAt || 0) - (a.answeredAt || 0));
      P.error = false;
      paintPub();
    };
    const fail = err => {
      if (tok !== token || !P) return;
      P.error = true;
      diag('public', err);
      paintPub();
    };
    // শুধু নিজের শ্রেণির প্রকাশিত প্রশ্নোত্তর, সর্বশেষ ৩০টি
    // (ইনডেক্স: public_qa → madrasaId + className + answeredAt; না থাকলে ইনডেক্সহীন কোয়েরিতে ফিরে যায়)
    pubUnsub = col.where('madrasaId', '==', madrasaId).where('className', '==', myClass).orderBy('answeredAt', 'desc').limit(30).onSnapshot(handle, err => {
      if (tok !== token) return;
      if (err && err.code === 'failed-precondition') {
        try { if (pubUnsub) pubUnsub(); } catch (e) { /* ignore */ }
        diag('public-index', err);
        pubUnsub = col.where('madrasaId', '==', madrasaId).where('className', '==', myClass).limit(50).onSnapshot(handle, fail);
      } else {
        fail(err);
      }
    });
  }

  function paintPub() {
    const box = el('qaPubList');
    if (!box || !P) return;
    if (P.error) { box.innerHTML = '<div class="qa-err">লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।</div>'; return; }
    if (P.noClass) { box.innerHTML = '<div class="qa-empty">আপনার শ্রেণির তথ্য পাওয়া যায়নি।</div>'; return; }
    if (!P.items) { box.innerHTML = '<div class="qa-empty">লোড হচ্ছে...</div>'; return; }
    if (!P.items.length) { box.innerHTML = '<div class="qa-empty">আপনার শ্রেণির জন্য এখনো কোনো প্রশ্নোত্তর প্রকাশ করা হয়নি।</div>'; return; }
    box.innerHTML = P.items.map(q => `
<div class="qa-card">
  <div class="qa-top"><span class="qa-name">${esc(q.subject || 'প্রশ্ন')}</span></div>
  <div class="qa-meta">${esc(fmtWhen(q.answeredAt))}</div>
  <p class="qa-q">${esc(q.text)}</p>
  <div class="qa-ans"><b>শিক্ষকের উত্তর</b><p>${esc(q.answer)}</p></div>
</div>`).join('');
  }

  function renderStudent() {
    qaStop();
    const tok = token;
    Q = { items: null, error: false };
    setScreen(stuHtml());
    unsubs.push(db.collection('questions').where('studentId', '==', myStudentId)
      .onSnapshot(snap => {
        if (tok !== token || !Q) return;
        Q.items = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        Q.error = false;
        paintStuList();
      }, err => {
        if (tok !== token || !Q) return;
        Q.error = true;
        diag('student', err);
        paintStuList();
      }));
  }

  // =====================================================================
  //                           শিক্ষকের পাশ
  // =====================================================================
  function teacherHtml() {
    return `
<div id="qaTeacherScreen" class="qa">
  <div class="qa-title">প্রশ্ন-উত্তর</div>
  <div class="qa-sub">শিক্ষার্থীদের পাঠানো প্রশ্ন এখানে আসে। উত্তর লিখলে শিক্ষার্থী নিজের পাতায় দেখতে পাবে।</div>
  <div id="qaTChips"></div>
  <div id="qaTList"><div class="qa-empty">লোড হচ্ছে...</div></div>
</div>`;
  }

  window.qaFilter = function (f) { filter = f; paintTeacher(); };
  window.qaClass = function (i) {
    const list = (Q && Q.classes) || [];
    classFilter = list[i] === undefined ? '' : list[i];
    paintTeacher();
  };
  window.qaDraft = function (id, v) { drafts[id] = v; };
  window.qaEdit = function (id) {
    const q = Q && Q.items && Q.items.find(x => x.id === id);
    if (!q) return;
    editing[id] = true;
    if (drafts[id] === undefined) drafts[id] = q.answer || '';
    paintTeacher();
  };
  window.qaCancelEdit = function (id) { delete editing[id]; delete drafts[id]; paintTeacher(); };

  window.qaAnswer = function (id) {
    const text = String(drafts[id] || '').trim();
    if (!text) { alert('আগে উত্তর লিখুন।'); return; }
    if (text.length > 2000) { alert('উত্তর সর্বোচ্চ ২০০০ অক্ষরের হতে পারে।'); return; }
    let who = '';
    try { who = String((typeof myTeacherName !== 'undefined' && myTeacherName) || '').slice(0, 80); } catch (e) { /* ignore */ }
    const q0 = Q && Q.items && Q.items.find(x => x.id === id);
    const at = Date.now();
    db.collection('questions').doc(id).update({ answer: text, answeredBy: who, answeredAt: at })
      .then(() => {
        delete drafts[id]; delete editing[id];
        // আগে শ্রেণির জন্য প্রকাশ করা থাকলে প্রকাশিত কপিও নতুন উত্তরে হালনাগাদ হয়
        if (q0 && q0.isPublic) return db.collection('public_qa').doc(id).set(pubDoc(q0, text, at));
      })
      .catch(err => { diag('answer', err); alert('উত্তর পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'); });
  };

  // প্রকাশিত কপিতে শিক্ষার্থীর নাম/আইডি থাকে না — শুধু শ্রেণি, বিষয়, প্রশ্ন ও উত্তর
  function pubDoc(q, answer, answeredAt) {
    return {
      madrasaId: madrasaId,
      className: String(q.className || '').slice(0, 60),
      subject: String(q.subject || '').slice(0, 40),
      text: q.text,
      answer: answer,
      answeredAt: answeredAt,
      createdAt: q.createdAt || 0
    };
  }

  window.qaPublish = function (id) {
    const q = Q && Q.items && Q.items.find(x => x.id === id);
    if (!q || !q.answer) { alert('আগে উত্তর দিন।'); return; }
    if (!confirm('এই প্রশ্ন ও উত্তর ' + (q.className ? q.className + ' শ্রেণির' : 'ওই শ্রেণির') + ' সব শিক্ষার্থী দেখতে পাবে (অন্য শ্রেণি নয়)। শিক্ষার্থীর নাম দেখানো হবে না। প্রকাশ করবেন?')) return;
    db.collection('public_qa').doc(id).set(pubDoc(q, q.answer, q.answeredAt || Date.now()))
      .then(() => db.collection('questions').doc(id).update({ isPublic: true }))
      .catch(err => { diag('publish', err); alert('প্রকাশ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'); });
  };

  window.qaUnpublish = function (id) {
    if (!confirm('এটি আর শ্রেণির শিক্ষার্থীদের জন্য দেখানো হবে না। প্রকাশ বন্ধ করবেন?')) return;
    db.collection('public_qa').doc(id).delete()
      .then(() => db.collection('questions').doc(id).update({ isPublic: false }))
      .catch(err => { diag('unpublish', err); alert('প্রকাশ বন্ধ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'); });
  };

  window.qaDelete = function (id) {
    if (!confirm('এই প্রশ্নটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।')) return;
    const q0 = Q && Q.items && Q.items.find(x => x.id === id);
    const pubDel = (q0 && q0.isPublic) ? db.collection('public_qa').doc(id).delete().catch(() => {}) : Promise.resolve();
    pubDel.then(() => db.collection('questions').doc(id).delete())
      .then(() => { delete drafts[id]; delete editing[id]; })
      .catch(err => { diag('delete', err); alert('মোছা যায়নি।'); });
  };

  function paintTeacher() {
    const chipsBox = el('qaTChips'), box = el('qaTList');
    if (!chipsBox || !box || !Q) return;
    if (Q.error) { chipsBox.innerHTML = ''; box.innerHTML = '<div class="qa-err">প্রশ্নগুলো লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন। (সমস্যা থাকলে সেটিংসে ডিবাগ মোড চালু করে দেখুন)</div>'; return; }
    if (!Q.items) return;

    const all = Q.items;
    const pendingN = all.filter(q => !q.answer).length;
    const classes = Array.from(new Set(all.map(q => q.className || '').filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'bn'));
    Q.classes = classes;
    if (classFilter && classes.indexOf(classFilter) === -1) classFilter = '';

    let html = `<div class="qa-chips">
      <button class="qa-chip${filter === 'pending' ? ' on' : ''}" onclick="qaFilter('pending')">উত্তর বাকি (${bn(pendingN)})</button>
      <button class="qa-chip${filter === 'answered' ? ' on' : ''}" onclick="qaFilter('answered')">উত্তর দেওয়া</button>
      <button class="qa-chip${filter === 'public' ? ' on' : ''}" onclick="qaFilter('public')">প্রকাশিত</button>
      <button class="qa-chip${filter === 'all' ? ' on' : ''}" onclick="qaFilter('all')">সব</button>
    </div>`;
    if (classes.length > 1) {
      html += `<div class="qa-chips"><button class="qa-chip${classFilter === '' ? ' on' : ''}" onclick="qaClass(-1)">সব শ্রেণি</button>`
        + classes.map((c, i) => `<button class="qa-chip${classFilter === c ? ' on' : ''}" onclick="qaClass(${i})">${esc(c)}</button>`).join('') + '</div>';
    }
    chipsBox.innerHTML = html;

    const shown = all.filter(q => {
      if (filter === 'pending' && q.answer) return false;
      if (filter === 'answered' && !q.answer) return false;
      if (filter === 'public' && !q.isPublic) return false;
      if (classFilter && (q.className || '') !== classFilter) return false;
      return true;
    });
    if (!shown.length) {
      box.innerHTML = '<div class="qa-empty">' + (filter === 'pending' ? 'কোনো প্রশ্নের উত্তর বাকি নেই।' : 'এখানে দেখানোর মতো কোনো প্রশ্ন নেই।') + '</div>';
      return;
    }
    box.innerHTML = shown.map(q => {
      const id = jsq(q.id);
      const st = studentsCache.find(s => s.id === q.studentId);
      const meta = [q.className, st && st.roll ? 'রোল ' + bn(st.roll) : '', q.subject, fmtWhen(q.createdAt)].filter(Boolean).map(esc).join(' · ');
      const answered = !!q.answer;
      let body;
      if (answered && !editing[q.id]) {
        body = `<div class="qa-ans"><b>আপনার উত্তর${q.answeredAt ? ' · ' + esc(fmtWhen(q.answeredAt)) : ''}</b><p>${esc(q.answer)}</p></div>
          <div class="qa-act"><button class="qa-btn ghost" onclick="qaEdit('${id}')">উত্তর বদলান</button>${q.isPublic ? `<button class="qa-btn ghost" onclick="qaUnpublish('${id}')">প্রকাশ বন্ধ করুন</button>` : `<button class="qa-btn" onclick="qaPublish('${id}')">শ্রেণির জন্য প্রকাশ করুন</button>`}<button class="qa-btn no" onclick="qaDelete('${id}')">মুছুন</button></div>`;
      } else {
        body = `<textarea maxlength="2000" placeholder="উত্তর লিখুন" oninput="qaDraft('${id}',this.value)">${esc(drafts[q.id] || '')}</textarea>
          <div class="qa-act"><button class="qa-btn" onclick="qaAnswer('${id}')">উত্তর পাঠান</button>${editing[q.id] ? `<button class="qa-btn ghost" onclick="qaCancelEdit('${id}')">বাতিল</button>` : ''}<button class="qa-btn no" onclick="qaDelete('${id}')">মুছুন</button></div>`;
      }
      return `<div class="qa-card${answered ? '' : ' new'}">
        <div class="qa-top"><span class="qa-name">${esc(q.studentName || 'শিক্ষার্থী')}</span><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><span class="qa-badge ${answered ? 'done' : 'wait'}">${answered ? 'উত্তর দেওয়া হয়েছে' : 'উত্তর বাকি'}</span>${q.isPublic ? '<span class="qa-badge pub">শ্রেণির জন্য প্রকাশিত</span>' : ''}</span></div>
        <div class="qa-meta">${meta}</div>
        <p class="qa-q">${esc(q.text)}</p>
        ${body}
      </div>`;
    }).join('');
  }

  function renderTeacher() {
    qaStop();
    const tok = token;
    Q = { items: null, error: false, classes: [] };
    setScreen(teacherHtml());
    unsubs.push(db.collection('questions').where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc').limit(100)
      .onSnapshot(snap => {
        if (tok !== token || !Q || !el('qaTeacherScreen')) return;
        Q.items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        Q.error = false;
        paintTeacher();
      }, err => {
        if (tok !== token || !Q) return;
        Q.error = true;
        diag('teacher', err);
        paintTeacher();
      }));
  }

  // =====================================================================
  //                     মেনু ও ট্যাবের সাথে জোড়া লাগানো
  // =====================================================================
  const stopDash = () => { if (typeof window.stopTeacherDashboard === 'function') window.stopTeacherDashboard(); };

  if (typeof teacherMoreTabs !== 'undefined' && !teacherMoreTabs.some(t => t.key === 'qa')) {
    teacherMoreTabs.push({ key: 'qa', label: 'প্রশ্ন-উত্তর', icon: '\u2753' });
  }
  if (typeof studentMoreTabs !== 'undefined' && !studentMoreTabs.some(t => t.key === 'qa')) {
    studentMoreTabs.push({ key: 'qa', label: 'প্রশ্ন-উত্তর', icon: '\u2753' });
  }

  const prevTeacherTab = window.teacherTab;
  let activeTeacherKey = 'home';
  window.teacherTab = function (tab) {
    qaStop();
    activeTeacherKey = tab;
    if (tab === 'qa') {
      stopDash();
      renderTeacherNav('qa');
      renderTeacher();
      return;
    }
    return prevTeacherTab.apply(this, arguments);
  };

  const prevStudentTab = window.studentTab;
  window.studentTab = function (tab) {
    qaStop();
    if (tab === 'qa') {
      stopDash();
      currentStudentTab = 'qa';
      markQaSeen();
      renderStudentNav('qa');
      renderStudent();
      return;
    }
    return prevStudentTab.apply(this, arguments);
  };


  // =====================================================================
  //   শিক্ষার্থীর "উত্তর এসেছে" ব্যাজ (homework.js এর unreadCounts প্যাটার্নে)
  //   শুধু শিক্ষার্থীর নিজের প্রশ্নগুলোর লিসেনার, তাই রিড খুবই কম
  // =====================================================================
  if (typeof unreadCounts !== 'undefined') unreadCounts.qa = 0;
  const seenKey = () => 'lastSeenQa_' + (myStudentId || 'x');
  let badgeUnsub = null;

  function startQaBadge() {
    if (typeof role === 'undefined' || role !== 'student' || !myStudentId || typeof unreadCounts === 'undefined') return;
    if (badgeUnsub && badgeUnsub.sid === myStudentId) return;
    if (badgeUnsub) { try { badgeUnsub.unsub(); } catch (e) { /* ignore */ } badgeUnsub = null; }
    const sid = myStudentId;
    const unsub = db.collection('questions').where('studentId', '==', sid).onSnapshot(snap => {
      const open = typeof currentStudentTab !== 'undefined' && currentStudentTab === 'qa';
      let seen = Number(localStorage.getItem(seenKey()) || 0);
      if (open) { seen = Date.now(); try { localStorage.setItem(seenKey(), String(seen)); } catch (e) { /* ignore */ } }
      unreadCounts.qa = open ? 0 : snap.docs.filter(d => (d.data().answeredAt || 0) > seen).length;
      if (role === 'student' && typeof renderStudentNav === 'function' && typeof currentStudentTab !== 'undefined') renderStudentNav(currentStudentTab);
    }, err => console.error('[qa] badge', err));
    badgeUnsub = { unsub, sid };
  }
  function stopQaBadge() {
    if (badgeUnsub) { try { badgeUnsub.unsub(); } catch (e) { /* ignore */ } badgeUnsub = null; }
    if (typeof unreadCounts !== 'undefined') unreadCounts.qa = 0;
  }
  function markQaSeen() {
    try { localStorage.setItem(seenKey(), String(Date.now())); } catch (e) { /* ignore */ }
    if (typeof unreadCounts !== 'undefined') unreadCounts.qa = 0;
  }

  const prevStart = window.startUnreadListeners;
  if (typeof prevStart === 'function') {
    window.startUnreadListeners = function () { prevStart.apply(this, arguments); startQaBadge(); };
  }
  const prevStop = window.stopUnreadListeners;
  if (typeof prevStop === 'function') {
    window.stopUnreadListeners = function () { prevStop.apply(this, arguments); stopQaBadge(); };
  }
  const prevListen = window.listenStudents;
  if (typeof prevListen === 'function') {
    window.listenStudents = function () {
      const r = prevListen.apply(this, arguments);
      if (typeof role !== 'undefined' && role === 'student' && myStudentId) startQaBadge();
      return r;
    };
  }


  // =====================================================================
  //   শিক্ষকের "উত্তর বাকি" ব্যাজ
  //   রিড কম রাখতে শুধু সর্বশেষ ২০টি প্রশ্নের লিসেনার (লগইনে সর্বোচ্চ ২০ রিড)
  //   আগের তৈরি করা (madrasaId + createdAt) ইনডেক্সই এখানে কাজ করে
  // =====================================================================
  // app.js ও dashboard.js এর শিক্ষক-নেভ ব্যাজ নেয় না (শুধু শিক্ষার্থী-নেভ নেয়), তাই
  // কে নেভ আঁকল তা না দেখে সরাসরি নেভের HTML-এ ব্যাজ বসানো হয়; নেভ নতুন করে আঁকা হলেও আবার বসে।
  function paintTeacherNavBadge() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    const isTeacher = typeof role !== 'undefined' && role === 'teacher';
    const n = (isTeacher && typeof unreadCounts !== 'undefined') ? (unreadCounts.qa || 0) : 0;
    const targets = [
      nav.querySelector('[onclick*="toggleMoreMenu"]'),
      nav.querySelector('[onclick*="teacherTab(\'qa\')"]')
    ];
    targets.forEach(t => {
      if (!t) return;
      const host = t.querySelector('.tab-icon, .more-icon') || t;
      let b = host.querySelector(':scope > .qa-nav-badge');
      if (n > 0) {
        if (!b) {
          if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
          b = document.createElement('span');
          b.className = 'qa-nav-badge';
          host.appendChild(b);
        }
        b.textContent = n > 9 ? '9+' : bn(n);
      } else if (b) {
        b.remove();
      }
    });
  }
  let navObs = null;
  function watchTeacherNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav || navObs || typeof MutationObserver === 'undefined') return;
    navObs = new MutationObserver(() => {
      navObs.disconnect();
      paintTeacherNavBadge();
      navObs.observe(nav, { childList: true, subtree: true });
    });
    navObs.observe(nav, { childList: true, subtree: true });
  }
  watchTeacherNav();

  let tBadgeUnsub = null;

  function startTeacherBadge() {
    if (typeof unreadCounts === 'undefined' || typeof madrasaId === 'undefined' || !madrasaId) return;
    if (tBadgeUnsub && tBadgeUnsub.mid === madrasaId) return;
    if (tBadgeUnsub) { try { tBadgeUnsub.unsub(); } catch (e) { /* ignore */ } tBadgeUnsub = null; }
    const mid = madrasaId;
    const unsub = db.collection('questions').where('madrasaId', '==', mid).orderBy('createdAt', 'desc').limit(20)
      .onSnapshot(snap => {
        unreadCounts.qa = snap.docs.filter(d => !d.data().answer).length;
        paintTeacherNavBadge();
      }, err => console.error('[qa] teacher badge', err));
    tBadgeUnsub = { unsub, mid };
  }
  function stopTeacherBadge() {
    if (tBadgeUnsub) { try { tBadgeUnsub.unsub(); } catch (e) { /* ignore */ } tBadgeUnsub = null; }
    if (typeof unreadCounts !== 'undefined') unreadCounts.qa = 0;
    paintTeacherNavBadge();
  }

  const prevShowTeacherApp = window.showTeacherApp;
  if (typeof prevShowTeacherApp === 'function') {
    window.showTeacherApp = function () {
      const r = prevShowTeacherApp.apply(this, arguments);
      startTeacherBadge();
      return r;
    };
  }

  const prevLogout = window.logout;
  if (typeof prevLogout === 'function') {
    window.logout = function () { qaStop(); stopTeacherBadge(); stopQaBadge(); return prevLogout.apply(this, arguments); };
  }
})();
