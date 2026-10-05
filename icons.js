/* ShikkhaOS — আইকন প্যাচ v2 (icons.js)
 * index.html এ সবার শেষে: <script defer src="icons.js"></script>
 * ইমোজির জায়গায় দুই-স্তরের (duotone) রঙিন SVG আইকন বসায়:
 * ড্যাশবোর্ডের বাটন, নিচের মেনু, "আরও" মেনু, হেডারের হোম আইকন ও ভাসমান চার্ট বাটন।
 * চেনা না গেলে আগের ইমোজিই থাকে, কিছু ভাঙে না।
 */
(function () {
  'use strict';
  try {
    const I = {
      home: ['teal', '<path class="f" d="M5.5 10v9.5a1 1 0 0 0 1 1H10V15h4v5.5h3.5a1 1 0 0 0 1-1V10L12 4z"/><path d="M3.5 11.5 12 4l8.5 7.5"/>'],
      attendance: ['teal', '<rect class="f" x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3h6v3H9z"/><path d="m9 13.5 2.2 2.2L15.5 11"/>'],
      clock: ['teal', '<circle class="f" cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'],
      results: ['amber', '<path class="f" d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3H8"/><path d="M16 6h2.5a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3H16"/><path d="M12 13v7.5M8.5 20.5h7"/>'],
      reports: ['indigo', '<rect class="f" x="5" y="11" width="3.4" height="9" rx="1"/><rect class="f" x="10.3" y="5" width="3.4" height="15" rx="1"/><rect class="f" x="15.6" y="13" width="3.4" height="7" rx="1"/>'],
      notices: ['violet', '<path class="f" d="M3.5 10.2v3.6a1 1 0 0 0 1 1H7l7.5 4V5.2L7 9.2H4.5a1 1 0 0 0-1 1z"/><path d="M18 9a4.2 4.2 0 0 1 0 6"/>'],
      students: ['blue', '<path class="f" d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.8V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2"/><path d="M21.5 9.5V15"/>'],
      leaves: ['orange', '<rect class="f" x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9.5 15 2 2 3.5-3.5"/>'],
      fees: ['green', '<rect class="f" x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>'],
      diary: ['cyan', '<path class="f" d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v13"/>'],
      suggestions: ['rose', '<path class="f" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5z"/>'],
      homework: ['indigo', '<path class="f" d="M4 20l1.2-4.2L16.6 4.4a2.1 2.1 0 0 1 3 3L8.2 18.8z"/><path d="M14.5 6.5l3 3"/>'],
      routine: ['cyan', '<rect class="f" x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M3.5 15h17M9 9.5v11"/>'],
      settings: ['slate', '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle class="f" cx="15" cy="7" r="2"/><circle class="f" cx="9" cy="17" r="2"/>'],
      teachers: ['violet', '<circle class="f" cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2"/><path d="M16 5.6a3 3 0 0 1 0 5.8M18 14.6c1.8.6 3 2.2 3 4.4"/>'],
      super_admin: ['pine', '<path class="f" d="M12 3.5 5 6.2v5.6c0 4 2.8 7 7 8.7 4.2-1.7 7-4.7 7-8.7V6.2z"/><path d="m9 12 2.2 2.2L15.2 10"/>'],
      more: ['', '<circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/>']
    };
    const ALIAS = { report: 'reports', exam_routine: 'routine', examroutine: 'routine', routines: 'routine', exams: 'routine', teacher: 'teachers', superadmin: 'super_admin', suggestion: 'suggestions', leave: 'leaves', notice: 'notices', result: 'results', student: 'students', fee: 'fees' };
    const norm = s => String(s || '').replace(/\uFE0F/g, '').trim();
    const EM = {};
    [['⏰', 'clock'], ['🏠', 'home'], ['✅', 'attendance'], ['📊', 'reports'], ['🏆', 'results'], ['📅', 'leaves'], ['💰', 'fees'], ['📢', 'notices'],
      ['🎓', 'students'], ['\u{1F468}\u200D\u{1F393}', 'students'], ['📖', 'diary'], ['📚', 'diary'], ['💬', 'suggestions'], ['✏️', 'homework'],
      ['📝', 'homework'], ['📋', 'routine'], ['⚙️', 'settings'], ['👥', 'teachers'], ['🛡️', 'super_admin']].forEach(a => { EM[norm(a[0])] = a[1]; });

    const CSS = `
[data-c=teal]{--g1:#2dd4bf;--g2:#0f766e}[data-c=amber]{--g1:#fbbf24;--g2:#d97706}[data-c=blue]{--g1:#60a5fa;--g2:#1d4ed8}
[data-c=indigo]{--g1:#818cf8;--g2:#4338ca}[data-c=violet]{--g1:#a78bfa;--g2:#6d28d9}[data-c=orange]{--g1:#fb923c;--g2:#c2410c}
[data-c=green]{--g1:#4ade80;--g2:#15803d}[data-c=cyan]{--g1:#22d3ee;--g2:#0e7490}[data-c=rose]{--g1:#fb7185;--g2:#be123c}
[data-c=slate]{--g1:#94a3b8;--g2:#475569}[data-c=pine]{--g1:#1f8a7d;--g2:#0a3a35}
svg .f{fill:currentColor;fill-opacity:.24}
.dash .dash-act .dash-act-ic[data-svg],.more-grid .more-item .more-icon[data-svg]{position:relative;overflow:hidden;display:grid;place-items:center;font-size:0;color:#fff;background:radial-gradient(circle at 28% 16%,rgba(255,255,255,.4),transparent 52%),linear-gradient(145deg,var(--g1),var(--g2))}
.dash .dash-act .dash-act-ic[data-svg] svg,.more-grid .more-item .more-icon[data-svg] svg{display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.22))}
.dash .dash-act .dash-act-ic[data-svg]{width:60px;height:60px;border-radius:20px;box-shadow:0 12px 20px -10px var(--g2),inset 0 0 0 1px rgba(255,255,255,.2);transition:transform .15s ease}
.dash .dash-act .dash-act-ic[data-svg] svg{width:30px;height:30px}
.dash .dash-act.main .dash-act-ic[data-svg]{box-shadow:0 14px 22px -9px var(--g2),0 0 0 3px #fff,0 0 0 5px rgba(224,176,79,.9)}
.dash .dash-act:active .dash-act-ic[data-svg]{transform:scale(.92)}
.more-grid .more-item .more-icon[data-svg]{width:46px;height:46px;border-radius:16px;box-shadow:0 8px 14px -8px var(--g2),inset 0 0 0 1px rgba(255,255,255,.2)}
.more-grid .more-item .more-icon[data-svg] svg{width:25px;height:25px}
.tabs-primary .tab-btn .tab-icon[data-svg]{display:flex;align-items:center;justify-content:center;font-size:0;width:56px;height:32px;padding:0}
.tabs-primary .tab-btn .tab-icon[data-svg] svg{display:block;width:23px;height:23px}
.tabs-primary .tab-btn.active .tab-icon[data-svg]{color:#fff;background:linear-gradient(145deg,var(--g1),var(--g2));box-shadow:0 7px 12px -6px var(--g2)}
.tabs-primary .tab-btn.active .tab-icon[data-svg] svg{filter:drop-shadow(0 1px 1px rgba(0,0,0,.2))}
.ico-x{color:#fff}.ico-x svg{display:block;width:26px;height:26px;margin:auto}
`;
    if (!document.getElementById('iconStyles')) {
      const st = document.createElement('style');
      st.id = 'iconStyles';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    const svg = p => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>';
    function emojiKeys() {
      const m = {};
      [typeof teacherPrimaryTabs !== 'undefined' ? teacherPrimaryTabs : [], typeof teacherMoreTabs !== 'undefined' ? teacherMoreTabs : [],
        typeof studentPrimaryTabs !== 'undefined' ? studentPrimaryTabs : [], typeof studentMoreTabs !== 'undefined' ? studentMoreTabs : []]
        .forEach(a => a.forEach(t => { if (t && t.icon && !m[norm(t.icon)]) m[norm(t.icon)] = t.key; }));
      return m;
    }
    function put(el, k) {
      const d = I[ALIAS[k] || k];
      if (!d) return;
      el.innerHTML = svg(d[1]);
      el.setAttribute('data-svg', '1');
      if (d[0]) el.setAttribute('data-c', d[0]);
    }
    function pick(el) {
      const t = norm(el.textContent);
      if (/^[\u2022\u00B7\u22EF\u2026.]{2,}$/.test(t)) return 'more';
      const b = el.closest('[onclick]');
      const m = b && /\w+\('([^']+)'\)/.exec(b.getAttribute('onclick') || '');
      return [m && m[1], emojiKeys()[t], EM[t]].map(k => ALIAS[k] || k).find(k => k && I[k]);
    }
    function paint() {
      document.querySelectorAll('.dash-act-ic:not([data-svg])').forEach(s => {
        const b = s.closest('.dash-act');
        const m = b && /(teacherTab|studentTab)\('([^']+)'\)/.exec(b.getAttribute('onclick') || '');
        if (m) put(s, (m[1] === 'studentTab' && m[2] === 'attendance') ? 'clock' : m[2]);
      });
      document.querySelectorAll('.tab-icon:not([data-svg]),.more-icon:not([data-svg])').forEach(s => { const k = pick(s); if (k) put(s, k); });
      // হেডারের হোম আইকন ও ভাসমান (fixed) বাটনের ইমোজি
      document.querySelectorAll('header *:not([data-svg]),button:not([data-svg])').forEach(b => {
        if (b.children.length) return;
        const k = EM[norm(b.textContent)];
        if (k && (b.closest('header') || getComputedStyle(b).position === 'fixed')) { put(b, k); b.classList.add('ico-x'); }
      });
    }
    new MutationObserver(paint).observe(document.documentElement, { childList: true, subtree: true });
    paint();
  } catch (e) {
    console.error('[icons] আইকন প্যাচ চালু হয়নি, আগের ইমোজি আইকনই থাকবে:', e);
  }
})();
