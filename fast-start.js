/* ShikkhaOS — fast-start.js (অ্যাপ দ্রুত খোলার জন্য)
 *
 * index.html এ firebase-config.js এর ঠিক নিচে, batch-chunk.js এর আগে লোড হয়:
 *   <script defer src="firebase-config.js"></script>
 *   <script defer src="fast-start.js"></script>
 *
 * app.js / firebase-config.js কিছুই বদলাতে হয় না। এই ফাইল:
 *  1) Firestore-এর অফলাইন ক্যাশ চালু করে: অ্যাপ খুললে শেষবারের ডেটা সাথে সাথে ফোন থেকে আসে।
 *  2) অ্যাপ খোলার সময় Firebase-এর লগইন-যাচাই শেষ হওয়ার অপেক্ষা করে না:
 *     - কোনো ভূমিকা বাছা না থাকলে "আপনি কে?" পাতা সাথে সাথে দেখায়
 *     - শিক্ষক আগে লগইন করা থাকলে শিক্ষকের হোম পাতা সাথে সাথে খোলে (শেষবারের ডেটাসহ)
 *     লগইন যাচাই পেছনে চলে; কিছু ভুল হলে (যেমন লগইন নেই) আগের মতোই লগইন পাতা আসে।
 *     নিরাপত্তা firestore.rules-এ সার্ভারেই জোর করা থাকে, তাই এতে কিছু বদলায় না।
 *  3) শিক্ষকের তথ্য ফোনের ক্যাশে থাকলে সার্ভারের অপেক্ষা ছাড়াই চলে।
 *  4) সিংক ডট: নেট না থাকলে লাল।
 *  5) "লোড হচ্ছে..." এর নিচে ছোট ধূসর লাইনে কোন ধাপে অপেক্ষা চলছে ও কত সেকেন্ড (index.html-এর bootStage)।
 * কোনো সমস্যা হলে আগের মতোই চলে। বন্ধ করতে index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
 */
