/* ShikkhaOS — শিক্ষক প্রবেশ নিয়ন্ত্রণ (teacher-gate.js)
 *
 * লক্ষ্য: মাদ্রাসার অ্যাডমিন যুক্ত না করলে কেউ (জিমেইল/ইমেইল যা-ই হোক) শিক্ষক হিসেবে অ্যাপে ঢুকতে পারবে না।
 * শিক্ষক অ্যাকাউন্ট এখন শুধু অ্যাডমিন বানান (শিক্ষকগণ ট্যাব → ইমেইল + পাসওয়ার্ড)।
 *
 * ডেটার নিরাপত্তা firestore.rules দিয়ে সার্ভারে জোর করা আছে (teacher ডক ছাড়া কোনো ডেটা পড়া/লেখা যায় না)।
 * কিন্তু আগে অ্যাপের পর্দায় এমন অ্যাকাউন্টও শিক্ষকের স্ক্রিন পেত, কারণ:
 *   (১) ensureTeacherDoc() teacher ডক না পেলে নিজেই একটা বানানোর চেষ্টা করত
 *   (২) যেকোনো লগইন করা অ্যাকাউন্টকেই (providerData.length > 0) "শিক্ষক" ধরা হতো
 * এই ফাইল সেই দুটি পথ বন্ধ করে: ডক না থাকলে বা নিষ্ক্রিয় হলে সাথে সাথে সাইন-আউট করে
 * কারণসহ লগইন পাতায় ফেরত পাঠায়। সাথে "কোড দিয়ে যোগদান" অপশনটাও বন্ধ করে।
 *
 * সাথে যোগ হয়েছে: লগইন পাতায় "পাসওয়ার্ড ভুলে গেছেন?" (ইমেইলে রিসেট লিংক) আর "আরও" মেনুর "পাসওয়ার্ড" ট্যাব
 * (লগইন করা শিক্ষক নিজে বর্তমান পাসওয়ার্ড দিয়ে যাচাই করে নতুন পাসওয়ার্ড বসান)।
 *
 * index.html এ সবার শেষে (teacher-attendance.js এর পরে) লোড করুন:
 *   <script defer src="teacher-gate.js"></script>
 * app.js বা অন্য কোনো ফাইল বদলাতে হয় না।
 */
