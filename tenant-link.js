/* ShikkhaOS — মাদ্রাসার শিক্ষার্থী লগইন লিংক ও মাদ্রাসা কোড
 *
 * index.html-এ dashboard.js-এর ঠিক নিচে লোড করুন (dashboard.js-এর আগে নয়):
 *   <script defer src="app.js"></script>
 *   <script defer src="dashboard.js"></script>
 *   <script defer src="tenant-link.js"></script>
 *
 * app.js ও dashboard.js-এর একটি অক্ষরও বদলাতে হয় না। এই ফাইল:
 *   1. সেটিংস পাতায় (শুধু অ্যাডমিন দেখেন) "শিক্ষার্থী লগইন লিংক" কার্ড যোগ করে
 *      — কপি ও হোয়াটসঅ্যাপে পাঠানোর বাটনসহ, সাথে মাদ্রাসা কোড।
 *   2. কোনো ফোনে মাদ্রাসা নিশ্চিত করা না থাকলে "শিক্ষার্থী" চাপার পর আগে মাদ্রাসা কোড চায়,
 *      যাতে নতুন মাদ্রাসার শিক্ষার্থী ভুল করে অন্য মাদ্রাসার (ডিফল্ট madrasa-001) নামের তালিকা না দেখে।
 *   3. শিক্ষার্থী লগইন পাতায় "ভুল মাদ্রাসা? কোড বদলান" লিংক যোগ করে।
 *
 * "নিশ্চিত" ধরা হয়: লিংকে ?m= থাকলে, আগে থেকে লগইন করা থাকলে, ডিফল্ট ছাড়া অন্য মাদ্রাসা সেভ থাকলে,
 * অথবা এই ফোনে কখনো শিক্ষক/শিক্ষার্থী সফলভাবে ঢুকলে।
 */