(function () {
  'use strict';

  var stage = function (s) { try { if (window.bootStage) window.bootStage(s); } catch (e) { /* ignore */ } };

  // ---------- ১) অফলাইন ক্যাশ ----------
  try {
    if (typeof db !== 'undefined' && typeof db.enablePersistence === 'function') {
      db.enablePersistence({ synchronizeTabs: true }).catch(function (e) {
        console.warn('[fast-start] অফলাইন ক্যাশ চালু হয়নি:', e && e.code);
      });
    }
  } catch (e) {
    console.warn('[fast-start] অফলাইন ক্যাশ চালু হয়নি:', e);
  }

  // app.js এর ফাংশনগুলো সব স্ক্রিপ্ট লোড শেষ হলে পাওয়া যায়, তাই বাকি কাজ DOMContentLoaded-এ
  // (এই লিসেনার app.js এর লিসেনারের আগে চলে, তাই লগইন যাচাইয়ের আগেই বদলে যায়)।
  document.addEventListener('DOMContentLoaded', function () {
    stage('স্ক্রিপ্ট চালু, লগইন যাচাই হচ্ছে');
    try { auth.onAuthStateChanged(function () { stage('লগইন যাচাই শেষ'); }); } catch (e) { /* ignore */ }

    // শেষবার সফলভাবে যাচাই হওয়া শিক্ষকের তথ্য (আগাম পাতা খোলার জন্য)
    var saveTeacher = function (user) {
      try {
        localStorage.setItem('fsTeacher', JSON.stringify({
          uid: user.uid, email: user.email || '', madrasaId: madrasaId,
          isAdmin: !!myTeacherIsAdmin, pending: !!myTeacherPending
        }));
      } catch (e) { /* ignore */ }
    };

    // ---------- ২) শিক্ষকের তথ্য আগে ক্যাশ থেকে ----------
    try {
      var orig = window.ensureTeacherDoc;
      if (typeof orig === 'function') {
        window.ensureTeacherDoc = function (user) {
          var self = this;
          var done = function (r) { stage('পাতা সাজানো হচ্ছে'); return r; };
          var slow = function () {
            stage('শিক্ষকের তথ্য সার্ভার থেকে আসছে');
            return orig.call(self, user).then(function (r) { saveTeacher(user); return done(r); });
          };
          try {
            stage('শিক্ষকের তথ্য ফোনে খোঁজা হচ্ছে');
            return db.collection('teachers').doc(user.uid).get({ source: 'cache' }).then(function (doc) {
              var d = doc.exists ? doc.data() : null;
              if (!d || !d.madrasaId || d.pending === true || d.active === false) return slow();
              // আগের ফাংশনের একই কাজ, কিন্তু সার্ভারের উত্তরের অপেক্ষা ছাড়া
              isSuperAdminUser = (user.email === SUPER_ADMIN_EMAIL);
              madrasaId = d.madrasaId;
              localStorage.setItem('madrasaId', madrasaId);
              myTeacherIsAdmin = d.isAdmin === true;
              myTeacherPending = false;
              orig.call(self, user).then(function () { saveTeacher(user); }); // পেছনে সার্ভার থেকে হালনাগাদ
              return done();
            }, slow);
          } catch (e) {
            return slow();
          }
        };
      }
    } catch (e) {
      console.warn('[fast-start] দ্রুত লগইন চালু হয়নি:', e);
    }

    // ---------- ৩) সিংক ডট: নেট না থাকলে লাল ----------
    try {
      var oSync = window.setSync;
      if (typeof oSync === 'function') {
        window.setSync = function (ok) { return oSync.call(this, !!ok && navigator.onLine !== false); };
        window.addEventListener('offline', function () { window.setSync(false); });
        window.addEventListener('online', function () { window.setSync(true); });
      }
    } catch (e) {
      console.warn('[fast-start] সিংক ডট ঠিক করা যায়নি:', e);
    }

    // ---------- ৪) লগইন-যাচাইয়ের অপেক্ষা ছাড়াই প্রথম পাতা ----------
    try {
      var oShow = window.showTeacherApp;
      var navVisible = function () {
        var n = document.getElementById('bottomNav');
        return !!(n && n.style.display !== 'none');
      };
      var r0 = localStorage.getItem('role');
      var ft = null;
      try { ft = JSON.parse(localStorage.getItem('fsTeacher') || 'null'); } catch (e) { ft = null; }

      if (!r0 && typeof window.showRoleSelect === 'function') {
        window.showRoleSelect(); // "আপনি কে?" পাতা (এতে ডেটা লাগে না)
      } else if (r0 === 'teacher' && ft && ft.madrasaId && !ft.pending &&
                 typeof oShow === 'function' && typeof listenStudents === 'function') {
        window.__fsOptimistic = true;
        isSuperAdminUser = (ft.email === SUPER_ADMIN_EMAIL);
        madrasaId = ft.madrasaId;
        localStorage.setItem('madrasaId', madrasaId);
        myTeacherIsAdmin = !!ft.isAdmin;
        myTeacherPending = false;
        listenStudents(); listenSettings(); listenStudentContacts();
        oShow.call(window);
      }

      // লগইন যাচাই শেষে app.js আবার showTeacherApp() ডাকে: পাতা যদি ইতিমধ্যে খোলা থাকে, তাহলে আর
      // হোমে ফিরিয়ে না নিয়ে ব্যবহারকারী যেখানে আছেন সেখানেই থাকতে দেওয়া হয়।
      if (typeof oShow === 'function') {
        window.showTeacherApp = function () {
          if (window.__fsOptimistic && navVisible()) { window.__fsOptimistic = false; return; }
          window.__fsOptimistic = false;
          return oShow.apply(this, arguments);
        };
      }
    } catch (e) {
      console.warn('[fast-start] আগাম পাতা খোলা যায়নি:', e);
    }

    // লগআউট করলে আগাম-খোলার তথ্য মুছে যায়
    try {
      var oLogout = window.logout;
      if (typeof oLogout === 'function') {
        window.logout = function () {
          window.__fsOptimistic = false;
          try { localStorage.removeItem('fsTeacher'); } catch (e) { /* ignore */ }
          return oLogout.apply(this, arguments);
        };
      }
    } catch (e) { /* ignore */ }
  });
})();
