/* ShikkhaOS — ui-polish.js
 *
 * index.html এ icons.js এর ঠিক নিচে লোড হয়:
 *   <script defer src="icons.js"></script>
 *   <script defer src="ui-polish.js"></script>
 *
 * app.js, dashboard.js, icons.js এর কিছুই বদলাতে হয় না। এই ফাইল:
 *   1) নিচের নেভিগেশন বারের নতুন ডিজাইন (সক্রিয় ট্যাবে টিল পিল)
 *   2) "আরও" মেনু শিট: চার গ্রুপ (একাডেমিক, প্রশাসন, যোগাযোগ, ব্যবস্থাপনা) ও রঙিন টাইল
 *   3) হোমের চার কুইক অ্যাকশন আইকনে আলাদা আলাদা রং
 * হোমের ব্যানার ও পরিসংখ্যান স্ট্রিপ একদম অপরিবর্তিত।
 *
 * সব ফোনে একই দেখানোর জন্য: color-mix, inset, gradient বা নতুন CSS ফিচার ব্যবহার করা হয়নি;
 * সব রং সরাসরি hex/rgba কোডে। কোনো ধাপে সমস্যা হলে আগের ডিজাইনই থাকে।
 */
(function () {
  'use strict';
  try {
    if (typeof window.buildNavHtml !== 'function') {
      console.error('[ui-polish] app.js এর আগে ui-polish.js লোড হয়েছে। index.html এ এই লাইনটি icons.js এর নিচে রাখুন।');
      return;
    }

    const safe = typeof window.esc === 'function'
      ? window.esc
      : function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    // ================= রং ও গ্রুপ =================
    const TEAL = '#0F7B6C';
    const COL = {
      students: '#3B6FD4', results: '#C98A1B', report: '#0E8FA6', attendance: TEAL,
      homework: '#D9622B', leaves: '#2E9E5B', timeleft: '#0E8FA6', fees: '#7C4DCC',
      notices: '#E0752B', diary: '#C8407A', suggestions: '#3B6FD4',
      teachers: TEAL, super_admin: '#C23B3B', settings: '#5F6B7A'
    };
    const GROUPS = [
      { name: 'একাডেমিক', c: TEAL, test: function (k) { return /^(students|results|report|attendance|homework)$/.test(k) || /exam|routine/i.test(k); } },
      { name: 'প্রশাসন', c: '#7C4DCC', test: function (k) { return /^(leaves|timeleft|fees)$/.test(k); } },
      { name: 'যোগাযোগ', c: '#C8407A', test: function (k) { return /^(notices|diary|suggestions)$/.test(k); } },
      { name: 'ব্যবস্থাপনা', c: '#5F6B7A', test: function () { return true; } }
    ];
    const colorOf = function (k) { return COL[k] || TEAL; };
    const rgba = function (hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    };
    const badge = function (n, cls) { return n ? '<span class="' + cls + '">' + (n > 9 ? '9+' : n) + '</span>' : ''; };

    // ================= CSS =================
    const CSS = `
/* ---- নিচের বার ---- */
nav.tabs .tabs-primary{border-radius:22px 22px 0 0;border-top:1px solid #e2e8f0;box-shadow:0 -4px 18px rgba(15,23,42,.08);padding:8px 4px 10px;padding-bottom:calc(10px + env(safe-area-inset-bottom, 0px))}
nav.tabs .tabs-primary .tab-btn{font-size:11.5px;gap:4px;-webkit-tap-highlight-color:transparent}
nav.tabs .tabs-primary .tab-btn .tab-wrap{position:relative;display:block}
nav.tabs .tabs-primary .tab-btn .tab-icon{display:flex;align-items:center;justify-content:center;width:54px;height:32px;padding:0;border-radius:16px;font-size:19px;background:transparent;color:#64748b;transition:background .15s ease}
nav.tabs .tabs-primary .tab-btn.active .tab-icon{background:#0f766e;color:#fff}
nav.tabs .tabs-primary .tab-btn.active .tab-icon[data-svg]{color:#fff}
nav.tabs .tabs-primary .tab-btn .tab-lbl{margin-top:0}
nav.tabs .tabs-primary .tab-btn .nbadge{position:absolute;top:-3px;right:3px;background:#dc2626;color:#fff;border-radius:10px;font-size:10px;min-width:16px;height:16px;line-height:16px;text-align:center;padding:0 3px;border:2px solid #fff;box-sizing:content-box}

/* ---- "আরও" মেনু শিট ---- */
.more-sheet{border-radius:22px 22px 0 0;padding:8px 12px 80px;box-shadow:0 -8px 24px rgba(15,23,42,.14);max-height:72vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
.more-sheet:before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:#cbd5e1;margin:0 auto 10px}
.more-sheet .more-title{font-size:13px;margin:0 2px 2px}
.more-sheet .more-gh{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:#1e293b;margin:14px 2px 8px}
.more-sheet .more-gh:before{content:"";width:4px;height:14px;border-radius:2px;background:var(--c,#0f766e)}
.more-sheet .more-grid{gap:8px}
.more-sheet .more-grid .more-item{position:relative;overflow:hidden;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:10px;min-height:92px;padding:10px;border-radius:16px;font-size:12.5px;font-weight:700;text-align:left;line-height:1.35;color:#1e293b;-webkit-tap-highlight-color:transparent;transition:transform .12s ease}
.more-sheet .more-grid .more-item:active{transform:scale(.95)}
.more-sheet .more-grid .more-item.active{font-weight:700;color:#1e293b;box-shadow:0 0 0 2px var(--c,#0f766e)}
.more-sheet .more-grid .more-item .more-lbl{position:relative;overflow-wrap:anywhere}
.more-sheet .more-grid .more-item .more-icon.more-ib{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;color:#fff;font-size:19px;flex:none}
.more-sheet .more-grid .more-item .more-icon.more-ib[data-svg]{color:#fff}
.more-sheet .more-grid .more-item .more-icon.more-ib[data-svg] svg{width:21px;height:21px}
.more-sheet .more-grid .more-item .more-icon.more-wm{position:absolute;right:-10px;bottom:-12px;font-size:50px;opacity:.1;pointer-events:none}
.more-sheet .more-grid .more-item .more-icon.more-wm[data-svg] svg{width:58px;height:58px}
.more-sheet .more-grid .more-item .nbadge{position:absolute;top:8px;right:8px;background:#dc2626;color:#fff;border-radius:10px;font-size:10px;min-width:16px;height:16px;line-height:16px;text-align:center;padding:0 3px}

/* ---- হোমের চার কুইক অ্যাকশন ---- */
.dash .dash-actions .dash-act{--c:#0F7B6C;gap:8px;-webkit-tap-highlight-color:transparent}
.dash .dash-actions .dash-act[onclick="teacherTab('attendance')"]{--c:#0F7B6C}
.dash .dash-actions .dash-act[onclick="teacherTab('results')"]{--c:#C98A1B}
.dash .dash-actions .dash-act[onclick="teacherTab('notices')"]{--c:#E0752B}
.dash .dash-actions .dash-act[onclick="teacherTab('students')"]{--c:#3B6FD4}
.dash .dash-actions .dash-act[onclick="studentTab('attendance')"]{--c:#0F7B6C}
.dash .dash-actions .dash-act[onclick="studentTab('leaves')"]{--c:#2E9E5B}
.dash .dash-actions .dash-act[onclick="studentTab('fees')"]{--c:#7C4DCC}
.dash .dash-actions .dash-act[onclick="studentTab('suggestions')"]{--c:#3B6FD4}
.dash .dash-actions .dash-act .dash-act-ic,.dash .dash-actions .dash-act.main .dash-act-ic{width:64px;height:64px;border-radius:22px;background:var(--c);color:#fff;box-shadow:0 10px 16px -10px var(--c);transition:transform .12s ease}
.dash .dash-actions .dash-act:active .dash-act-ic{transform:scale(.94)}
.dash .dash-actions .dash-act .dash-act-ic[data-svg]{color:#fff}
.dash .dash-actions .dash-act .dash-act-ic[data-svg] svg{width:30px;height:30px}

@media (max-width:340px){
  .more-sheet .more-grid .more-item{min-height:84px;font-size:12px;padding:9px}
  .dash .dash-actions .dash-act .dash-act-ic,.dash .dash-actions .dash-act.main .dash-act-ic{width:56px;height:56px;border-radius:19px}
}
`;
    if (!document.getElementById('uiPolishStyles')) {
      const st = document.createElement('style');
      st.id = 'uiPolishStyles';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    // ================= নেভিগেশন + "আরও" মেনু =================
    // app.js এর buildNavHtml এর জায়গায় বসে। ফাংশনের নাম, ক্লাস (tab-btn, more-item, more-icon)
    // এবং onclick আগের মতোই, তাই icons.js ও বাকি সব স্ক্রিপ্ট আগের মতোই কাজ করে।
    // আনরিড ব্যাজ এখন আইকনের বাইরে বসে, তাই icons.js SVG বসালেও ব্যাজ মুছে যায় না।
    window.buildNavHtml = function (primaryTabs, moreTabs, tabFnName, activeKey, badges) {
      badges = badges || {};

      const primaryHtml = primaryTabs.map(function (t) {
        return '<button class="tab-btn ' + (activeKey === t.key ? 'active' : '') + '" onclick="' + tabFnName + "('" + t.key + "')" + '">'
          + '<span class="tab-wrap"><span class="tab-icon">' + t.icon + '</span>' + badge(badges[t.key], 'nbadge') + '</span>'
          + '<span class="tab-lbl">' + safe(t.label) + '</span>'
          + '</button>';
      }).join('');

      const moreActive = moreTabs.some(function (t) { return t.key === activeKey; });
      const moreBadgeTotal = moreTabs.reduce(function (sum, t) { return sum + (badges[t.key] || 0); }, 0);
      const moreBtnHtml = '<button class="tab-btn ' + (moreActive ? 'active' : '') + '" onclick="toggleMoreMenu()">'
        + '<span class="tab-wrap"><span class="tab-icon">\u2022\u2022\u2022</span>' + badge(moreBadgeTotal, 'nbadge') + '</span>'
        + '<span class="tab-lbl">আরও</span>'
        + '</button>';

      const buckets = GROUPS.map(function () { return []; });
      moreTabs.forEach(function (t) {
        for (let i = 0; i < GROUPS.length; i++) {
          if (GROUPS[i].test(t.key)) { buckets[i].push(t); break; }
        }
      });

      const groupsHtml = GROUPS.map(function (g, i) {
        if (!buckets[i].length) return '';
        const items = buckets[i].map(function (t) {
          const c = colorOf(t.key);
          const style = 'background:' + rgba(c, 0.11) + ';border:1px solid ' + rgba(c, 0.28) + ';--c:' + c;
          return '<div class="more-item ' + (activeKey === t.key ? 'active' : '') + '" style="' + style + '" onclick="' + tabFnName + "('" + t.key + "'); closeMoreMenu();" + '">'
            + '<span class="more-icon more-ib" style="background:' + c + '">' + t.icon + '</span>'
            + '<span class="more-icon more-wm" style="color:' + c + '" aria-hidden="true">' + t.icon + '</span>'
            + badge(badges[t.key], 'nbadge')
            + '<span class="more-lbl">' + safe(t.label) + '</span>'
            + '</div>';
        }).join('');
        return '<div class="more-gh" style="--c:' + g.c + '">' + g.name + '</div>'
          + '<div class="more-grid">' + items + '</div>';
      }).join('');

      return '<div class="tabs-primary">' + primaryHtml + moreBtnHtml + '</div>'
        + '<div id="moreSheetBackdrop" class="more-sheet-backdrop" style="display:none;" onclick="closeMoreMenu()"></div>'
        + '<div id="moreSheet" class="more-sheet" style="display:none;">'
        + '<div class="more-title">সব মেনু</div>'
        + groupsHtml
        + '</div>';
    };
  } catch (e) {
    console.error('[ui-polish] নতুন ডিজাইন চালু হয়নি, আগের ডিজাইনই থাকবে:', e);
  }
})();
