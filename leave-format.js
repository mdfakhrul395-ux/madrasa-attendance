/* ShikkhaOS — ছুটির আবেদনের লেখা প্রচলিত দরখাস্তের ফরম্যাটে দেখানো
 * app.js / dashboard.js / style.css কিছুই বদলাতে হয় না।
 * index.html এ dashboard.js এর নিচে যোগ করুন:
 *   <script src="leave-format.js"></script>
 *
 * ১) আবেদনে যেভাবে লাইন ভেঙে লেখা হয়, ঠিক সেভাবেই দেখায় (শিক্ষক ও শিক্ষার্থী দুই পাশেই)
 * ২) শিক্ষার্থী আবেদন লিখতে গেলে ঘরে দরখাস্তের কাঠামো আগে থেকেই বসানো থাকে
 * ৩) "……" চিহ্নিত ফাঁকা জায়গা পূরণ না করলে জমা দেওয়া যায় না
 */
(function () {
  'use strict';

  if (!document.getElementById('leaveFormatStyles')) {
    const st = document.createElement('style');
    st.id = 'leaveFormatStyles';
    st.textContent =
      '#leavesWrap .student-row > div:nth-child(3){white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;margin-top:6px;}' +
      '.dash-leave-reason{white-space:pre-line;}' +
      '#leaveReason{line-height:1.6;}';
    document.head.appendChild(st);
  }

  const BLANK = '……';

  function template() {
    const me = (typeof studentsCache !== 'undefined' && typeof myStudentId !== 'undefined')
      ? studentsCache.find(s => s.id === myStudentId) : null;
    const inst = (typeof appSettings !== 'undefined' && appSettings && appSettings.madrasaName) ? appSettings.madrasaName : 'মাদ্রাসা';
    const cls = me && me.className ? me.className : BLANK;
    const name = me && me.name ? me.name : BLANK;
    const roll = me && me.roll ? toBanglaNumeral(me.roll) : BLANK;
    return 'বরাবর,\nশ্রেণি শিক্ষক\n' + inst + '\n\n'
      + 'বিষয়: ছুটির আবেদন\n\n'
      + 'জনাব,\n'
      + 'সবিনয় নিবেদন এই যে, আমি আপনার মাদ্রাসার ' + cls + ' শ্রেণির একজন শিক্ষার্থী। '
      + BLANK + ' কারণে ' + BLANK + ' তারিখ থেকে ' + BLANK + ' তারিখ পর্যন্ত মাদ্রাসায় উপস্থিত হতে পারিনি। '
      + 'অতএব, উক্ত দিনগুলো ছুটি হিসেবে মঞ্জুর করে বাধিত করবেন।\n\n'
      + 'নিবেদক\n' + name + '\nশ্রেণি: ' + cls + '\nরোল: ' + roll;
  }

  function fillTemplate() {
    const ta = document.getElementById('leaveReason');
    if (!ta || ta.value.trim()) return;
    ta.rows = 14;
    ta.value = template();
  }

  const origRender = window.renderLeavesScreen;
  if (typeof origRender === 'function') {
    window.renderLeavesScreen = function (isTeacher) {
      const r = origRender.apply(this, arguments);
      if (!isTeacher) fillTemplate();
      return r;
    };
  }

  const origSubmit = window.submitLeave;
  if (typeof origSubmit === 'function') {
    window.submitLeave = function () {
      const ta = document.getElementById('leaveReason');
      if (ta && ta.value.indexOf(BLANK) > -1) {
        alert('আবেদনের "' + BLANK + '" চিহ্নিত ফাঁকা জায়গাগুলো পূরণ করুন (কারণ ও তারিখ লিখুন)।');
        return;
      }
      const r = origSubmit.apply(this, arguments);
      // জমা দেওয়ার পর ঘর খালি হয়ে যায়, তাই আবার কাঠামো বসানো
      setTimeout(fillTemplate, 600);
      return r;
    };
  }
})();
