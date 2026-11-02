/* ShikkhaOS — শিক্ষক লগইন করা ডিভাইসেও শিক্ষার্থী পাতায় প্রবেশের অনুমতি
 *
 * dashboard.js সাধারণ শিক্ষকের ডিভাইসে একটি চিহ্ন (nonAdminTeacherDevice) রেখে
 * "শিক্ষার্থী" বাটন বন্ধ করে দিত। এই ফাইলটি সেই চিহ্ন সরিয়ে দেয়, তাই
 * যেকোনো শিক্ষক লগইন করলেও শিক্ষার্থী বাটন চালু থাকে।
 *
 * index.html এ এই ফাইলটি সবার শেষে লোড করুন (final-result.js ইত্যাদির পরে)।
 */
(function () {
  'use strict';
  var KEY = 'nonAdminTeacherDevice';
  function unlock() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  unlock(); // আগে যে ফোনে চিহ্ন বসে গেছে, সেখান থেকে সরানো

  // শিক্ষক লগইনের পর dashboard.js নতুন করে চিহ্ন বসায় — সঙ্গে সঙ্গে সরিয়ে দেওয়া
  var orig = window.showTeacherApp;
  if (typeof orig === 'function') {
    window.showTeacherApp = function () {
      var r = orig.apply(this, arguments);
      unlock();
      return r;
    };
  }
})();
