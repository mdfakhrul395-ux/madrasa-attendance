/* ShikkhaOS — desktop.js (ধাপ ১-৩: সাইডবার, ড্যাশবোর্ড গ্রিড, তালিকা দুই কলামে, ফর্ম/টেবিল, প্রিন্ট)
 *
 * index.html এ সবার শেষে (demo.js এর নিচে) লোড হয়:
 *   <script defer src="desktop.js"></script>
 *
 * ৯৬০px বা তার চেয়ে চওড়া স্ক্রিনে কাজ করে: কম্পিউটারে, অথবা ফোনে "Desktop site" চালু করলে। সাধারণ মোবাইল ভিউতে ডিজাইন একটুও বদলায় না।
 * app.js, dashboard.js, icons.js, ui-polish.js কিছুই বদলাতে হয় না।
 *   1) নিচের নেভিগেশন বার বাঁ পাশের সাইডবার হয়ে যায় (প্রাথমিক ট্যাব + "আরও" মেনুর সব গ্রুপ একসাথে)
 *   2) উপরের হেডার বাঁ-সারিবদ্ধ হয়, হোম/লগআউট আইকন ডান পাশে যায়
 *   3) কনটেন্ট বড় স্ক্রিনে চওড়া হয়, কার্ড ও বাটন ডেস্কটপের মাপে সাজে
 * কোনো সমস্যা হলে আগের ডিজাইনই থাকে।
 */
