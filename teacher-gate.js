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
    return r;
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
