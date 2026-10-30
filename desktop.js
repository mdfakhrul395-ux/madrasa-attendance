/* ShikkhaOS — desktop.js (ধাপ ১: কম্পিউটারের জন্য সাইডবার লেআউট)
 *
 * index.html এ সবার শেষে (demo.js এর নিচে) লোড হয়:
 *   <script defer src="desktop.js"></script>
 *
 * শুধু ৯০০px বা তার চেয়ে চওড়া স্ক্রিনে কাজ করে। ফোনের ডিজাইন একটুও বদলায় না।
 * app.js, dashboard.js, icons.js, ui-polish.js কিছুই বদলাতে হয় না।
 *   1) নিচের নেভিগেশন বার বাঁ পাশের সাইডবার হয়ে যায় (প্রাথমিক ট্যাব + "আরও" মেনুর সব গ্রুপ একসাথে)
 *   2) উপরের হেডার বাঁ-সারিবদ্ধ হয়, হোম/লগআউট আইকন ডান পাশে যায়
 *   3) কনটেন্ট বড় স্ক্রিনে চওড়া হয়, কার্ড ও বাটন ডেস্কটপের মাপে সাজে
 * কোনো সমস্যা হলে আগের ডিজাইনই থাকে।
 */
(function () {
  'use strict';
  try {
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

    var CSS = '@media (min-width:900px){' +

      /* ---------- পুরো পাতা ---------- */
      'body.ds-on{padding:0 0 32px 268px;background:#eef3f5}' +
      'body.ds-on .screen{max-width:1040px;padding:30px 36px}' +

      /* ---------- উপরের হেডার ---------- */
      'body.ds-on header{text-align:left;padding:18px 32px;font-size:19px;letter-spacing:.2px;background:#0f766e;box-shadow:0 2px 14px rgba(15,23,42,.12)}' +
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
      '}';

    if (!document.getElementById('desktopStyles')) {
      var st = document.createElement('style');
      st.id = 'desktopStyles';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) {
    console.error('[desktop] ডেস্কটপ লেআউট চালু হয়নি, আগের ডিজাইনই থাকবে:', e);
  }
})();
