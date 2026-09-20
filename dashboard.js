/* ShikkhaOS — শিক্ষকের হোম ড্যাশবোর্ড
 *
 * এই ফাইলটি app.js এর ঠিক নিচে লোড হয় (index.html এ):
 *   <script src="app.js"></script>
 *   <script src="dashboard.js"></script>
 *
 * app.js এর একটি অক্ষরও বদলাতে হয় না। এই ফাইল নিজেই:
 *   - নিচের মেনুতে "হোম" ট্যাব যোগ করে ("শিক্ষার্থী" ট্যাব "আরও" মেনুতে চলে যায়)
 *   - শিক্ষক লগইন করলে প্রথমে হোম ড্যাশবোর্ড খোলে
 *   - নিজের CSS নিজেই যুক্ত করে (style.css বদলাতে হয় না)
 *
 * তারিখের হিসাব app.js এর মতোই (UTC অনুযায়ী YYYY-MM-DD), তাই হাজিরার সাথে মিলে যায়।
 */
(function () {
  'use strict';

  if (typeof teacherTab !== 'function' || typeof renderTeacherNav !== 'function' || typeof db === 'undefined') {
    console.error('[dashboard] app.js এর আগে dashboard.js লোড হয়েছে। index.html এ dashboard.js এর লাইনটি app.js এর নিচে রাখুন।');
    return;
  }

  // ================= CSS =================
  const CSS = `
.dash{--pine:#0a3a35;--teal:#0f766e;--brass:#e0b04f;--brass-d:#a87a1c;--ink:#1e293b;--mute:#64748b;--line:#e6ebef;--ok:#15803d;--bad:#b91c1c;--warn:#b45309;color:var(--ink);padding-bottom:6px}
.dash button{width:auto;margin:0;padding:0;border:0;border-radius:0;background:none;color:inherit;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:inherit}
.dash button:focus-visible{outline:3px solid var(--brass);outline-offset:2px}

.dash-hero{position:relative;overflow:hidden;isolation:isolate;border-radius:26px;padding:18px 18px 16px;margin-bottom:14px;color:#fff;background:linear-gradient(150deg,#0a3a35 0%,#0e5852 55%,#0f766e 100%);box-shadow:0 14px 28px -14px rgba(10,58,53,.6)}
.dash-hero::before{content:"";position:absolute;inset:0;z-index:-1;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cg fill='none' stroke='%23fff' stroke-opacity='.13'%3E%3Crect x='10' y='10' width='28' height='28'/%3E%3Cpolygon points='24,4.2 43.8,24 24,43.8 4.2,24'/%3E%3C/g%3E%3C/svg%3E");background-size:48px 48px;-webkit-mask-image:linear-gradient(115deg,transparent 28%,#000 100%);mask-image:linear-gradient(115deg,transparent 28%,#000 100%)}
.dash-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.dash-greet{font-size:17px;font-weight:800;letter-spacing:.1px}
.dash-date{font-size:12.5px;opacity:.8;margin-top:2px}
.dash .dash-refresh{flex:none;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;font-size:18px;line-height:1;text-align:center}
.dash-hero-main{display:flex;align-items:center;gap:18px;margin-top:14px}
.dash-ring-wrap{position:relative;width:124px;height:124px;flex:none}
.dash-ring{width:100%;height:100%;display:block}
.dash-ring-bg{fill:none;stroke:rgba(255,255,255,.16);stroke-width:9}
.dash-ring-fg{fill:none;stroke:var(--brass);stroke-width:9;stroke-linecap:round;transition:stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)}
.dash-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.dash-ring-pct{font-size:31px;font-weight:800;line-height:1.05}
.dash-ring-pct small{font-size:16px;font-weight:700;margin-left:1px}
.dash-ring-cap{font-size:11px;opacity:.78;margin-top:3px}
.dash-hero-stats{flex:1;min-width:0}
.dash-hs{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.13);font-size:14px}
.dash-hs:last-child{border-bottom:0}
.dash-hs i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px}
.dash-hs i.p{background:#86efac}.dash-hs i.a{background:#fca5a5}.dash-hs i.u{background:rgba(255,255,255,.5)}
.dash-hs b{font-size:19px;font-weight:800}
.dash-hero-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
.dash-hero-status{font-size:13px;opacity:.88;line-height:1.5;flex:1}
.dash .dash-cta{flex:none;padding:10px 16px;border-radius:12px;background:var(--brass);color:#3b2a06;font-weight:800;font-size:14px;box-shadow:0 6px 14px -6px rgba(0,0,0,.5)}

.dash-strip{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-radius:18px;margin-bottom:16px;box-shadow:0 0 0 1px var(--line)}
.dash .dash-cell{padding:13px 3px 12px;text-align:center;border-left:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:3px}
.dash .dash-cell:first-child{border-left:0}
.dash-cell b{font-size:23px;font-weight:800;line-height:1.1;color:var(--pine)}
.dash-cell span{font-size:11px;color:var(--mute);line-height:1.3}
.dash-cell.warn b{color:var(--warn)}
.dash-cell.bad b{color:var(--bad)}

.dash-actions{display:flex;justify-content:space-between;margin:0 2px 18px}
.dash .dash-act{display:flex;flex-direction:column;align-items:center;gap:7px;width:25%;font-size:12.5px;font-weight:700;color:#334155;text-align:center}
.dash-act-ic{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:23px;background:#e3f3f0;box-shadow:inset 0 0 0 1px #c5e6e0}
.dash-act.main .dash-act-ic{background:var(--teal);box-shadow:0 8px 16px -8px rgba(15,118,110,.8)}

.dash-sec{background:#fff;border-radius:18px;padding:16px;margin-bottom:14px;box-shadow:0 0 0 1px var(--line)}
.dash-sec.attn{border-left:4px solid var(--brass);border-radius:6px 18px 18px 6px}
.dash-sec.slim{padding:12px 16px}
.dash-sec-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.dash-sec-head h3{font-size:15.5px;font-weight:800;color:var(--pine);margin:0}
.dash .dash-link{font-size:12.5px;font-weight:700;color:var(--teal);padding:4px 0}
.dash-chip{font-size:12px;font-weight:700;background:#e7f5f2;color:var(--teal);padding:3px 10px;border-radius:99px;white-space:nowrap}

.dash-skel{border-radius:10px;background:linear-gradient(90deg,#eef2f5 25%,#f8fafc 40%,#eef2f5 60%);background-size:400% 100%;animation:dashShimmer 1.4s infinite}
@keyframes dashShimmer{0%{background-position:100% 0}100%{background-position:0 0}}

.dash-empty{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--mute);line-height:1.5}
.dash-empty-ic{flex:none;width:36px;height:36px;border-radius:50%;background:#dcfce7;color:var(--ok);display:grid;place-items:center;font-weight:800;font-size:17px}
.dash-empty b{display:block;color:var(--ink);font-size:14px}
.dash-empty .dash-btn{margin-top:8px}
.dash-err{font-size:13px;color:var(--mute);line-height:1.6}
.dash-err b{display:block;color:var(--bad);font-size:14px}
.dash-err .dash-btn{margin-top:8px}

.dash .dash-btn{display:inline-block;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:700;text-align:center}
.dash .dash-btn.ok{background:var(--teal);color:#fff}
.dash .dash-btn.no{background:#fff;color:var(--bad);box-shadow:inset 0 0 0 1.5px #f3b4b4}
.dash .dash-btn.ghost{background:#eef2f5;color:#334155}

.dash-cls-list>div{padding:12px 0;border-top:1px solid var(--line)}
.dash-cls-list>div:first-child{border-top:0;padding-top:0}
.dash-cls-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px}
.dash-cls-top b{font-weight:700}
.dash-cls-top span{font-size:12.5px;color:var(--mute)}
.dash-seg{display:flex;height:9px;border-radius:99px;background:#eef2f5;overflow:hidden;margin:8px 0 6px}
.dash-seg i{display:block;height:100%}
.dash-seg .p{background:var(--teal)}.dash-seg .a{background:#ef6b6b}
.dash-cls-meta{display:flex;gap:14px;font-size:12px;color:var(--mute)}
.dash-anim .dash-seg i{transform-origin:left;animation:dashFill 1s cubic-bezier(.22,1,.36,1) both}
@keyframes dashFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}

.dash-chart{display:flex;align-items:flex-end;gap:8px}
.dash-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}
.dash-col-val{font-size:10.5px;font-weight:700;color:var(--mute);height:16px;line-height:16px;white-space:nowrap}
.dash-col-track{width:100%;height:96px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1.5px solid var(--line)}
.dash-bar{width:72%;max-width:30px;border-radius:8px 8px 3px 3px;transform-origin:bottom}
.dash-bar.good{background:linear-gradient(#14b8a6,#0f766e)}
.dash-bar.mid{background:var(--brass)}
.dash-bar.low{background:#e57373}
.dash-bar.none{height:3px;border-radius:0;background:repeating-linear-gradient(90deg,#cbd5e1 0 4px,transparent 4px 7px)}
.dash-col-lbl{font-size:11.5px;color:var(--mute);margin-top:6px;height:16px;line-height:16px}
.dash-col.today .dash-col-lbl,.dash-col.today .dash-col-val{color:var(--pine);font-weight:800}
.dash-col.load .dash-col-track{background:linear-gradient(#f4f7f9,#f4f7f9) bottom/60% 40% no-repeat}
.dash-anim .dash-bar{animation:dashGrow .9s cubic-bezier(.22,1,.36,1) both}
@keyframes dashGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.dash-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;font-size:11.5px;color:var(--mute)}
.dash-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
.dash-legend .g{background:#0f9488}.dash-legend .m{background:var(--brass)}.dash-legend .l{background:#e57373}

.dash-leave{display:flex;gap:11px;padding:13px 0;border-top:1px solid var(--line);align-items:flex-start}
.dash-leave-list>.dash-leave:first-child{border-top:0;padding-top:2px}
.dash-avatar{flex:none;width:38px;height:38px;border-radius:12px;background:#fff1cc;color:#8a5a00;display:grid;place-items:center;font-weight:800;font-size:16px}
.dash-leave-body{flex:1;min-width:0}
.dash-leave-name{font-weight:700;font-size:14px}
.dash-leave-meta{font-size:12px;color:var(--mute);margin-top:1px}
.dash-leave-reason{font-size:13px;margin-top:5px;color:#334155;overflow-wrap:anywhere;line-height:1.55}
.dash-leave-btns{display:flex;gap:8px;margin-top:10px}

.dash-fee-row{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
.dash-fee-amt{font-size:27px;font-weight:800;color:var(--pine);line-height:1.1}
.dash-fee-lbl{font-size:12px;color:var(--mute);margin-top:2px}
.dash-fee-pct{font-size:22px;font-weight:800;color:var(--brass-d)}
.dash-prog{height:10px;border-radius:99px;background:#eef2f5;overflow:hidden;margin:13px 0 9px}
.dash-prog i{display:block;height:100%;background:linear-gradient(90deg,#0f766e,#2dd4bf);border-radius:99px;transform-origin:left}
.dash-anim .dash-prog i{animation:dashFill 1s cubic-bezier(.22,1,.36,1) both}
.dash-fee-legend{display:flex;justify-content:space-between;font-size:12.5px;color:var(--mute)}
.dash-fee-extra{display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13px}
.dash-fee-extra b{color:var(--bad)}

.dash-note{padding:12px 0;border-top:1px solid var(--line)}
.dash-note-list>.dash-note:first-child{border-top:0;padding-top:0}
.dash-note-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.dash-note-top b{font-size:14px}
.dash-note-date{font-size:11.5px;color:var(--mute);flex:none}
.dash-note p{font-size:13px;color:#475569;margin:4px 0 0;overflow-wrap:anywhere;line-height:1.55}

.dash-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px}
.dash .dash-chipbtn{flex:none;padding:6px 14px;border-radius:99px;font-size:12.5px;font-weight:700;background:#eef2f5;color:#475569}
.dash .dash-chipbtn.on{background:var(--pine);color:#fff}
.dash-exam{font-size:12.5px;color:var(--mute);margin-bottom:4px}
.dash-rank{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}
.dash-medal{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:20px;background:#f8f3e4}
.dash-rank-body{flex:1;min-width:0}
.dash-rank-name{font-weight:700;font-size:14px}
.dash-rank-meta{font-size:12px;color:var(--mute);margin-top:1px}
.dash-gpa{text-align:right;font-weight:800;color:var(--pine);font-size:16px;line-height:1.2}
.dash-gpa small{display:block;font-size:11.5px;font-weight:600;color:var(--mute)}
.dash-note-txt{font-size:13px;color:var(--mute);line-height:1.6}

.more-sheet{max-height:70vh;overflow-y:auto}

@media (max-width:360px){
  .dash-ring-wrap{width:108px;height:108px}
  .dash-hero-main{gap:12px}
  .dash-ring-pct{font-size:27px}
  .dash-cell b{font-size:20px}
}
@media (prefers-reduced-motion:reduce){
  .dash *,.dash *::before{animation:none!important;transition:none!important}
}
`;
  if (!document.getElementById('dashboardStyles')) {
    const st = document.createElement('style');
    st.id = 'dashboardStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ================= NAV: "হোম" ট্যাব যোগ করা =================
  // নিচের মেনুতে জায়গা ৫টি — তাই "শিক্ষার্থী" ট্যাবটি "আরও" মেনুর শুরুতে যায়।
  if (!teacherPrimaryTabs.some(t => t.key === 'home')) {
    teacherPrimaryTabs.unshift({ key: 'home', label: 'হোম', icon: '\u{1F3E0}' });
    const idx = teacherPrimaryTabs.findIndex(t => t.key === 'students');
    if (idx > -1) {
      const moved = teacherPrimaryTabs.splice(idx, 1)[0];
      teacherMoreTabs.unshift(moved);
    }
  }

  // ================= STATE / HELPERS =================
  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;
  const TRACK_PX = 96;
  const WEEK_TTL_MS = 10 * 60 * 1000;
  const WEEKDAY_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

  let unsubs = [];
  let token = 0;          // বাড়ালে পুরোনো সব async কলব্যাক বাতিল হয়ে যায়
  let S = null;           // বর্তমান ড্যাশবোর্ডের ডেটা
  let watchTimer = null;
  let lastStudents = null;
  let meritClassPref = null;
  const weekCache = {};

  const bn = n => toBanglaNumeral(n);
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const trunc = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const money = n => '৳ ' + bn(Math.round(Number(n) || 0).toLocaleString('en-US'));
  const cmpBn = (a, b) => String(a).localeCompare(String(b), 'bn');

  function dateOffset(off) {
    const p = todayStr().split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] - off)).toISOString().slice(0, 10);
  }
  function weekdayShort(ds) {
    const p = ds.split('-').map(Number);
    return WEEKDAY_SHORT[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
  }
  // অ্যাপের অন্য জায়গার শ্রেণি-ড্রপডাউনের (getClassList) ক্রমেই সাজানো
  function orderClasses(keys) {
    const base = getClassList().filter(c => keys.indexOf(c) > -1);
    const rest = keys.filter(c => base.indexOf(c) === -1).sort(cmpBn);
    return base.concat(rest);
  }
  function studentMap() {
    const m = {};
    studentsCache.forEach(s => { m[s.id] = s; });
    return m;
  }
  function toMap(entries) {
    const m = {};
    (entries || []).forEach(e => { if (e && e.studentId) m[e.studentId] = e; });
    return m;
  }
  function calcStats(map) {
    let present = 0, absent = 0, unmarked = 0;
    studentsCache.forEach(s => {
      const e = map[s.id];
      if (e && e.status === 'present') present++;
      else if (e && e.status === 'absent') absent++;
      else unmarked++;
    });
    return { total: studentsCache.length, present, absent, unmarked, marked: present + absent };
  }
  function pendingLeaves() {
    const ids = studentMap();
    return (S.leaves || []).filter(l => (l.status || 'pending') === 'pending' && ids[l.studentId]);
  }
  function feeStats() {
    if (!S.feesM) return null;
    const ids = {};
    studentsCache.forEach(s => { ids[s.id] = true; });
    let paid = 0, collected = 0, recorded = 0;
    S.feesM.forEach(f => {
      if (!ids[f.studentId]) return;
      recorded++;
      if (f.status === 'paid') { paid++; collected += Number(f.amount) || 0; }
    });
    const total = studentsCache.length;
    return { total, paid, recorded, due: Math.max(0, total - paid), collected };
  }

  function setNum(id, n) {
    const e = el(id);
    if (!e) return;
    const from = e.dataset.val === undefined ? 0 : Number(e.dataset.val);
    if (e._raf) cancelAnimationFrame(e._raf);
    e.dataset.val = String(n);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === n || reduce) { e.textContent = bn(n); return; }
    const t0 = performance.now(), dur = 750;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      const k = 1 - Math.pow(1 - t, 3);
      e.textContent = bn(Math.round(from + (n - from) * k));
      if (t < 1) e._raf = requestAnimationFrame(step);
    };
    e._raf = requestAnimationFrame(step);
  }

  const skel = h => `<div class="dash-skel" style="height:${h}px"></div>`;
  const head = (title, right) => `<div class="dash-sec-head"><h3>${title}</h3>${right || ''}</div>`;
  const link = (label, js) => `<button class="dash-link" onclick="${js}">${label}</button>`;
  const errHtml = label => `<div class="dash-err"><b>${label} লোড করা যায়নি</b>ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।<br><button class="dash-btn ghost" onclick="dashRefresh()">আবার চেষ্টা করুন</button></div>`;
  const emptyHtml = (title, sub, cta, js) => `
    <div class="dash-empty">
      <div><b>${title}</b>${sub || ''}${cta ? `${sub ? '<br>' : ''}<button class="dash-btn ghost" onclick="${js}">${cta}</button>` : ''}</div>
    </div>`;

  // ================= SCREEN =================
  function screenHtml() {
    return `
<div id="dashboardScreen" class="dash">
  <section class="dash-hero">
    <div class="dash-hero-top">
      <div>
        <div class="dash-greet">আসসালামু আলাইকুম</div>
        <div class="dash-date" id="dashDate"></div>
      </div>
      <button class="dash-refresh" onclick="dashRefresh()" aria-label="নতুন করে লোড করুন">↻</button>
    </div>
    <div class="dash-hero-main">
      <div class="dash-ring-wrap">
        <svg class="dash-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="dash-ring-bg" cx="60" cy="60" r="${RING_R}"/>
          <circle id="dashRingFg" class="dash-ring-fg" cx="60" cy="60" r="${RING_R}" transform="rotate(-90 60 60)" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>
        </svg>
        <div class="dash-ring-center">
          <div class="dash-ring-pct"><span id="dashRingN">–</span><small id="dashRingU" style="display:none">%</small></div>
          <div class="dash-ring-cap">উপস্থিতি</div>
        </div>
      </div>
      <div class="dash-hero-stats">
        <div class="dash-hs"><span><i class="p"></i>উপস্থিত</span><b id="dashHsP">–</b></div>
        <div class="dash-hs"><span><i class="a"></i>অনুপস্থিত</span><b id="dashHsA">–</b></div>
        <div class="dash-hs"><span><i class="u"></i>চিহ্নিত হয়নি</span><b id="dashHsU">–</b></div>
      </div>
    </div>
    <div class="dash-hero-foot">
      <div class="dash-hero-status" id="dashHeroStatus">তথ্য লোড হচ্ছে...</div>
      <button class="dash-cta" id="dashHeroCta" style="display:none" onclick="teacherTab('attendance')">হাজিরা নিন</button>
    </div>
  </section>

  <div class="dash-strip">
    <button class="dash-cell" onclick="teacherTab('students')"><b id="dashC_students">–</b><span>মোট শিক্ষার্থী</span></button>
    <button class="dash-cell" onclick="teacherTab('students')"><b id="dashC_classes">–</b><span>মোট শ্রেণি</span></button>
    <button class="dash-cell" id="dashCell_leaves" onclick="teacherTab('leaves')"><b id="dashC_leaves">–</b><span>অপেক্ষমাণ ছুটি</span></button>
    <button class="dash-cell" id="dashCell_fees" onclick="teacherTab('fees')"><b id="dashC_fees">–</b><span>বেতন বকেয়া</span></button>
  </div>

  <div class="dash-actions">
    <button class="dash-act main" onclick="teacherTab('attendance')"><span class="dash-act-ic">\u2705</span>হাজিরা নিন</button>
    <button class="dash-act" onclick="teacherTab('results')"><span class="dash-act-ic">\u{1F3C6}</span>রেজাল্ট</button>
    <button class="dash-act" onclick="teacherTab('notices')"><span class="dash-act-ic">\u{1F4E2}</span>নোটিশ দিন</button>
    <button class="dash-act" onclick="teacherTab('students')"><span class="dash-act-ic">\u{1F468}\u200D\u{1F393}</span>শিক্ষার্থী</button>
  </div>

  <section class="dash-sec attn" id="dashLeaves">${skel(64)}</section>
  <section class="dash-sec" id="dashClasses">${skel(110)}</section>
  <section class="dash-sec" id="dashWeek">${skel(170)}</section>
  <section class="dash-sec" id="dashFees">${skel(110)}</section>
  <section class="dash-sec" id="dashNotices">${skel(80)}</section>
  <section class="dash-sec" id="dashMerit">${skel(120)}</section>
</div>`;
  }

  // ================= RENDER: HERO / STRIP =================
  function updateHero() {
    const ring = el('dashRingFg');
    if (!ring) return;
    const status = el('dashHeroStatus'), cta = el('dashHeroCta');
    if (S.errors.today) {
      status.textContent = 'আজকের উপস্থিতির তথ্য লোড করা যায়নি';
      cta.style.display = 'none';
      return;
    }
    if (!S.today) return;
    const st = calcStats(toMap(S.today));
    setNum('dashHsP', st.present);
    setNum('dashHsA', st.absent);
    setNum('dashHsU', st.unmarked);

    const pct = st.marked ? Math.round(st.present / st.marked * 100) : null;
    const n = el('dashRingN'), u = el('dashRingU');
    if (pct == null) { n.textContent = '–'; delete n.dataset.val; u.style.display = 'none'; }
    else { u.style.display = ''; setNum('dashRingN', pct); }
    ring.style.strokeDashoffset = pct == null ? RING_C : RING_C * (1 - pct / 100);

    let msg;
    if (!st.total) msg = 'এখনো কোনো শিক্ষার্থী যোগ করা হয়নি';
    else if (!st.marked) msg = 'আজকের হাজিরা এখনো নেওয়া হয়নি';
    else if (st.unmarked) msg = bn(st.marked) + ' জনের হাজিরা নেওয়া হয়েছে, বাকি ' + bn(st.unmarked) + ' জন';
    else msg = 'আজ সবার হাজিরা নেওয়া হয়েছে';
    status.textContent = msg;
    cta.style.display = (st.total && st.unmarked) ? '' : 'none';
    cta.textContent = st.marked ? 'বাকি হাজিরা নিন' : 'হাজিরা নিন';
  }

  function cellState(id, cls) {
    const c = el(id);
    if (!c) return;
    c.classList.remove('warn', 'bad');
    if (cls) c.classList.add(cls);
  }

  function updateStrip() {
    if (!el('dashC_students')) return;
    setNum('dashC_students', studentsCache.length);
    setNum('dashC_classes', getClassList().length);
    if (S.leaves) {
      const n = pendingLeaves().length;
      setNum('dashC_leaves', n);
      cellState('dashCell_leaves', n > 0 ? 'warn' : '');
    }
    const f = feeStats();
    if (f && f.recorded > 0) {
      setNum('dashC_fees', f.due);
      cellState('dashCell_fees', f.due > 0 ? 'bad' : '');
    } else if (f) {
      // এ মাসে কোনো বেতনের হিসাব লেখাই হয়নি — সবাইকে "বকেয়া" দেখানো বিভ্রান্তিকর
      const c = el('dashC_fees');
      if (c) { c.textContent = '–'; delete c.dataset.val; }
      cellState('dashCell_fees', '');
    }
  }

  // ================= RENDER: LEAVES =================
  function renderLeaves() {
    const box = el('dashLeaves');
    if (!box) return;
    if (S.errors.leaves) { box.classList.remove('slim'); box.innerHTML = errHtml('ছুটির আবেদন'); return; }
    if (!S.leaves) return;
    const pending = pendingLeaves();
    if (!pending.length) {
      box.classList.add('slim');
      box.classList.remove('attn');
      box.innerHTML = `<div class="dash-empty"><div class="dash-empty-ic">\u2713</div><div><b>কোনো ছুটির আবেদন অপেক্ষমাণ নেই</b></div></div>`;
      return;
    }
    box.classList.remove('slim');
    box.classList.add('attn');
    const map = studentMap();
    const shown = pending.slice(0, 3);
    const rows = shown.map(l => {
      const st = map[l.studentId];
      const name = st ? st.name : 'অজানা শিক্ষার্থী';
      const meta = [st && st.className ? esc(st.className) : '', l.date ? esc(bn(l.date)) : ''].filter(Boolean).map(x => `<span>${x}</span>`).join(' &nbsp; ');
      const id = esc(l.id);
      return `
      <div class="dash-leave">
        <div class="dash-avatar">${esc(Array.from(name)[0] || '?')}</div>
        <div class="dash-leave-body">
          <div class="dash-leave-name">${esc(name)}</div>
          <div class="dash-leave-meta">${meta}</div>
          <div class="dash-leave-reason">${esc(trunc(l.reason, 120))}</div>
          <div class="dash-leave-btns">
            <button class="dash-btn ok" onclick="dashLeaveAction('${id}','approved')">অনুমোদন</button>
            <button class="dash-btn no" onclick="dashLeaveAction('${id}','rejected')">প্রত্যাখ্যান</button>
          </div>
        </div>
      </div>`;
    }).join('');
    const more = pending.length > shown.length ? link('সব ' + bn(pending.length) + 'টি দেখুন', "teacherTab('leaves')") : link('ছুটির পাতা', "teacherTab('leaves')");
    box.innerHTML = head('অপেক্ষমাণ ছুটির আবেদন', more) + `<div class="dash-leave-list">${rows}</div>`;
  }

  window.dashLeaveAction = function (id, status) {
    if (status === 'rejected' && !confirm('এই ছুটির আবেদন প্রত্যাখ্যান করতে চান?')) return;
    if (typeof setLeaveStatus === 'function') setLeaveStatus(id, status);
  };

  // ================= RENDER: CLASSES =================
  function renderClasses() {
    const box = el('dashClasses');
    if (!box) return;
    if (S.errors.today) { box.innerHTML = errHtml('শ্রেণিভিত্তিক উপস্থিতি'); return; }
    if (!S.today) return;
    const map = toMap(S.today);
    const groups = {};
    studentsCache.forEach(s => { const c = s.className || 'শ্রেণি নেই'; (groups[c] = groups[c] || []).push(s); });
    const names = orderClasses(Object.keys(groups));
    const title = 'শ্রেণি অনুযায়ী আজকের উপস্থিতি';
    if (!names.length) {
      box.innerHTML = head(title) + emptyHtml('এখনো কোনো শিক্ষার্থী নেই', 'শিক্ষার্থী যোগ করলে শ্রেণিভিত্তিক হিসাব এখানে দেখা যাবে।', 'শিক্ষার্থী যোগ করুন', "teacherTab('students')");
      return;
    }
    const first = !S.done.classes;
    S.done.classes = true;
    const rows = names.map(c => {
      let p = 0, a = 0;
      groups[c].forEach(s => { const e = map[s.id]; if (e && e.status === 'present') p++; else if (e && e.status === 'absent') a++; });
      const total = groups[c].length, u = total - p - a;
      return `
      <div>
        <div class="dash-cls-top"><b>${esc(c)}</b><span>${bn(p)}/${bn(total)} উপস্থিত</span></div>
        <div class="dash-seg"><i class="p" style="width:${p / total * 100}%"></i><i class="a" style="width:${a / total * 100}%"></i></div>
        <div class="dash-cls-meta"><span>অনুপস্থিত ${bn(a)}</span><span>চিহ্নিত হয়নি ${bn(u)}</span></div>
      </div>`;
    }).join('');
    box.classList.toggle('dash-anim', first);
    box.innerHTML = head(title) + `<div class="dash-cls-list">${rows}</div>`;
  }

  // ================= RENDER: WEEK CHART =================
  function renderWeek() {
    const box = el('dashWeek');
    if (!box) return;
    if (S.errors.today) { box.innerHTML = errHtml('সাপ্তাহিক উপস্থিতি'); return; }
    if (!S.today && !Object.keys(S.week).length) return;
    let sum = 0, cnt = 0;
    const cols = [];
    for (let i = 6; i >= 0; i--) {
      const ds = i === 0 ? todayStr() : dateOffset(i);
      const entries = i === 0 ? S.today : S.week[ds];
      const loading = entries === undefined || entries === null && i === 0;
      let pct = null;
      if (Array.isArray(entries)) {
        const st = calcStats(toMap(entries));
        pct = st.marked ? Math.round(st.present / st.marked * 100) : null;
      }
      if (pct != null) { sum += pct; cnt++; }
      cols.push({ ds, i, pct, loading });
    }
    const first = !S.done.week && !!S.today;
    if (S.today) S.done.week = true;
    const bars = cols.map((c, idx) => {
      const cls = c.pct == null ? 'none' : c.pct >= 90 ? 'good' : c.pct >= 75 ? 'mid' : 'low';
      const h = c.pct == null ? '' : `height:${Math.max(6, Math.round(c.pct / 100 * TRACK_PX))}px;`;
      return `
      <div class="dash-col${c.i === 0 ? ' today' : ''}${c.loading ? ' load' : ''}">
        <div class="dash-col-val">${c.pct == null ? '' : bn(c.pct) + '%'}</div>
        <div class="dash-col-track"><div class="dash-bar ${cls}" style="${h}animation-delay:${idx * 70}ms"></div></div>
        <div class="dash-col-lbl">${c.i === 0 ? 'আজ' : weekdayShort(c.ds)}</div>
      </div>`;
    }).join('');
    const chip = cnt ? `<span class="dash-chip">গড় ${bn(Math.round(sum / cnt))}%</span>` : '';
    box.classList.toggle('dash-anim', first);
    box.innerHTML = head('গত ৭ দিনের উপস্থিতি', chip) + `
      <div class="dash-chart">${bars}</div>
      <div class="dash-legend"><span><i class="g"></i>৯০% বা বেশি</span><span><i class="m"></i>৭৫% থেকে ৮৯%</span><span><i class="l"></i>৭৫% এর কম</span></div>`;
  }

  // ================= RENDER: FEES =================
  function renderFees() {
    const box = el('dashFees');
    if (!box) return;
    if (S.errors.feesM) { box.innerHTML = errHtml('বেতনের তথ্য'); return; }
    const f = feeStats();
    if (!f) return;
    const p = todayStr().split('-').map(Number);
    const monthLabel = new Date(Date.UTC(p[0], p[1] - 1, 1)).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const chip = `<span class="dash-chip">${esc(monthLabel)}</span>`;
    if (!f.total) {
      box.innerHTML = head('এ মাসের বেতন', chip) + emptyHtml('বেতনের হিসাব দেখাতে শিক্ষার্থী দরকার', '', 'শিক্ষার্থী যোগ করুন', "teacherTab('students')");
      return;
    }
    if (!f.recorded) {
      box.innerHTML = head('এ মাসের বেতন', chip) + emptyHtml('এ মাসে এখনো কোনো বেতনের হিসাব লেখা হয়নি', 'বেতনের পাতায় পরিশোধিত বা বকেয়া চিহ্নিত করলে আদায়ের হিসাব এখানে দেখা যাবে।', 'বেতনের পাতা', "teacherTab('fees')");
      return;
    }
    const first = !S.done.fees;
    S.done.fees = true;
    const pct = Math.round(f.paid / f.total * 100);
    let extra = '';
    if (S.feesO && !S.errors.feesO) {
      const ids = studentMap();
      const dueList = S.feesO.filter(x => x.status !== 'paid' && ids[x.studentId]);
      if (dueList.length) {
        const amt = dueList.reduce((s, x) => s + (Number(x.amount) || 0), 0);
        extra = `<div class="dash-fee-extra"><span>ভর্তি ও পরীক্ষার ফি বকেয়া</span><b>${bn(dueList.length)}টি, ${money(amt)}</b></div>`;
      }
    }
    box.classList.toggle('dash-anim', first);
    box.innerHTML = head('এ মাসের বেতন', link('বেতনের পাতা', "teacherTab('fees')")) + `
      <div class="dash-fee-row">
        <div><div class="dash-fee-amt">${money(f.collected)}</div><div class="dash-fee-lbl">এ পর্যন্ত আদায় (${esc(monthLabel)})</div></div>
        <div class="dash-fee-pct">${bn(pct)}%</div>
      </div>
      <div class="dash-prog"><i style="width:${pct}%"></i></div>
      <div class="dash-fee-legend"><span>পরিশোধিত ${bn(f.paid)} জন</span><span>বকেয়া ${bn(f.due)} জন</span></div>
      ${extra}`;
  }

  // ================= RENDER: NOTICES =================
  function renderNotices() {
    const box = el('dashNotices');
    if (!box) return;
    if (S.errors.notices) { box.innerHTML = errHtml('নোটিশ'); return; }
    if (!S.notices) return;
    if (!S.notices.length) {
      box.innerHTML = head('সর্বশেষ নোটিশ') + emptyHtml('এখনো কোনো নোটিশ দেওয়া হয়নি', '', 'নোটিশ দিন', "teacherTab('notices')");
      return;
    }
    const rows = S.notices.slice(0, 2).map(n => {
      const d = n.createdAt ? new Date(n.createdAt).toLocaleDateString('bn-BD') : '';
      return `<div class="dash-note"><div class="dash-note-top"><b>${esc(n.title)}</b><span class="dash-note-date">${esc(d)}</span></div><p>${esc(trunc(n.body, 110))}</p></div>`;
    }).join('');
    box.innerHTML = head('সর্বশেষ নোটিশ', link('সব নোটিশ', "teacherTab('notices')")) + `<div class="dash-note-list">${rows}</div>`;
  }

  // ================= RENDER: MERIT TOP 3 =================
  function renderMerit() {
    const box = el('dashMerit');
    if (!box) return;
    const title = 'মেধাতালিকা, সেরা তিনজন';
    if (S.errors.merit) { box.innerHTML = errHtml('মেধাতালিকা'); return; }
    if (!S.merit) return;
    if (S.merit.empty) {
      box.innerHTML = head(title) + emptyHtml('এখনো কোনো রেজাল্ট নেই', 'মার্কশিট সংরক্ষণ করলে সেরা তিনজন এখানে দেখা যাবে।', 'রেজাল্ট তৈরি করুন', "teacherTab('results')");
      return;
    }
    const map = studentMap();
    const byClass = {};
    S.merit.docs.forEach(r => {
      const st = map[r.studentId];
      if (!st) return;
      const c = st.className || 'শ্রেণি নেই';
      (byClass[c] = byClass[c] || []).push({ st, r });
    });
    const classes = orderClasses(Object.keys(byClass));
    S.meritClasses = classes;
    if (!classes.length) {
      box.innerHTML = head(title) + emptyHtml('এই পরীক্ষার কোনো তথ্য পাওয়া যায়নি', '', 'রেজাল্টের পাতা', "teacherTab('results')");
      return;
    }
    if (!meritClassPref || !byClass[meritClassPref]) meritClassPref = classes[0];
    const list = byClass[meritClassPref];
    const ranked = list.filter(x => x.r.meritRank).sort((a, b) => a.r.meritRank - b.r.meritRank).slice(0, 3);
    const anyPass = list.some(x => x.r.totals.grade !== 'F');
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

    const chips = classes.length > 1
      ? `<div class="dash-chips">${classes.map((c, i) => `<button class="dash-chipbtn${c === meritClassPref ? ' on' : ''}" onclick="dashPickMeritClass(${i})">${esc(c)}</button>`).join('')}</div>`
      : '';
    const examLine = `<div class="dash-exam">${esc(S.merit.examName)}${S.merit.academicYear ? ' (শিক্ষাবর্ষ ' + esc(S.merit.academicYear) + ')' : ''}</div>`;
    let body;
    if (ranked.length) {
      body = ranked.map((x, i) => `
        <div class="dash-rank">
          <div class="dash-medal">${medals[i]}</div>
          <div class="dash-rank-body">
            <div class="dash-rank-name">${esc(x.st.name)}</div>
            <div class="dash-rank-meta">রোল ${esc(bn(x.st.roll || '-'))}</div>
          </div>
          <div class="dash-gpa">GPA ${esc(bn(x.r.totals.gpa))}<small>মোট ${bn(x.r.totals.totalObtained)}/${bn(x.r.totals.totalFull)}</small></div>
        </div>`).join('');
    } else if (anyPass) {
      body = `<p class="dash-note-txt">মেধাক্রম এখনো হিসাব করা হয়নি। রেজাল্টের পাতায় গিয়ে "মেধাক্রম হালনাগাদ করুন" বাটন চাপুন।</p>`;
    } else {
      body = `<p class="dash-note-txt">এই শ্রেণির কেউ এই পরীক্ষায় উত্তীর্ণ হয়নি।</p>`;
    }
    box.innerHTML = head(title, link('সব রেজাল্ট', "teacherTab('results')")) + chips + examLine + body;
  }

  window.dashPickMeritClass = function (i) {
    if (!S || !S.meritClasses || !S.meritClasses[i]) return;
    meritClassPref = S.meritClasses[i];
    renderMerit();
  };

  // ================= DATA =================
  function refreshAll() {
    updateHero();
    updateStrip();
    renderLeaves();
    renderClasses();
    renderWeek();
    renderFees();
    renderMerit();
  }

  function loadWeek(tok) {
    const mid = madrasaId;
    for (let i = 1; i <= 6; i++) {
      const ds = dateOffset(i);
      const key = mid + '|' + ds;
      const cached = weekCache[key];
      if (cached && Date.now() - cached.ts < WEEK_TTL_MS) { S.week[ds] = cached.entries; continue; }
      db.collection('attendance').where('madrasaId', '==', mid).where('date', '==', ds).get()
        .then(snap => {
          const entries = snap.docs.map(d => { const x = d.data(); return { studentId: x.studentId, status: x.status }; });
          weekCache[key] = { ts: Date.now(), entries };
          if (tok !== token || !S) return;
          S.week[ds] = entries;
          renderWeek();
        })
        .catch(err => {
          console.error('[dashboard] week', ds, err);
          if (tok !== token || !S) return;
          S.week[ds] = null; // এই দিনটি "তথ্য নেই" হিসেবে দেখাবে
          renderWeek();
        });
    }
  }

  function loadMerit(tok) {
    const mid = madrasaId;
    db.collection('results').where('madrasaId', '==', mid).orderBy('date', 'desc').limit(1).get()
      .then(snap => {
        if (tok !== token) return null;
        if (snap.empty) { S.merit = { empty: true }; renderMerit(); return null; }
        const latest = snap.docs[0].data();
        return db.collection('results').where('madrasaId', '==', mid).where('examName', '==', latest.examName).get()
          .then(s2 => {
            if (tok !== token) return;
            const year = latest.academicYear || '';
            const docs = s2.docs.map(d => d.data())
              .filter(r => (r.academicYear || '') === year && Array.isArray(r.subjects) && r.subjects.length)
              .map(r => ({ studentId: r.studentId, meritRank: r.meritRank || null, totals: computeMarksheetTotals(r.subjects) }));
            S.merit = { examName: latest.examName, academicYear: year, docs };
            renderMerit();
          });
      })
      .catch(err => failure(tok, 'merit', err));
  }

  function failure(tok, key, err) {
    if (tok !== token || !S) return;
    S.errors[key] = true;
    console.error('[dashboard]', key, err);
    if (typeof showDiagBanner === 'function') showDiagBanner('ড্যাশবোর্ড (' + key + ') লোড এরর: ' + (err && err.code ? err.code + ' ' : '') + (err && err.message));
    if (key === 'today') { updateHero(); renderClasses(); renderWeek(); }
    if (key === 'leaves') renderLeaves();
    if (key === 'feesM') renderFees();
    if (key === 'notices') renderNotices();
  }

  function start(tok) {
    const mid = madrasaId;
    const today = todayStr();
    const month = today.slice(0, 7);
    const alive = () => tok === token && S && el('dashboardScreen');

    unsubs.push(db.collection('attendance').where('madrasaId', '==', mid).where('date', '==', today)
      .onSnapshot(snap => {
        if (!alive()) return;
        S.today = snap.docs.map(d => { const x = d.data(); return { studentId: x.studentId, status: x.status, timeLeftHome: x.timeLeftHome || '' }; });
        delete S.errors.today;
        updateHero(); renderClasses(); renderWeek();
      }, err => failure(tok, 'today', err)));

    unsubs.push(db.collection('leaves').where('madrasaId', '==', mid).orderBy('createdAt', 'desc').limit(100)
      .onSnapshot(snap => {
        if (!alive()) return;
        S.leaves = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        delete S.errors.leaves;
        updateStrip(); renderLeaves();
      }, err => failure(tok, 'leaves', err)));

    unsubs.push(db.collection('fees_monthly').where('madrasaId', '==', mid).where('month', '==', month)
      .onSnapshot(snap => {
        if (!alive()) return;
        S.feesM = snap.docs.map(d => d.data());
        delete S.errors.feesM;
        updateStrip(); renderFees();
      }, err => failure(tok, 'feesM', err)));

    unsubs.push(db.collection('fees_onetime').where('madrasaId', '==', mid).orderBy('createdAt', 'desc').limit(200)
      .onSnapshot(snap => {
        if (!alive()) return;
        S.feesO = snap.docs.map(d => d.data());
        delete S.errors.feesO;
        renderFees();
      }, err => { if (tok === token && S) { S.errors.feesO = true; console.error('[dashboard] feesO', err); renderFees(); } }));

    unsubs.push(db.collection('notices').where('madrasaId', '==', mid).orderBy('createdAt', 'desc').limit(3)
      .onSnapshot(snap => {
        if (!alive()) return;
        S.notices = snap.docs.map(d => d.data());
        delete S.errors.notices;
        renderNotices();
      }, err => failure(tok, 'notices', err)));

    loadWeek(tok);
    loadMerit(tok);

    // শিক্ষার্থী তালিকা বদলালে (app.js এর studentsCache নতুন অ্যারে হয়) ড্যাশবোর্ড আপডেট করা
    lastStudents = studentsCache;
    watchTimer = setInterval(() => {
      if (!alive()) { stop(); return; }
      if (studentsCache !== lastStudents) { lastStudents = studentsCache; refreshAll(); }
    }, 600);
  }

  function stop() {
    token++;
    unsubs.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
    unsubs = [];
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
  }

  function render() {
    stop();
    const tok = token;
    S = { today: null, week: {}, leaves: null, feesM: null, feesO: null, notices: null, merit: null, errors: {}, done: {} };
    setScreen(screenHtml());
    const d = el('dashDate');
    if (d) d.textContent = new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    updateStrip();
    start(tok);
  }

  window.renderTeacherDashboard = render;
  window.stopTeacherDashboard = stop;
  window.dashRefresh = function () {
    Object.keys(weekCache).forEach(k => { delete weekCache[k]; });
    render();
  };

  // ================= app.js এর সাথে জোড়া লাগানো =================
  const origTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    stop();
    if (tab === 'home') {
      renderTeacherNav('home');
      render();
      return;
    }
    return origTeacherTab.apply(this, arguments);
  };

  // লগইন বা নিবন্ধনের পর প্রথম পাতা হবে হোম
  window.showTeacherApp = function () { window.teacherTab('home'); };

  const origLogout = window.logout;
  if (typeof origLogout === 'function') {
    window.logout = function () { stop(); return origLogout.apply(this, arguments); };
  }
})();