(function () {
  'use strict';

  if (typeof ensureTeacherDoc !== 'function' || typeof showTeacherApp !== 'function' ||
      typeof showTeacherLogin !== 'function' || typeof db === 'undefined') {
    console.error('[teacher-gate] app.js এর আগে লোড হয়েছে। index.html এ এই লাইনটি সবার শেষে রাখুন।');
    return;
  }

  const MSG_NO_DOC = 'এই ইমেইলটি কোনো মাদ্রাসায় শিক্ষক হিসেবে যুক্ত নেই। মাদ্রাসার অ্যাডমিনকে "শিক্ষকগণ" ট্যাব থেকে আপনাকে যুক্ত করতে বলুন।';
  const MSG_INACTIVE = 'আপনার শিক্ষক অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। মাদ্রাসার অ্যাডমিনের সাথে যোগাযোগ করুন।';
  const MSG_PROVIDER = 'এই ধরনের অ্যাকাউন্ট দিয়ে শিক্ষক লগইন করা যাবে না। অ্যাডমিনের দেওয়া ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।';

  let gateBlocked = false; // এই লগইনে প্রবেশ আটকানো হয়েছে কি না
  let gateMsg = '';        // লগইন পাতায় দেখানোর কারণ

  function block(msg) {
    gateBlocked = true;
    gateMsg = msg;
    myTeacherIsAdmin = false;
    myTeacherPending = false;
    isSuperAdminUser = false;
  }

  // আগের ensureTeacherDoc (অন্য কোনো ফাইল বদলে থাকলে সেটিও) অক্ষত রেখে তার আগে একটি যাচাই বসানো হয়।
  // যাচাইয়ে পাস না করলে আগেরটি আর চালানোই হয় না, তাই teacher ডক নিজে বানানোর চেষ্টাও হয় না।
  // এতে লগইনের সময় teacher ডক একবার বাড়তি পড়া হয় (১টি read)।
  const prevEnsureTeacherDoc = window.ensureTeacherDoc;
  window.ensureTeacherDoc = function (user) {
    gateBlocked = false;

    // শিক্ষক হতে হলে অবশ্যই ইমেইল/পাসওয়ার্ড অ্যাকাউন্ট (rules-এও একই শর্ত)
    const viaPassword = (user.providerData || []).some(p => p.providerId === 'password');
    if (!viaPassword) {
      isSuperAdminUser = false;
      block(MSG_PROVIDER);
      return Promise.resolve();
    }

    return db.collection('teachers').doc(user.uid).get().then(doc => {
      const t = doc.exists ? (doc.data() || {}) : null;
      if (!t || !t.madrasaId) { block(MSG_NO_DOC); return; }
      if (t.active === false) { block(MSG_INACTIVE); return; }
      return prevEnsureTeacherDoc(user);
    }, err => {
      // নেটওয়ার্ক সমস্যায় প্রবেশ আটকানো হয় না (নিজের teacher ডক পড়া rules-এ সবসময় অনুমোদিত,
      // তাই এটা শুধু নেটওয়ার্কের সমস্যা); ডেটা তবুও rules দিয়ে সার্ভারে সুরক্ষিত।
      console.error('[teacher-gate] teacher ডক পড়া ব্যর্থ:', err);
      return prevEnsureTeacherDoc(user);
    });
  };

  // আটকানো হলে অকারণ মাইগ্রেশন চালানো হয় না
  ['runMigrationIfNeeded', 'migratePinsIfNeeded', 'migrateContactsIfNeeded'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      return gateBlocked ? Promise.resolve() : orig.apply(this, arguments);
    };
  });

  function rejectTeacher() {
    const msg = gateMsg;
    gateBlocked = false;
    window.logout(); // শ্রোতা বন্ধ + সাইন-আউট
    gateMsg = msg;
    role = 'teacher';
    localStorage.setItem('role', 'teacher');
    window.showTeacherLogin();
  }

  const prevShowTeacherApp = window.showTeacherApp; // সবার শেষে লোড হওয়ায় এটাই সর্বশেষ সংস্করণ
  window.showTeacherApp = function () {
    if (gateBlocked) { rejectTeacher(); return; }
    gateMsg = '';
    return prevShowTeacherApp.apply(this, arguments);
  };

  const prevShowTeacherLogin = window.showTeacherLogin;
  window.showTeacherLogin = function () {
    const r = prevShowTeacherLogin.apply(this, arguments);
    const e = document.getElementById('loginError');
    if (e && gateMsg) e.textContent = gateMsg;
    addForgotLink();
    return r;
  };

  // ================= পাসওয়ার্ড: ভুলে গেলে রিসেট + লগইনের পর পরিবর্তন =================
  function addForgotLink() {
    const pw = document.getElementById('loginPassword');
    if (!pw || document.getElementById('tgForgot')) return;
    pw.insertAdjacentHTML('afterend',
      '<p style="text-align:right;margin:4px 0 0;"><a href="#" id="tgForgot" onclick="tgForgotPassword();return false;">পাসওয়ার্ড ভুলে গেছেন?</a></p>');
  }

  window.tgForgotPassword = function () {
    const emailEl = document.getElementById('loginEmail');
    const errEl = document.getElementById('loginError');
    const email = emailEl ? emailEl.value.trim() : '';
    const say = (m, ok) => { if (errEl) { errEl.textContent = m; errEl.style.color = ok ? '#15803d' : '#dc2626'; } };
    if (!email) { say('আগে উপরের ঘরে আপনার ইমেইল লিখুন, তারপর "পাসওয়ার্ড ভুলে গেছেন?" চাপুন'); return; }
    auth.sendPasswordResetEmail(email)
      .then(() => say('এই ইমেইলে অ্যাকাউন্ট থাকলে পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে। ইমেইলের Inbox ও Spam ফোল্ডার দেখুন, লিংকে চাপ দিয়ে নতুন পাসওয়ার্ড দিন।', true))
      .catch(err => {
        say(err.code === 'auth/invalid-email' ? 'ইমেইলটি সঠিক নয়'
          : err.code === 'auth/too-many-requests' ? 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন'
          : 'লিংক পাঠানো যায়নি: ' + err.message);
      });
  };

  // লগইনের ভুল বার্তা সবসময় লাল (রিসেটের সবুজ বার্তার পর রং আটকে না থাকে)
  const prevTeacherLogin = window.teacherLogin;
  if (typeof prevTeacherLogin === 'function') {
    window.teacherLogin = function () {
      const e = document.getElementById('loginError');
      if (e) e.style.color = '#dc2626';
      return prevTeacherLogin.apply(this, arguments);
    };
  }

  // "আরও" মেনুতে "পাসওয়ার্ড" ট্যাব (সব শিক্ষকের জন্য)
  if (!teacherMoreTabs.some(t => t.key === 'password')) {
    teacherMoreTabs.push({ key: 'password', label: 'পাসওয়ার্ড', icon: '\u{1F511}' });
  }

  function renderPasswordScreen() {
    const u = auth.currentUser;
    setScreen(`
      <div class="card">
        <h2>পাসওয়ার্ড পরিবর্তন</h2>
        <p class="muted">${u && u.email ? 'অ্যাকাউন্ট: ' + String(u.email).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : ''}</p>
        <label>বর্তমান পাসওয়ার্ড</label><input id="tgOldPw" type="password" autocomplete="current-password">
        <label>নতুন পাসওয়ার্ড</label><input id="tgNewPw" type="password" placeholder="কমপক্ষে ৬ অক্ষর" autocomplete="new-password">
        <label>নতুন পাসওয়ার্ড আবার লিখুন</label><input id="tgNewPw2" type="password" autocomplete="new-password">
        <p id="tgPwMsg" class="muted" style="color:#dc2626;"></p>
        <button onclick="tgChangePassword()">পাসওয়ার্ড বদলান</button>
      </div>
    `);
  }

  window.tgChangePassword = function () {
    const u = auth.currentUser;
    const msg = document.getElementById('tgPwMsg');
    const say = (m, ok) => { if (msg) { msg.textContent = m; msg.style.color = ok ? '#15803d' : '#dc2626'; } };
    const oldPw = document.getElementById('tgOldPw').value;
    const newPw = document.getElementById('tgNewPw').value;
    const newPw2 = document.getElementById('tgNewPw2').value;
    if (!u || !u.email) { say('আবার লগইন করুন'); return; }
    if (!oldPw || !newPw) { say('বর্তমান ও নতুন পাসওয়ার্ড দিন'); return; }
    if (newPw.length < 6) { say('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); return; }
    if (newPw !== newPw2) { say('নতুন পাসওয়ার্ড দুই ঘরে এক হয়নি'); return; }
    if (newPw === oldPw) { say('নতুন পাসওয়ার্ড বর্তমানটির থেকে আলাদা হতে হবে'); return; }
    const btn = event && event.target;
    if (btn) { btn.disabled = true; btn.textContent = 'বদলানো হচ্ছে...'; }
    const cred = firebase.auth.EmailAuthProvider.credential(u.email, oldPw);
    u.reauthenticateWithCredential(cred)
      .then(() => u.updatePassword(newPw))
      .then(() => {
        say('পাসওয়ার্ড বদলানো হয়েছে। এখন থেকে নতুন পাসওয়ার্ড দিয়ে লগইন করবেন।', true);
        ['tgOldPw', 'tgNewPw', 'tgNewPw2'].forEach(id => { const x = document.getElementById(id); if (x) x.value = ''; });
      })
      .catch(err => {
        say(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' ? 'বর্তমান পাসওয়ার্ড সঠিক নয়'
          : err.code === 'auth/weak-password' ? 'নতুন পাসওয়ার্ড দুর্বল, আরেকটু শক্তিশালী দিন'
          : err.code === 'auth/too-many-requests' ? 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন'
          : err.code === 'auth/requires-recent-login' ? 'নিরাপত্তার জন্য লগ-আউট করে আবার লগইন করে চেষ্টা করুন'
          : 'বদলানো যায়নি: ' + err.message);
      })
      .then(() => { if (btn) { btn.disabled = false; btn.textContent = 'পাসওয়ার্ড বদলান'; } });
  };

  const prevTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    if (tab === 'password') {
      if (typeof window.stopTeacherDashboard === 'function') window.stopTeacherDashboard();
      renderTeacherNav('password');
      renderPasswordScreen();
      return;
    }
    return prevTeacherTab.apply(this, arguments);
  };

  // ================= কোড দিয়ে যোগদান বন্ধ =================
  // নিবন্ধন পাতায় শুধু "নতুন মাদ্রাসা" থাকে, আর সেটিংসে মাদ্রাসা কোডের কার্ড লুকানো হয়।
  const prevShowSignupScreen = window.showSignupScreen;
  if (typeof prevShowSignupScreen === 'function') {
    window.showSignupScreen = function () {
      const r = prevShowSignupScreen.apply(this, arguments);
      const b = document.getElementById('signupModeNewBtn');
      if (b && b.parentNode) b.parentNode.style.display = 'none';
      return r;
    };
  }
  const prevSetSignupMode = window.setSignupMode;
  if (typeof prevSetSignupMode === 'function') {
    window.setSignupMode = function () { return prevSetSignupMode.call(this, 'new'); };
  }
  window.submitJoinMadrasa = function () {
    alert('কোড দিয়ে যোগদান বন্ধ আছে। মাদ্রাসার অ্যাডমিনকে বলুন আপনার জন্য শিক্ষক অ্যাকাউন্ট তৈরি করে দিতে।');
  };
  const prevRenderSettings = window.renderSettingsScreen;
  if (typeof prevRenderSettings === 'function') {
    window.renderSettingsScreen = function () {
      const r = prevRenderSettings.apply(this, arguments);
      const code = document.getElementById('madrasaCodeDisplay');
      const card = code && code.closest ? code.closest('.card') : null;
      if (card) card.remove();
      return r;
    };
  }

  // "ফিরে যান" চাপলে বার্তা মুছে যায়
  const prevShowRoleSelect = window.showRoleSelect;
  if (typeof prevShowRoleSelect === 'function') {
    window.showRoleSelect = function () {
      gateMsg = '';
      return prevShowRoleSelect.apply(this, arguments);
    };
  }
})();
