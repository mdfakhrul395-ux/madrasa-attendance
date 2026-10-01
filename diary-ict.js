/* ShikkhaOS — ডায়েরিতে "আইসিটি" বিষয় যোগ
 *
 * index.html এ app.js ও dashboard.js এর নিচে লোড হয়:
 *   <script src="diary-ict.js"></script>
 *
 * app.js বা dashboard.js একটুও বদলাতে হয় না।
 * আগের ডায়েরি এন্ট্রি আগের মতোই থাকে (বিষয় নাম ধরে জমা হয়)।
 */
(function () {
  'use strict';
  if (typeof DIARY_SUBJECT_GROUPS === 'undefined' || typeof DIARY_SUBJECTS === 'undefined') {
    console.error('[diary-ict] app.js এর নিচে এই ফাইল লোড করুন।');
    return;
  }
  var NAME = 'আইসিটি';
  if (DIARY_SUBJECTS.indexOf(NAME) > -1) return; // আগে থেকেই আছে
  DIARY_SUBJECT_GROUPS.push({ subjects: [NAME] });
  DIARY_SUBJECTS.push(NAME);
})();
