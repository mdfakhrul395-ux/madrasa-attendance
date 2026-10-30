/* ShikkhaOS — fast-start.js (অ্যাপ দ্রুত খোলার জন্য)
 *
 * index.html এ firebase-config.js এর ঠিক নিচে, batch-chunk.js এর আগে লোড হয়:
 *   <script defer src="firebase-config.js"></script>
 *   <script defer src="fast-start.js"></script>
 *
 * app.js / firebase-config.js কিছুই বদলাতে হয় না। এই ফাইল:
 *  1) Firestore-এর অফলাইন ক্যাশ চালু করে: অ্যাপ খুললে শেষবারের ডেটা সাথে সাথে ফোন থেকে আসে,
 *     নতুন ডেটা পেছনে এসে বদলে দেয় (নেট ধীর হলে আর "লোড হচ্ছে..." এ আটকে থাকে না)
 *  2) শিক্ষকের লগইন যাচাই: শিক্ষকের তথ্য ফোনের ক্যাশে থাকলে সাথে সাথে পাতা খোলে, সার্ভারের যাচাই পেছনে চলে।
 *     ক্যাশে না থাকলে, বা শিক্ষক "অনুমোদনের অপেক্ষায়" বা নিষ্ক্রিয় হলে আগের মতোই সার্ভার থেকে যাচাই হয়।
 *     নিরাপত্তা firestore.rules-এ সার্ভারেই জোর করা থাকে, তাই এতে কিছু বদলায় না।
 *  3) সিংক ডট (শিক্ষকের নামের পাশের ফোঁটা): ফোন-ক্যাশ চালু থাকলে অফলাইনেও ডেটা আসে, তাই ডটটি ভুলে সবুজ দেখাত।
 *     এখন নেট না থাকলে লাল দেখায়।
 * কোনো সমস্যা হলে আগের মতোই চলে। বন্ধ করতে index.html থেকে এই ফাইলের লাইনটি মুছে দিন।
 */
(function () {
  'use strict';

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

  // ---------- ২) শিক্ষকের তথ্য আগে ক্যাশ থেকে ----------
  // app.js এর ফাংশনগুলো সব স্ক্রিপ্ট লোড শেষ হলে পাওয়া যায়, তাই DOMContentLoaded-এ বসানো হয়
  // (এই লিসেনার app.js এর লিসেনারের আগে চলে, তাই লগইন যাচাইয়ের আগেই বদলে যায়)।
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var orig = window.ensureTeacherDoc;
      if (typeof orig !== 'function') return;

      window.ensureTeacherDoc = function (user) {
        var self = this;
        var slow = function () { return orig.call(self, user); };
        try {
          return db.collection('teachers').doc(user.uid).get({ source: 'cache' }).then(function (doc) {
            var d = doc.exists ? doc.data() : null;
            if (!d || !d.madrasaId || d.pending === true || d.active === false) return slow();
            // আগের ফাংশনের একই কাজ, কিন্তু সার্ভারের উত্তরের অপেক্ষা ছাড়া
            isSuperAdminUser = (user.email === SUPER_ADMIN_EMAIL);
            madrasaId = d.madrasaId;
            localStorage.setItem('madrasaId', madrasaId);
            myTeacherIsAdmin = d.isAdmin === true;
            myTeacherPending = false;
            slow(); // পেছনে সার্ভার থেকে হালনাগাদ (অ্যাডমিন অধিকার ইত্যাদি বদলালে ঠিক হয়ে যায়)
          }, slow);
        } catch (e) {
          return slow();
        }
      };
    } catch (e) {
      console.warn('[fast-start] দ্রুত লগইন চালু হয়নি:', e);
    }
  });
  // ---------- ৩) সিংক ডট: নেট না থাকলে লাল ----------
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var oSync = window.setSync;
      if (typeof oSync !== 'function') return;
      window.setSync = function (ok) { return oSync.call(this, !!ok && navigator.onLine !== false); };
      window.addEventListener('offline', function () { window.setSync(false); });
      window.addEventListener('online', function () { window.setSync(true); });
    } catch (e) {
      console.warn('[fast-start] সিংক ডট ঠিক করা যায়নি:', e);
    }
  });
})();