(function () {
  'use strict';
  try {
    // ফোনের লক নেই: ফোনে Chrome-এর "Desktop site" চালু করলে (পর্দা প্রায় ৯৮০px চওড়া ধরা হয়) ডেস্কটপ চেহারা দেখা যায়।
    // সাধারণ মোবাইল ভিউতে (আড়াআড়ি ধরলেও, ৯৬০px-এর কম) ফোনের ডিজাইন একটুও বদলায় না।
    var MQ = '(min-width:960px)';
    var MQP = 'print and (min-width:960px)';
    var nav = document.getElementById('bottomNav');
    if (!nav) return;

    // ডেস্কটপের চেহারা শুধু তখনই চালু, যখন লগইনের পরে নেভ দেখা যাচ্ছে
    var sync = function () {
      var on = nav.style.display !== 'none' && nav.innerHTML.trim() !== '';
      document.body.classList.toggle('ds-on', on);
    };
    new MutationObserver(sync).observe(nav, { attributes: true, attributeFilter: ['style'], childList: true });
    sync();

    var CAP = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 9.5 12 5l9.5 4.5L12 14z'/%3E%3Cpath d='M6.5 11.8V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2'/%3E%3Cpath d='M21.5 9.5V15'/%3E%3C/svg%3E\")";

    // যেসব তালিকা ডেস্কটপে দুই কলামে সাজবে (app.js ও fees-quick.js-এর আসল আইডি অনুযায়ী)
    var LISTS = ['#studentsListWrap', '#resultsWrap', '#leavesWrap', '#noticesWrap', '#suggestionsWrap', '#diaryWrap',
      '#tlWrap', '#teachersListWrap', '#madrasasListWrap', '#attList', '#fqList'];
    var gridSel = LISTS.map(function (x) { return 'body.ds-on ' + x; }).join(',');
    var spanSel = LISTS.map(function (x) { return 'body.ds-on ' + x + ' > :not(.student-row):not(.card):not(.fq-row)'; }).join(',');

    var CSS = '@media ' + MQ + '{' +

      /* ---------- পুরো পাতা ---------- */
      'body.ds-on{padding:0 0 32px 268px;background:#eef3f5}' +
      'body.ds-on .screen{max-width:1120px;padding:30px 36px}' +

      /* ---------- উপরের হেডার ---------- */
      'body.ds-on header{text-align:left;display:flex;align-items:center;height:60px;box-sizing:border-box;padding:0 32px;font-size:19px;letter-spacing:.2px;background:#0f766e;box-shadow:0 2px 14px rgba(15,23,42,.12)}' +
      'body.ds-on header > span:first-child{left:auto!important;right:24px;top:50%;transform:translateY(-50%);padding:5px;border-radius:10px;line-height:0;transition:background .15s}' +
      'body.ds-on header > span:first-child:hover{background:rgba(255,255,255,.18)}' +

      /* ---------- বাঁ পাশের সাইডবার ---------- */
      'body.ds-on nav.tabs{position:fixed;top:0;bottom:0;left:0;right:auto;width:268px;max-width:none;margin:0;padding:0 14px 28px;overflow-y:auto;background:linear-gradient(180deg,#06312e 0%,#0b5a53 55%,#0f766e 100%);box-shadow:4px 0 24px rgba(15,23,42,.18);z-index:40}' +
      'body.ds-on nav.tabs::before{content:"ShikkhaOS";display:block;margin:0 -14px 10px;padding:24px 20px 22px 68px;font-size:21px;font-weight:700;letter-spacing:.3px;color:#fff;background:' + CAP + ' no-repeat 26px center/28px;border-bottom:1px solid rgba(255,255,255,.12)}' +
      'body.ds-on nav.tabs::-webkit-scrollbar{width:6px}' +
      'body.ds-on nav.tabs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:3px}' +

      /* প্রাথমিক ট্যাব: সারি আকারে */
      'body.ds-on nav.tabs .tabs-primary{display:flex;flex-direction:column;gap:3px;background:transparent;border:0;box-shadow:none;border-radius:0;padding:4px 0}' +
      'body.ds-on nav.tabs .tabs-primary .tab-btn{flex:none;flex-direction:row;justify-content:flex-start;align-items:center;gap:12px;width:100%;margin:0;padding:7px 10px;border-radius:14px;font-size:14.5px;font-weight:600;text-align:left;color:rgba(255,255,255,.86);transition:background .15s}' +
      'body.ds-on nav.tabs .tabs-primary .tab-btn:last-child{display:none}' + /* "আরও" বোতাম লাগে না, সব মেনু নিচেই দেখা যায় */
      'body.ds-on nav.tabs .tabs-primary .tab-btn:hover{background:rgba(255,255,255,.1)}' +
      'body.ds-on nav.tabs .tabs-primary .tab-btn.active{background:rgba(255,255,255,.18);color:#fff;font-weight:700;box-shadow:inset 3px 0 0 #5eead4}' +
      'body.ds-on nav.tabs .tabs-primary .tab-btn .tab-icon,body.ds-on nav.tabs .tabs-primary .tab-btn .tab-icon[data-svg]{width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,.14)!important;color:#fff!important}' +
      'body.ds-on nav.tabs .tabs-primary .tab-btn.active .tab-icon,body.ds-on nav.tabs .tabs-primary .tab-btn.active .tab-icon[data-svg]{background:#fff!important;color:#0f766e!important}' +

      /* "আরও" মেনু: সাইডবারের ভেতরে সবসময় খোলা, গ্রুপ অনুযায়ী */
      'body.ds-on nav.tabs .more-sheet-backdrop{display:none!important}' +
      'body.ds-on nav.tabs .more-sheet{display:block!important;position:static;max-width:none;max-height:none;overflow:visible;margin:0;padding:0;background:transparent;box-shadow:none;border-radius:0}' +
      'body.ds-on nav.tabs .more-sheet:before,body.ds-on nav.tabs .more-sheet .more-title,body.ds-on nav.tabs .more-sheet .more-gh:before,body.ds-on nav.tabs .more-sheet .more-wm{display:none!important}' +
      'body.ds-on nav.tabs .more-sheet .more-gh{margin:18px 10px 6px;font-size:12px;font-weight:700;letter-spacing:.6px;color:rgba(255,255,255,.55)}' +
      'body.ds-on nav.tabs .more-sheet .more-grid{display:flex;flex-direction:column;gap:3px}' +
      'body.ds-on nav.tabs .more-sheet .more-grid .more-item{flex-direction:row;align-items:center;justify-content:flex-start;gap:12px;min-height:0;padding:7px 10px;border-radius:14px;font-size:14.5px;font-weight:600;overflow:visible;color:rgba(255,255,255,.86)!important;background:transparent!important;border:0!important;box-shadow:none!important;cursor:pointer}' +
      'body.ds-on nav.tabs .more-sheet .more-grid .more-item:hover{background:rgba(255,255,255,.1)!important}' +
      'body.ds-on nav.tabs .more-sheet .more-grid .more-item.active{background:rgba(255,255,255,.18)!important;color:#fff!important;font-weight:700;box-shadow:inset 3px 0 0 #5eead4!important}' +
      'body.ds-on nav.tabs .more-sheet .more-grid .more-item .more-ib{width:36px;height:36px;border-radius:11px}' +
      'body.ds-on nav.tabs .more-sheet .more-grid .more-item .nbadge{position:static;margin-left:auto}' +

      /* ---------- কার্ড, বাটন, তালিকা ---------- */
      'body.ds-on .card{border-radius:16px;padding:20px 22px;border:1px solid #e8eef2;box-shadow:0 2px 12px rgba(15,23,42,.06)}' +
      'body.ds-on h2{font-size:18px}' +
      'body.ds-on .card > button:not(.small){width:auto;min-width:220px;padding:11px 30px}' +
      'body.ds-on button:not(.tab-btn){transition:filter .15s,transform .15s}' +
      'body.ds-on button:not(.tab-btn):hover{filter:brightness(1.08)}' +
      'body.ds-on .student-row{padding:11px 8px;border-radius:8px;transition:background .15s}' +
      'body.ds-on .student-row:hover{background:#f4f9fa}' +
      'body.ds-on .dash .dash-actions .dash-act{cursor:pointer}' +
      'body.ds-on .dash .dash-actions .dash-act:hover .dash-act-ic{transform:translateY(-4px)}' +
      /* ---------- ড্যাশবোর্ড (শিক্ষক ও শিক্ষার্থী): ১২ কলামের গ্রিড ---------- */
      'body.ds-on .dash{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px;align-items:start;padding-bottom:0}' +
      'body.ds-on .dash > *{margin:0!important}' +
      'body.ds-on .dash > .dash-hero{grid-column:1 / 8;grid-row:1 / 3;align-self:stretch;display:flex;flex-direction:column;justify-content:space-between}' +
      'body.ds-on .dash > .dash-strip{grid-column:8 / 13;grid-row:1;grid-template-columns:repeat(2,1fr)}' +
      'body.ds-on .dash > .dash-strip .dash-cell:nth-child(n+3){border-top:1px solid #e6ebef}' +
      'body.ds-on .dash > .dash-strip .dash-cell:nth-child(3){border-left:0}' +
      'body.ds-on .dash > .dash-actions{grid-column:8 / 13;grid-row:2;align-self:stretch;align-items:center;padding:18px 10px;background:#fff;border-radius:18px;box-shadow:0 0 0 1px #e6ebef}' +
      'body.ds-on .dash > .dash-sec{grid-column:span 6}' +
      'body.ds-on .dash > #dashLeaves,body.ds-on .dash > #dashMerit{grid-column:1 / -1}' +

      /* ---------- ফর্ম, তালিকা, টেবিল ---------- */
      'body.ds-on .card input:not([type=checkbox]):not([type=radio]):not([type=file]),body.ds-on .card select,body.ds-on .card textarea{max-width:560px}' +
      gridSel + '{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}' +
      spanSel + '{grid-column:1 / -1}' +
      'body.ds-on #feesResultWrap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}' +
      'body.ds-on #feesResultWrap > :not(.fq-row){grid-column:1 / -1}' +
      'body.ds-on #marksheetPrintArea{max-width:820px;margin-left:auto;margin-right:auto}' +
      'body.ds-on #topBar{top:60px!important;z-index:9!important;padding:10px 32px!important}' +

      /* ---------- বেতনের শিট ও বার্তা: মাঝখানে পপআপ ---------- */
      'body.ds-on .fq-bd{align-items:center;justify-content:center}' +
      'body.ds-on .fq-pn{width:480px;max-width:92vw;border-radius:22px;padding-bottom:18px}' +
      'body.ds-on .fq-pn:before{display:none}' +
      'body.ds-on .fq-toast{left:50%;right:auto;width:min(460px,60vw);transform:translateX(calc(-50% + 134px));bottom:28px}' +
      'body.ds-on tbody tr:hover td{background:#f4fafb}' +

      /* ভাসমান গোল বাটন উপরের হেডারে (হোম আইকনের পাশে) সরে যায়, কোনো কনটেন্ট ঢাকে না */
      'body.ds-on .ds-float{top:8px!important;bottom:auto!important;right:84px!important;z-index:60!important}' +
      '}' +

      /* ---------- প্রিন্ট (শুধু কম্পিউটারে): সাইডবার ছাপা হয় না ---------- */
      '@media ' + MQP + '{body.ds-on{padding-left:0!important}body.ds-on nav.tabs,body.ds-on .ds-float{display:none!important}}';

    if (!document.getElementById('desktopStyles')) {
      var st = document.createElement('style');
      st.id = 'desktopStyles';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    // নীল গোল ভাসমান বাটন (যে ফাইল থেকেই আসুক) শনাক্ত করে ds-float ক্লাস দেয়
    var tagFloat = function () {
      var els = document.querySelectorAll('body > *');
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        if (e === nav || e.tagName === 'HEADER' || e.classList.contains('ds-float')) continue;
        var cs = getComputedStyle(e);
        if (cs.position === 'fixed' && e.offsetWidth > 0 && e.offsetWidth <= 72 && e.offsetHeight <= 72 && parseFloat(cs.borderTopLeftRadius) >= 20) e.classList.add('ds-float');
      }
    };
    tagFloat();
    setInterval(tagFloat, 3000);
  } catch (e) {
    console.error('[desktop] ডেস্কটপ লেআউট চালু হয়নি, আগের ডিজাইনই থাকবে:', e);
  }
})();