(function () {
  'use strict';

  if (typeof showStudentPicker !== 'function' || typeof pickRole !== 'function' || typeof db === 'undefined') {
    console.error('[tenant-link] app.js ও dashboard.js-এর আগে লোড হয়েছে। index.html-এ এই ফাইলের লাইনটি dashboard.js-এর নিচে রাখুন।');
    return;
  }

  const CONFIRM_KEY = 'madrasaConfirmed';
  const DEFAULT_ID = 'madrasa-001';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const drop = k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  // ---------- এই ফোনে মাদ্রাসা নিশ্চিত কি না ----------
  // "madrasa-001" হলো আপনার নিজের (মূল) মাদ্রাসা — এটি সবসময় নিশ্চিত ধরা হয়,
  // যাতে লগআউট করা পুরাতন শিক্ষার্থীদের অকারণে কোড চাওয়া না হয়। কোড শুধু তখনই
  // চাওয়া হবে যখন ফোনে madrasa-001 ছাড়া অন্য কোনো মাদ্রাসার প্রমাণ নেই এবং
  // লিংক দিয়েও আসেনি — অর্থাৎ এটি সম্ভবত নতুন মাদ্রাসার শিক্ষার্থীর ফোন।
  const hasUrlCode = !!new URLSearchParams(window.location.search).get('m');
  if (hasUrlCode || get('role') || get('myStudentId') || (get('madrasaId') || DEFAULT_ID) !== DEFAULT_ID) {
    put(CONFIRM_KEY, '1');
  }
  const confirmed = () => get(CONFIRM_KEY) === '1' || (get('madrasaId') || DEFAULT_ID) === DEFAULT_ID;

  // শিক্ষক বা শিক্ষার্থী সফলভাবে ঢুকলে এই ফোনের মাদ্রাসা নিশ্চিত ধরা হয়
  ['showTeacherApp', 'showStudentApp'].forEach(name => {
    const prev = window[name];
    if (typeof prev !== 'function') return;
    window[name] = function () { put(CONFIRM_KEY, '1'); return prev.apply(this, arguments); };
  });

  // ---------- ১. সেটিংসে লগইন লিংক কার্ড ----------
  function loginLinkFor(id) {
    const base = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
    return base + '?m=' + encodeURIComponent(id);
  }
  function loginLink() { return loginLinkFor(madrasaId); }

  function addLinkCard() {
    const app = document.getElementById('app');
    if (!app || document.getElementById('tenantLinkCard')) return;
    app.insertAdjacentHTML('beforeend', `
      <div class="card" id="tenantLinkCard">
        <h2>শিক্ষার্থী লগইন লিংক</h2>
        <p class="muted">এই লিংক আপনার মাদ্রাসার শিক্ষার্থী ও অভিভাবকদের পাঠান (যেমন হোয়াটসঅ্যাপ গ্রুপে)। লিংক একবার খুললেই তাদের ফোন আপনার মাদ্রাসা চিনে নেবে।</p>
        <input id="tenantLinkInput" readonly value="${esc(loginLink())}" onclick="this.select()">
        <div class="row" style="margin-top:8px;">
          <button class="small" onclick="tenantCopyLink()">কপি করুন</button>
          <button class="small secondary" onclick="tenantShareLink()">হোয়াটসঅ্যাপে পাঠান</button>
        </div>
        <p class="muted" style="margin-top:8px;">মাদ্রাসা কোড: <b>${esc(madrasaId)}</b><br>লিংক না থাকলে শিক্ষার্থীরা "শিক্ষার্থী" চাপার পর এই কোড লিখেও ঢুকতে পারবে।</p>
      </div>`);
  }

  function copyText(text) {
    const done = () => alert('লিংক কপি করা হয়েছে');
    const fallback = () => { window.prompt('লিংকটি কপি করুন:', text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  window.tenantCopyLink = function () {
    const i = document.getElementById('tenantLinkInput');
    if (i) i.select();
    copyText(loginLink());
  };

  window.tenantShareLink = function () {
    const name = (typeof appSettings !== 'undefined' && appSettings && appSettings.madrasaName) || 'মাদ্রাসা';
    const text = name + '-এর শিক্ষার্থী লগইন লিংক: ' + loginLink();
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // সুপার অ্যাডমিন প্যানেল থেকে যেকোনো মাদ্রাসার লিংক কপি/শেয়ার করার জন্য
  window.tenantCopyLinkFor = function (id) { copyText(loginLinkFor(id)); };
  window.tenantShareLinkFor = function (id, name) {
    const text = (name || 'মাদ্রাসা') + '-এর শিক্ষার্থী লগইন লিংক: ' + loginLinkFor(id);
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  const prevSettings = window.renderSettingsScreen;
  if (typeof prevSettings === 'function') {
    window.renderSettingsScreen = function () {
      const r = prevSettings.apply(this, arguments);
      addLinkCard();
      return r;
    };
  }

  // ---------- ২. মাদ্রাসা কোড দেওয়ার পাতা ----------
  function showCodeScreen() {
    setScreen(`
      <div class="card" style="margin-top:40px;">
        <h2>আপনার মাদ্রাসার কোড দিন</h2>
        <p class="muted">মাদ্রাসার শিক্ষক বা অ্যাডমিনের কাছ থেকে কোড বা লগইন লিংক নিন। লিংকে চাপলে কোড লিখতে হয় না।</p>
        <input id="tenantCodeInput" placeholder="মাদ্রাসা কোড" autocomplete="off" autocapitalize="none" onkeydown="if(event.key==='Enter'){tenantSubmitCode();}">
        <p id="tenantCodeError" class="muted" style="color:#dc2626;"></p>
        <button id="tenantCodeBtn" onclick="tenantSubmitCode()">এগিয়ে যান</button>
        <button class="secondary" onclick="showRoleSelect()" style="margin-top:8px;">ফিরে যান</button>
      </div>`);
    if (typeof hideNav === 'function') hideNav();
  }

  function switchMadrasa(code) {
    put('madrasaId', code);
    put(CONFIRM_KEY, '1');
    drop('loginClass'); // আগের মাদ্রাসার শ্রেণির পছন্দ মুছে ফেলা
    madrasaId = code;
    studentsCache = []; // আগের মাদ্রাসার নাম যেন এক মুহূর্তও না দেখায়
    appSettings = {};
    if (typeof renderTopBar === 'function') renderTopBar();
    listenStudents();
    listenSettings();
    window.pickRole('student');
  }

  window.tenantSubmitCode = function () {
    const input = document.getElementById('tenantCodeInput');
    const errEl = document.getElementById('tenantCodeError');
    const btn = document.getElementById('tenantCodeBtn');
    const fail = msg => { if (errEl) errEl.textContent = msg; if (btn) btn.disabled = false; };
    if (errEl) errEl.textContent = '';

    const code = (input ? input.value : '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,64}$/.test(code)) { fail('কোডটি সঠিক নয়, আবার দেখে লিখুন'); return; }
    if (code === DEFAULT_ID) { switchMadrasa(code); return; }
    if (!auth.currentUser) { fail('কয়েক সেকেন্ড পরে আবার চেষ্টা করুন'); return; }

    if (btn) btn.disabled = true;
    db.collection('madrasas').doc(code).get()
      .then(doc => {
        if (!doc.exists) { fail('এই কোডে কোনো মাদ্রাসা পাওয়া যায়নি। কোডটি আবার দেখুন।'); return; }
        if (doc.data().active === false) { fail('এই মাদ্রাসার নিবন্ধন বর্তমানে বন্ধ আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।'); return; }
        switchMadrasa(code);
      })
      .catch(e => {
        console.error('[tenant-link] code check', e);
        fail('যাচাই করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
      });
  };

  // মাদ্রাসা নিশ্চিত না থাকলে "শিক্ষার্থী" চাপার পর আগে কোড চাওয়া হয়
  const prevPickRole = window.pickRole;
  window.pickRole = function (r) {
    if (r === 'student' && !confirmed()) { showCodeScreen(); return; }
    return prevPickRole.apply(this, arguments);
  };

  // ---------- ৩. শিক্ষার্থী লগইন পাতায় "কোড বদলান" ----------
  window.tenantChangeCode = showCodeScreen;
  const prevPicker = window.showStudentPicker;
  window.showStudentPicker = function () {
    const r = prevPicker.apply(this, arguments);
    const scr = document.getElementById('studentPickerScreen');
    if (scr && !document.getElementById('tenantChangeLink')) {
      scr.insertAdjacentHTML('beforeend', '<button id="tenantChangeLink" class="sl-link" onclick="tenantChangeCode()">ভুল মাদ্রাসা? কোড বদলান</button>');
    }
    return r;
  };

  // ---------- ৪. সুপার অ্যাডমিন প্যানেলে প্রতিটি মাদ্রাসার লিংক ----------
  // app.js-এর listenMadrasasList()-এর হুবহু কপি, শুধু প্রতিটি সারিতে লিংক ও
  // কপি/শেয়ার বাটন যোগ করা হয়েছে। firestore.rules বা ডেটা কাঠামোতে কোনো বদল নেই।
  const prevListenMadrasas = window.listenMadrasasList;
  if (typeof prevListenMadrasas === 'function' && typeof stopMadrasasListener === 'function') {
    window.listenMadrasasList = function () {
      stopMadrasasListener();
      madrasasUnsub = db.collection('madrasas').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const wrap = document.getElementById('madrasasListWrap');
        if (!wrap) return;
        if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো মাদ্রাসা পাওয়া যায়নি</p>'; return; }
        wrap.innerHTML = snap.docs.map(d => {
          const m = d.data();
          const isActiveM = m.active !== false;
          const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleDateString('bn-BD') : '-';
          const isCurrent = d.id === madrasaId;
          const name = m.madrasaName || d.id;
          const link = loginLinkFor(d.id);
          return `<div class="student-row" style="display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span>${esc(name)}${isCurrent ? ' <span class="muted">(আপনার বর্তমান)</span>' : ''}</span>
              <span class="badge ${isActiveM ? 'present' : 'absent'}">${isActiveM ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
            </div>
            <div class="muted" style="margin-top:2px;">নিবন্ধনের তারিখ: ${esc(dateStr)} &nbsp; আইডি: ${esc(d.id)}</div>
            <input readonly value="${esc(link)}" style="margin-top:6px;font-size:12px;" onclick="this.select()">
            <div style="margin-top:6px;">
              <button class="small ${isActiveM ? 'danger' : ''}" onclick="toggleMadrasaActive('${jsq(d.id)}', ${isActiveM})">${isActiveM ? 'নিবন্ধন বাতিল করুন' : 'পুনরায় সক্রিয় করুন'}</button>
              <button class="small secondary" onclick="tenantCopyLinkFor('${jsq(d.id)}')">লিংক কপি</button>
              <button class="small secondary" onclick="tenantShareLinkFor('${jsq(d.id)}','${jsq(name)}')">হোয়াটসঅ্যাপে পাঠান</button>
            </div>
          </div>`;
        }).join('');
      }, err => {
        const wrap = document.getElementById('madrasasListWrap');
        if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(err.message) + '</p>';
        if (typeof showDiagBanner === 'function') showDiagBanner('মাদ্রাসা তালিকা লোড এরর: ' + err.message);
      });
    };
  }
})();
