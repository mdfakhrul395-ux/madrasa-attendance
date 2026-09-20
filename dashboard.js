/* ShikkhaOS — শিক্ষক ও শিক্ষার্থীর হোম ড্যাশবোর্ড
 *
 * এই ফাইলটি app.js এর ঠিক নিচে লোড হয় (index.html এ):
 *   <script src="app.js"></script>
 *   <script src="dashboard.js"></script>
 *
 * app.js এর একটি অক্ষরও বদলাতে হয় না। এই ফাইল নিজেই:
 *   - শিক্ষক ও শিক্ষার্থী দুইপাশের নিচের মেনুতে "হোম" ট্যাব যোগ করে
 *     (শিক্ষকের "শিক্ষার্থী" ট্যাব এবং শিক্ষার্থীর "নোটিশ" ট্যাব "আরও" মেনুতে চলে যায়)
 *   - লগইন করলে প্রথমে হোম ড্যাশবোর্ড খোলে
 *   - শিক্ষার্থী লগইনে আগে শ্রেণি বেছে তারপর নাম বাছাই করার ব্যবস্থা (সাথে খোঁজার ঘর)
 *   - অ্যাডমিন ছাড়া অন্য শিক্ষক যে ফোনে লগইন করেছেন, সেই ফোনে শিক্ষার্থী লগইন বন্ধ
 *   - সাধারণ শিক্ষক শিক্ষার্থী শুধু যোগ করতে পারেন; সংশোধন ও মোছা শুধু অ্যাডমিনের
 *   - "সেটিংস" ও "পরামর্শ" ট্যাব শুধু অ্যাডমিনের জন্য
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

.dash-who{display:flex;align-items:center;gap:12px;min-width:0}
.dash-me{flex:none;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 2px rgba(224,176,79,.95);display:grid;place-items:center;font-weight:800;font-size:19px}
.dash-cal-head,.dash-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.dash-cal-head span{text-align:center;font-size:11px;font-weight:700;color:var(--mute);padding-bottom:2px}
.dash-day{width:100%;max-width:40px;aspect-ratio:1;justify-self:center;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:700;background:#f1f5f8;color:#94a3b8}
.dash-day.p{background:linear-gradient(#14b8a6,#0f766e);color:#fff}
.dash-day.a{background:#ef6b6b;color:#fff}
.dash-day.f{background:none;box-shadow:inset 0 0 0 1px var(--line);color:#cbd5e1}
.dash-day.t{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--brass)}
.dash-day.blank{visibility:hidden}
.dash-legend .x{background:#dbe3ea}
.dash-badge{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}
.dash-badge.ok{background:#dcfce7;color:var(--ok)}.dash-badge.warn{background:#fef3c7;color:var(--warn)}.dash-badge.bad{background:#fee2e2;color:var(--bad)}.dash-badge.mute{background:#eef2f5;color:var(--mute)}
.dash-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--brass);margin-right:6px;vertical-align:1px}
.dash-diary-row{display:grid;grid-template-columns:34% 1fr;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:13px;line-height:1.55;overflow-wrap:anywhere}
.dash-diary-row b{font-weight:700;color:var(--pine)}
.dash-diary-row span{color:#334155}
.dash-res{display:flex;align-items:center;gap:14px}
.dash-grade{flex:none;width:72px;height:72px;border-radius:22px;display:grid;place-items:center;font-size:28px;font-weight:800}
.dash-res-meta{flex:1;min-width:0}
.dash-res-exam{font-weight:800;font-size:14.5px;color:var(--pine);overflow-wrap:anywhere}
.dash-res-sub{font-size:12px;color:var(--mute);margin-top:1px}
.dash-res-nums{display:flex;gap:16px;margin-top:8px}
.dash-res-nums span{font-size:11px;color:var(--mute);display:flex;flex-direction:column}
.dash-res-nums b{font-size:17px;color:var(--ink);font-weight:800}
.dash-subj-top{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-top:11px}
.dash-subj-bar{height:7px;border-radius:99px;background:#eef2f5;overflow:hidden;margin-top:5px}
.dash-subj-bar i{display:block;height:100%;border-radius:99px;transform-origin:left}
.dash-anim .dash-subj-bar i{animation:dashFill 1s cubic-bezier(.22,1,.36,1) both}
.dash-trend{margin-top:16px;padding-top:12px;border-top:1px solid var(--line)}
.dash-spark{width:100%;height:auto;display:block;margin-top:6px}
.dash-due{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:13.5px}
.dash-due b{color:var(--bad);font-size:13px}

/* শিক্ষার্থী লগইন */
.slogin{padding:4px 0 24px;color:#1e293b}
.slogin .sl-head{margin:8px 2px 4px}
.slogin .sl-title{font-size:22px;font-weight:800;color:#0a3a35}
.slogin .sl-sub{font-size:13.5px;color:#64748b;margin-top:3px;line-height:1.5}
.slogin .sl-label{font-size:13px;font-weight:800;color:#0a3a35;margin:18px 2px 8px}
.slogin .sl-chips{display:flex;flex-wrap:wrap;gap:8px}
.slogin .sl-chip{width:auto;margin:0;padding:10px 14px;border:0;border-radius:14px;background:#fff;color:#334155;font-size:14.5px;font-weight:700;box-shadow:0 0 0 1px #e2e8f0;display:inline-flex;align-items:center;gap:8px}
.slogin .sl-chip small{font-size:11.5px;font-weight:700;background:#eef2f5;color:#64748b;border-radius:99px;padding:1px 8px}
.slogin .sl-chip.on{background:#0a3a35;color:#fff;box-shadow:none}
.slogin .sl-chip.on small{background:rgba(255,255,255,.2);color:#fff}
.slogin .sl-skel{width:96px;height:42px;border-radius:14px;background:linear-gradient(90deg,#eef2f5 25%,#f8fafc 40%,#eef2f5 60%);background-size:400% 100%;animation:dashShimmer 1.4s infinite}
.slogin .sl-search{margin:0 0 4px;padding:12px 14px;border-radius:14px;background:#fff;border:0;box-shadow:0 0 0 1px #e2e8f0;font-size:15px}
.slogin .sl-list{display:grid;gap:8px;margin-top:8px}
.slogin .sl-stu{display:flex;align-items:center;gap:12px;width:100%;margin:0;padding:11px 12px;border:0;border-radius:16px;background:#fff;color:#1e293b;text-align:left;font-weight:600;box-shadow:0 0 0 1px #e2e8f0}
.slogin .sl-stu.on{background:#e7f5f2;box-shadow:0 0 0 2px #0f766e}
.slogin .sl-av{flex:none;width:40px;height:40px;border-radius:50%;background:#e3f3f0;color:#0f766e;display:grid;place-items:center;font-weight:800;font-size:17px}
.slogin .sl-stu.on .sl-av{background:#0f766e;color:#fff}
.slogin .sl-nm{flex:1;min-width:0;display:flex;flex-direction:column}
.slogin .sl-nm b{font-size:15px;font-weight:700;overflow-wrap:anywhere}
.slogin .sl-nm small{font-size:12px;color:#64748b;font-weight:500}
.slogin .sl-ck{flex:none;width:24px;text-align:center;color:#0f766e;font-weight:800;font-size:18px}
.slogin .sl-note{font-size:13px;color:#64748b;line-height:1.6;padding:10px 4px}
.slogin .sl-link{width:auto;margin:8px 0 0;padding:6px 2px;border:0;background:none;color:#0f766e;font-size:13px;font-weight:700;text-decoration:underline}
.slogin .sl-pin{margin-top:16px;background:#fff;border-radius:20px;padding:16px;box-shadow:0 0 0 1px #e2e8f0}
.slogin .sl-pin-who{font-size:16px;font-weight:800;color:#0a3a35}
.slogin .sl-pin input{text-align:center;font-size:22px;letter-spacing:10px;padding:12px}

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
  let mode = 'teacher'; // এখন কোন ড্যাশবোর্ড খোলা: 'teacher' | 'student'
  const weekCache = {};

  const bn = n => toBanglaNumeral(n);
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const trunc = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const money = n => '৳ ' + bn(Math.round(Number(n) || 0).toLocaleString('en-US'));
  const cmpBn = (a, b) => String(a).localeCompare(String(b), 'bn');
  // অ্যাডমিন শিক্ষক (এবং সুপার অ্যাডমিন)। সাধারণ শিক্ষক শিক্ষার্থী শুধু যোগ করতে পারেন, সংশোধন বা মুছতে পারেন না
  const isAdminTeacher = () => !!((typeof myTeacherIsAdmin !== 'undefined' && myTeacherIsAdmin) || (typeof isSuperAdminUser !== 'undefined' && isSuperAdminUser));
  // শ্রেণির স্বাভাবিক ক্রম: প্রথম, দ্বিতীয়, তৃতীয় ... বা ১ম, ২য় ... বা ক্লাস ১, ২ ...
  const CLASS_WORDS = [['একাদশ', 11], ['দ্বাদশ', 12], ['প্রথম', 1], ['দ্বিতীয়', 2], ['তৃতীয়', 3], ['চতুর্থ', 4], ['পঞ্চম', 5], ['ষষ্ঠ', 6], ['সপ্তম', 7], ['অষ্টম', 8], ['নবম', 9], ['দশম', 10]];
  function classRank(name) {
    const t = String(name || '');
    if (t === 'শ্রেণি নেই') return 2000;
    for (let i = 0; i < CLASS_WORDS.length; i++) if (t.indexOf(CLASS_WORDS[i][0]) > -1) return CLASS_WORDS[i][1];
    const m = t.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).match(/\d+/);
    return m ? Number(m[0]) : 1000;
  }
  const classCmp = (a, b) => classRank(a) - classRank(b) || cmpBn(a, b);
  const fmtDay = ds => {
    if (!ds) return '';
    const p = String(ds).split('-').map(Number);
    if (p.length !== 3 || p.some(isNaN)) return bn(ds);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  function dateOffset(off) {
    const p = todayStr().split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] - off)).toISOString().slice(0, 10);
  }
  function weekdayShort(ds) {
    const p = ds.split('-').map(Number);
    return WEEKDAY_SHORT[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
  }
  // শ্রেণিগুলো স্বাভাবিক ক্রমে সাজানো
  function orderClasses(keys) {
    return keys.slice().sort(classCmp);
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
      const meta = [st && st.className ? esc(st.className) : '', l.date ? esc(fmtDay(l.date)) : ''].filter(Boolean).map(x => `<span>${x}</span>`).join(' &nbsp; ');
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
    mode = 'teacher';
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
    if (mode === 'student') window.renderStudentDashboard(); else render();
  };

  // =====================================================================
  //                    শিক্ষার্থীর হোম ড্যাশবোর্ড
  // app.js এর শিক্ষার্থী-পাশের যে কোয়েরিগুলো আগে থেকেই চলছে, ঠিক সেগুলোই এখানে
  // ব্যবহার করা হয়েছে (studentId দিয়ে ফিল্টার), তাই নতুন কোনো Firestore rule লাগে না।
  // =====================================================================
  let T = null; // শিক্ষার্থীর ড্যাশবোর্ডের ডেটা

  const CAL_HEAD = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র'];
  const monthLabel = ym => {
    const p = ym.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, 1)).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const LEAVE_STATUS = {
    pending: ['অপেক্ষমাণ', 'warn'],
    approved: ['অনুমোদিত', 'ok'],
    rejected: ['প্রত্যাখ্যাত', 'bad']
  };

  function stuScreenHtml() {
    return `
<div id="studentDashScreen" class="dash">
  <section class="dash-hero">
    <div class="dash-hero-top">
      <div class="dash-who">
        <div class="dash-me" id="sdAvatar">?</div>
        <div>
          <div class="dash-greet" id="sdName">আসসালামু আলাইকুম</div>
          <div class="dash-date" id="sdMeta"></div>
        </div>
      </div>
      <button class="dash-refresh" onclick="dashRefresh()" aria-label="নতুন করে লোড করুন">↻</button>
    </div>
    <div class="dash-hero-main">
      <div class="dash-ring-wrap">
        <svg class="dash-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="dash-ring-bg" cx="60" cy="60" r="${RING_R}"/>
          <circle id="sdRingFg" class="dash-ring-fg" cx="60" cy="60" r="${RING_R}" transform="rotate(-90 60 60)" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>
        </svg>
        <div class="dash-ring-center">
          <div class="dash-ring-pct"><span id="sdRingN">–</span><small id="sdRingU" style="display:none">%</small></div>
          <div class="dash-ring-cap">এ মাসে</div>
        </div>
      </div>
      <div class="dash-hero-stats">
        <div class="dash-hs"><span><i class="p"></i>উপস্থিত দিন</span><b id="sdP">–</b></div>
        <div class="dash-hs"><span><i class="a"></i>অনুপস্থিত দিন</span><b id="sdA">–</b></div>
        <div class="dash-hs"><span><i class="u"></i>টানা উপস্থিতি</span><b id="sdS">–</b></div>
      </div>
    </div>
    <div class="dash-hero-foot">
      <div class="dash-hero-status" id="sdStatus">তথ্য লোড হচ্ছে...</div>
      <button class="dash-cta" id="sdCta" style="display:none" onclick="studentTab('attendance')">সময় দিন</button>
    </div>
  </section>

  <div class="dash-strip">
    <button class="dash-cell" onclick="studentTab('results')"><b id="sdC_gpa">–</b><span>সর্বশেষ GPA</span></button>
    <button class="dash-cell" onclick="studentTab('results')"><b id="sdC_rank">–</b><span>মেধাক্রম</span></button>
    <button class="dash-cell" id="sdCell_due" onclick="studentTab('fees')"><b id="sdC_due">–</b><span>বকেয়া (টাকা)</span></button>
    <button class="dash-cell" id="sdCell_new" onclick="studentTab('notices')"><b id="sdC_new">–</b><span>নতুন নোটিশ</span></button>
  </div>

  <div class="dash-actions">
    <button class="dash-act main" onclick="studentTab('attendance')"><span class="dash-act-ic">\u23F0</span>বের হওয়ার সময়</button>
    <button class="dash-act" onclick="studentTab('leaves')"><span class="dash-act-ic">\u{1F4C5}</span>ছুটির আবেদন</button>
    <button class="dash-act" onclick="studentTab('fees')"><span class="dash-act-ic">\u{1F4B0}</span>বেতন</button>
    <button class="dash-act" onclick="studentTab('suggestions')"><span class="dash-act-ic">\u{1F4AC}</span>পরামর্শ</button>
  </div>

  <section class="dash-sec attn" id="sdDiary">${skel(120)}</section>
  <section class="dash-sec" id="sdCal">${skel(230)}</section>
  <section class="dash-sec" id="sdResult">${skel(170)}</section>
  <section class="dash-sec" id="sdFees">${skel(100)}</section>
  <section class="dash-sec" id="sdNotices">${skel(80)}</section>
  <section class="dash-sec" id="sdLeaves">${skel(80)}</section>
</div>`;
  }

  // ---------- হিসাব ----------
  function stuAttMap() {
    const m = {};
    (T.att || []).forEach(e => { if (e.date) m[e.date] = e; });
    return m;
  }
  function stuAttSummary() {
    const today = todayStr(), month = today.slice(0, 7);
    const marked = (T.att || []).filter(e => e.date && e.date <= today && (e.status === 'present' || e.status === 'absent'));
    let p = 0, a = 0;
    marked.forEach(e => { if (e.date.startsWith(month)) { if (e.status === 'present') p++; else a++; } });
    const desc = marked.slice().sort((x, y) => y.date.localeCompare(x.date));
    let streak = 0;
    for (let i = 0; i < desc.length; i++) { if (desc[i].status === 'present') streak++; else break; }
    return { p, a, rate: (p + a) ? Math.round(p / (p + a) * 100) : null, streak };
  }
  function stuLatestResult() {
    if (!T.results || !T.results.length) return null;
    return T.results.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  }
  function stuDue() {
    const items = [];
    (T.feesM || []).slice().sort((a, b) => (b.month || '').localeCompare(a.month || '')).forEach(f => {
      if (f.status !== 'paid') items.push({ label: f.month ? monthLabel(f.month) : 'মাসিক বেতন', amount: Number(f.amount) || 0 });
    });
    (T.feesO || []).forEach(f => {
      if (f.status !== 'paid') items.push({ label: f.feeType || 'ফি', amount: Number(f.amount) || 0 });
    });
    const has = (T.feesM || []).length + (T.feesO || []).length > 0;
    return { items, total: items.reduce((s, x) => s + x.amount, 0), has };
  }
  function stuUnread() {
    const seen = Number(localStorage.getItem(typeof noticesSeenKey === 'function' ? noticesSeenKey() : 'x') || 0);
    return (T.notices || []).filter(n => (n.createdAt || 0) > seen);
  }

  // ---------- হিরো ও স্ট্রিপ ----------
  function updateStuHero() {
    const ring = el('sdRingFg');
    if (!ring) return;
    const me = studentsCache.find(s => s.id === myStudentId);
    if (me) {
      el('sdName').textContent = me.name;
      el('sdAvatar').textContent = Array.from(me.name || '?')[0];
      el('sdMeta').innerHTML = [me.className ? esc(me.className) : '', me.roll ? 'রোল ' + esc(bn(me.roll)) : ''].filter(Boolean).join(' &nbsp; ');
    }
    const status = el('sdStatus'), cta = el('sdCta');
    if (T.errors.att) { status.textContent = 'উপস্থিতির তথ্য লোড করা যায়নি'; cta.style.display = 'none'; return; }
    if (!T.att) return;
    const sm = stuAttSummary();
    setNum('sdP', sm.p);
    setNum('sdA', sm.a);
    setNum('sdS', sm.streak);
    const n = el('sdRingN'), u = el('sdRingU');
    if (sm.rate == null) { n.textContent = '–'; delete n.dataset.val; u.style.display = 'none'; }
    else { u.style.display = ''; setNum('sdRingN', sm.rate); }
    ring.style.strokeDashoffset = sm.rate == null ? RING_C : RING_C * (1 - sm.rate / 100);

    const te = stuAttMap()[todayStr()];
    const left = te && te.timeLeftHome ? bn(te.timeLeftHome) : '';
    let msg;
    if (te && te.status === 'present') msg = 'আজ আপনি উপস্থিত' + (left ? ', বাসা থেকে বের হয়েছেন ' + left : '');
    else if (te && te.status === 'absent') msg = 'আজ অনুপস্থিত হিসেবে চিহ্নিত' + (te.reason ? ' (' + trunc(te.reason, 30) + ')' : '');
    else msg = 'আজকের হাজিরা এখনো নেওয়া হয়নি' + (left ? ', বের হওয়ার সময় ' + left : '');
    status.textContent = msg;
    cta.style.display = (left || (te && te.status === 'absent')) ? 'none' : '';
  }

  function updateStuStrip() {
    if (!el('sdC_gpa')) return;
    if (T.results) {
      const r = stuLatestResult();
      const has = r && Array.isArray(r.subjects) && r.subjects.length;
      el('sdC_gpa').textContent = has ? bn(computeMarksheetTotals(r.subjects).gpa) : '–';
      el('sdC_rank').textContent = r && r.meritRank ? banglaOrdinal(r.meritRank) : '–';
    }
    if (T.feesM && T.feesO) {
      const d = stuDue();
      const c = el('sdC_due');
      if (d.has) { c.textContent = bn(Math.round(d.total).toLocaleString('en-US')); cellState('sdCell_due', d.total > 0 ? 'bad' : ''); }
      else { c.textContent = '–'; cellState('sdCell_due', ''); }
    }
    if (T.notices) {
      const n = stuUnread().length;
      el('sdC_new').textContent = n >= 5 ? bn(5) + '+' : bn(n);
      cellState('sdCell_new', n > 0 ? 'warn' : '');
    }
  }

  // ---------- ডায়েরি ----------
  function renderStuDiary() {
    const box = el('sdDiary');
    if (!box) return;
    if (T.errors.diary) { box.classList.remove('attn'); box.innerHTML = errHtml('ডায়েরি'); return; }
    if (!T.diary) return;
    if (!T.diary.length) {
      box.classList.remove('attn');
      box.innerHTML = head('ডায়েরি') + emptyHtml('এখনো কোনো ডায়েরি দেওয়া হয়নি', 'শিক্ষক পড়া বা হোমওয়ার্ক দিলে এখানে দেখা যাবে।');
      return;
    }
    box.classList.add('attn');
    const r = T.diary[0];
    const isToday = r.date === todayStr();
    let rows = '';
    let count = 0;
    if (r.subjects && typeof r.subjects === 'object' && Object.keys(r.subjects).length) {
      const known = DIARY_SUBJECTS.concat(LEGACY_DIARY_SUBJECTS);
      const filled = known.filter(k => (r.subjects[k] || '').trim())
        .concat(Object.keys(r.subjects).filter(k => known.indexOf(k) === -1 && (r.subjects[k] || '').trim()));
      count = filled.length;
      rows = filled.slice(0, 4).map(k => `<div class="dash-diary-row"><b>${esc(k)}</b><span>${esc(trunc(r.subjects[k], 90)).replace(/\n/g, '<br>')}</span></div>`).join('');
      if (count > 4) rows += `<div class="dash-note-txt" style="padding-top:8px">আরও ${bn(count - 4)}টি বিষয় আছে</div>`;
    } else {
      rows = `<div class="dash-diary-row"><span style="grid-column:1/-1">${esc(trunc(r.text || '', 160)).replace(/\n/g, '<br>')}</span></div>`;
    }
    const day = (r.dayName ? esc(r.dayName) + ', ' : '') + esc(fmtDay(r.date));
    const chip = isToday ? '<span class="dash-chip">আজকের</span>' : '';
    const attach = r.attachmentDataUrl ? `<div class="dash-note-txt" style="padding-top:8px">\u{1F4CE} সংযুক্তি আছে, ডায়েরির পাতায় দেখুন</div>` : '';
    box.innerHTML = head(isToday ? 'আজকের পড়া' : 'সর্বশেষ ডায়েরি', link('সব ডায়েরি', "studentTab('diary')"))
      + `<div class="dash-exam">${day} ${chip}</div>` + rows + attach;
  }

  // ---------- ক্যালেন্ডার ----------
  function renderStuCal() {
    const box = el('sdCal');
    if (!box) return;
    if (T.errors.att) { box.innerHTML = errHtml('উপস্থিতি'); return; }
    if (!T.att) return;
    const today = todayStr();
    const p = today.split('-').map(Number);
    const y = p[0], m = p[1];
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const startCol = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 1) % 7; // শনিবার থেকে শুরু
    const map = stuAttMap();
    let cells = '';
    for (let i = 0; i < startCol; i++) cells += '<span class="dash-day blank"></span>';
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const e = map[ds];
      let cls = 'n';
      if (ds > today) cls = 'f';
      else if (e && e.status === 'present') cls = 'p';
      else if (e && e.status === 'absent') cls = 'a';
      cells += `<span class="dash-day ${cls}${ds === today ? ' t' : ''}">${bn(d)}</span>`;
    }
    const sm = stuAttSummary();
    const chip = sm.rate != null ? `<span class="dash-chip">হার ${bn(sm.rate)}%</span>` : '';
    const first = !T.done.cal;
    T.done.cal = true;
    box.classList.toggle('dash-anim', first);
    box.innerHTML = head(monthLabel(today.slice(0, 7)), chip)
      + `<div class="dash-cal-head">${CAL_HEAD.map(h => `<span>${h}</span>`).join('')}</div><div class="dash-cal">${cells}</div>`
      + `<div class="dash-legend"><span><i class="g"></i>উপস্থিত</span><span><i class="l"></i>অনুপস্থিত</span><span><i class="x"></i>তথ্য নেই</span></div>`;
  }

  // ---------- রেজাল্ট ----------
  function sparkline(vals) {
    const W = 240, H = 58, padX = 16, padTop = 18, padBot = 6, n = vals.length;
    const lo = Math.max(0, Math.min.apply(null, vals) - 0.5);
    const hi = Math.min(5, Math.max.apply(null, vals) + 0.5);
    const span = Math.max(0.5, hi - lo);
    const pts = vals.map((v, i) => {
      const x = n === 1 ? W / 2 : padX + i * (W - 2 * padX) / (n - 1);
      const y = padTop + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / span) * (H - padTop - padBot);
      return [x, y, v];
    });
    const line = pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    const dots = pts.map((q, i) => {
      const last = i === n - 1;
      return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${last ? 4.5 : 3.2}" fill="${last ? '#e0b04f' : '#fff'}" stroke="#0f766e" stroke-width="2"/>`
        + `<text x="${q[0].toFixed(1)}" y="${Math.max(10, q[1] - 8).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">${bn(Number(q[2]).toFixed(2))}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="dash-spark" aria-hidden="true"><polyline points="${line}" fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
  }

  function renderStuResult() {
    const box = el('sdResult');
    if (!box) return;
    const title = 'সর্বশেষ রেজাল্ট';
    if (T.errors.results) { box.innerHTML = errHtml('রেজাল্ট'); return; }
    if (!T.results) return;
    const r = stuLatestResult();
    if (!r) {
      box.innerHTML = head(title) + emptyHtml('এখনো কোনো রেজাল্ট প্রকাশ করা হয়নি', 'শিক্ষক প্রকাশ করলে এখানে দেখতে পাবেন।');
      return;
    }
    const more = link('পূর্ণ মার্কশিট', "studentTab('results')");
    const has = Array.isArray(r.subjects) && r.subjects.length;
    if (!has) {
      box.innerHTML = head(title, more) + `<div class="dash-res-exam">${esc(r.examName || '')}</div><div class="dash-note-txt">প্রাপ্ত নম্বর: ${esc(bn(r.marks !== undefined ? r.marks : '-'))}</div>`;
      return;
    }
    const t = computeMarksheetTotals(r.subjects);
    const gc = gradeColor(t.grade);
    const rank = r.meritRank ? `<span class="dash-chip">মেধাক্রম ${banglaOrdinal(r.meritRank)}${r.meritTotal ? ' / ' + bn(r.meritTotal) : ''}</span>` : '';
    const fail = t.hasFailedSubject ? '<span class="dash-badge bad">অকৃতকার্য</span>' : '';
    const shown = r.subjects.slice(0, 6);
    const bars = shown.map((s, i) => {
      const pct = s.full > 0 ? s.obtained / s.full * 100 : 0;
      const sg = gradeFromPercent(pct);
      return `<div class="dash-subj"><div class="dash-subj-top"><span>${esc(s.name)}</span><span><b>${bn(s.obtained)}</b>/${bn(s.full)} &nbsp;<em style="font-style:normal;color:${gradeColor(sg.grade).fg};font-weight:800">${esc(sg.grade)}</em></span></div>`
        + `<div class="dash-subj-bar"><i style="width:${Math.max(3, Math.round(pct))}%;background:${gradeColor(sg.grade).fg};animation-delay:${i * 60}ms"></i></div></div>`;
    }).join('');
    const rest = r.subjects.length > shown.length ? `<div class="dash-note-txt" style="padding-top:10px">আরও ${bn(r.subjects.length - shown.length)}টি বিষয় মার্কশিটে আছে</div>` : '';

    let trend = '';
    const withSubj = T.results.filter(x => Array.isArray(x.subjects) && x.subjects.length).sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(-5);
    if (withSubj.length >= 2) {
      trend = `<div class="dash-trend"><div class="dash-exam">GPA-এর ধারা (সর্বশেষ ${bn(withSubj.length)}টি পরীক্ষা)</div>${sparkline(withSubj.map(x => Number(computeMarksheetTotals(x.subjects).gpa)))}</div>`;
    }
    const first = !T.done.result;
    T.done.result = true;
    box.classList.toggle('dash-anim', first);
    box.innerHTML = head(title, more) + `
      <div class="dash-res">
        <div class="dash-grade" style="background:${gc.bg};color:${gc.fg}">${esc(t.grade)}</div>
        <div class="dash-res-meta">
          <div class="dash-res-exam">${esc(r.examName || '')}</div>
          <div class="dash-res-sub">${r.academicYear ? 'শিক্ষাবর্ষ ' + esc(bn(r.academicYear)) : ''}</div>
          <div class="dash-res-nums"><span><b>${bn(t.gpa)}</b>GPA</span><span><b>${bn(t.percentage)}%</b>শতাংশ</span><span><b>${bn(t.totalObtained)}</b>মোট নম্বর</span></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${rank}${fail}</div>
      <div style="margin-top:6px">${bars}${rest}</div>${trend}`;
  }

  // ---------- বেতন ----------
  function renderStuFees() {
    const box = el('sdFees');
    if (!box) return;
    if (T.errors.feesM) { box.innerHTML = errHtml('বেতনের তথ্য'); return; }
    if (!T.feesM || !T.feesO) return;
    const month = todayStr().slice(0, 7);
    const cur = T.feesM.find(f => f.month === month);
    const chip = cur
      ? `<span class="dash-badge ${cur.status === 'paid' ? 'ok' : 'bad'}">এ মাস: ${cur.status === 'paid' ? 'পরিশোধিত' : 'বকেয়া'}</span>`
      : '<span class="dash-badge mute">এ মাস: হিসাব নেই</span>';
    const d = stuDue();
    const title = 'বেতন ও ফি';
    if (!d.has) {
      box.innerHTML = head(title, chip) + emptyHtml('বেতনের তথ্য এখনো যোগ করা হয়নি', 'শিক্ষক হিসাব লিখলে এখানে দেখতে পাবেন।');
      return;
    }
    if (!d.items.length) {
      box.innerHTML = head(title, chip) + `<div class="dash-empty"><div class="dash-empty-ic">\u2713</div><div><b>সব বেতন ও ফি পরিশোধিত</b></div></div>`;
      return;
    }
    const rows = d.items.slice(0, 4).map(x => `<div class="dash-due"><span>${esc(x.label)}</span><b>${x.amount > 0 ? money(x.amount) : 'পরিমাণ নির্ধারিত নয়'}</b></div>`).join('');
    const rest = d.items.length > 4 ? `<div class="dash-note-txt" style="padding-top:8px">আরও ${bn(d.items.length - 4)}টি বকেয়া আছে</div>` : '';
    box.innerHTML = head(title, chip) + `
      <div class="dash-fee-amt" style="color:var(--bad)">${money(d.total)}</div>
      <div class="dash-fee-lbl">মোট বকেয়া (${bn(d.items.length)}টি)</div>
      <div style="margin-top:10px">${rows}${rest}</div>`;
  }

  // ---------- নোটিশ ----------
  function renderStuNotices() {
    const box = el('sdNotices');
    if (!box) return;
    if (T.errors.notices) { box.innerHTML = errHtml('নোটিশ'); return; }
    if (!T.notices) return;
    if (!T.notices.length) { box.innerHTML = head('নোটিশ') + emptyHtml('এখনো কোনো নোটিশ নেই'); return; }
    const seen = Number(localStorage.getItem(typeof noticesSeenKey === 'function' ? noticesSeenKey() : 'x') || 0);
    const rows = T.notices.slice(0, 2).map(n => {
      const d = n.createdAt ? new Date(n.createdAt).toLocaleDateString('bn-BD') : '';
      const dot = (n.createdAt || 0) > seen ? '<i class="dash-dot"></i>' : '';
      return `<div class="dash-note"><div class="dash-note-top"><b>${dot}${esc(n.title)}</b><span class="dash-note-date">${esc(d)}</span></div><p>${esc(trunc(n.body, 110))}</p></div>`;
    }).join('');
    box.innerHTML = head('সর্বশেষ নোটিশ', link('সব নোটিশ', "studentTab('notices')")) + `<div class="dash-note-list">${rows}</div>`;
  }

  // ---------- ছুটি ----------
  function renderStuLeaves() {
    const box = el('sdLeaves');
    if (!box) return;
    if (T.errors.leaves) { box.innerHTML = errHtml('ছুটির আবেদন'); return; }
    if (!T.leaves) return;
    const title = 'আমার ছুটির আবেদন';
    if (!T.leaves.length) {
      box.innerHTML = head(title) + emptyHtml('কোনো আবেদন করা হয়নি', '', 'ছুটির আবেদন করুন', "studentTab('leaves')");
      return;
    }
    const list = T.leaves.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 2);
    const rows = list.map(l => {
      const st = LEAVE_STATUS[l.status || 'pending'] || LEAVE_STATUS.pending;
      return `<div class="dash-note"><div class="dash-note-top"><b>${esc(fmtDay(l.date))}</b><span class="dash-badge ${st[1]}">${st[0]}</span></div><p>${esc(trunc(l.reason, 90))}</p></div>`;
    }).join('');
    box.innerHTML = head(title, link('নতুন আবেদন', "studentTab('leaves')")) + `<div class="dash-note-list">${rows}</div>`;
  }

  function refreshStuAll() {
    updateStuHero();
    updateStuStrip();
    renderStuDiary();
    renderStuCal();
    renderStuResult();
    renderStuFees();
    renderStuNotices();
    renderStuLeaves();
  }

  // ---------- ডেটা ----------
  function stuFail(tok, key, err) {
    if (tok !== token || !T) return;
    T.errors[key] = true;
    console.error('[dashboard/student]', key, err);
    if (typeof showDiagBanner === 'function') showDiagBanner('শিক্ষার্থী ড্যাশবোর্ড (' + key + ') লোড এরর: ' + (err && err.code ? err.code + ' ' : '') + (err && err.message));
    refreshStuAll();
  }

  function ensureStuDiary(tok) {
    if (!T || T.diaryStarted) return;
    const me = studentsCache.find(s => s.id === myStudentId);
    if (!me) return; // শিক্ষার্থী তালিকা লোড হওয়ার অপেক্ষা
    if (!me.className) { T.diary = []; renderStuDiary(); T.diaryStarted = true; return; }
    T.diaryStarted = true;
    unsubs.push(db.collection('diary').where('madrasaId', '==', madrasaId).where('className', '==', me.className).orderBy('createdAt', 'desc').limit(3)
      .onSnapshot(snap => {
        if (tok !== token || !T) return;
        T.diary = snap.docs.map(d => d.data());
        delete T.errors.diary;
        renderStuDiary();
      }, err => stuFail(tok, 'diary', err)));
  }

  function startStudent(tok) {
    const sid = myStudentId, mid = madrasaId;
    const alive = () => tok === token && T && el('studentDashScreen');

    unsubs.push(db.collection('attendance').where('studentId', '==', sid)
      .onSnapshot(snap => {
        if (!alive()) return;
        T.att = snap.docs.map(d => d.data());
        delete T.errors.att;
        updateStuHero(); renderStuCal();
      }, err => stuFail(tok, 'att', err)));

    unsubs.push(db.collection('results').where('studentId', '==', sid).where('published', '==', true)
      .onSnapshot(snap => {
        if (!alive()) return;
        T.results = snap.docs.map(d => d.data());
        delete T.errors.results;
        updateStuStrip(); renderStuResult();
      }, err => stuFail(tok, 'results', err)));

    unsubs.push(db.collection('fees_monthly').where('studentId', '==', sid)
      .onSnapshot(snap => {
        if (!alive()) return;
        T.feesM = snap.docs.map(d => d.data());
        delete T.errors.feesM;
        updateStuStrip(); renderStuFees();
      }, err => stuFail(tok, 'feesM', err)));

    unsubs.push(db.collection('fees_onetime').where('studentId', '==', sid)
      .onSnapshot(snap => {
        if (!alive()) return;
        T.feesO = snap.docs.map(d => d.data());
        updateStuStrip(); renderStuFees();
      }, err => {
        if (tok !== token || !T) return;
        console.error('[dashboard/student] feesO', err);
        T.feesO = []; updateStuStrip(); renderStuFees();
      }));

    unsubs.push(db.collection('notices').where('madrasaId', '==', mid).orderBy('createdAt', 'desc').limit(5)
      .onSnapshot(snap => {
        if (!alive()) return;
        T.notices = snap.docs.map(d => d.data());
        delete T.errors.notices;
        updateStuStrip(); renderStuNotices();
      }, err => stuFail(tok, 'notices', err)));

    unsubs.push(db.collection('leaves').where('studentId', '==', sid)
      .onSnapshot(snap => {
        if (!alive()) return;
        T.leaves = snap.docs.map(d => d.data());
        delete T.errors.leaves;
        renderStuLeaves();
      }, err => stuFail(tok, 'leaves', err)));

    ensureStuDiary(tok);

    // শিক্ষার্থী তালিকা (নাম/শ্রেণি) দেরিতে এলে হিরো ও ডায়েরি হালনাগাদ করা
    lastStudents = studentsCache;
    watchTimer = setInterval(() => {
      if (!alive()) { stop(); return; }
      if (studentsCache !== lastStudents) {
        lastStudents = studentsCache;
        updateStuHero();
        ensureStuDiary(tok);
      }
    }, 600);
  }

  function renderStudent() {
    stop();
    mode = 'student';
    const tok = token;
    T = { att: null, results: null, feesM: null, feesO: null, notices: null, leaves: null, diary: null, diaryStarted: false, errors: {}, done: {} };
    setScreen(stuScreenHtml());
    updateStuHero();
    startStudent(tok);
  }
  window.renderStudentDashboard = renderStudent;

  // নিচের মেনু: "হোম" যোগ, "নোটিশ" চলে যায় "আরও" মেনুতে (নোটিশের নতুন-সংখ্যা সেখানেও দেখা যায়)
  if (typeof studentPrimaryTabs !== 'undefined' && !studentPrimaryTabs.some(t => t.key === 'home')) {
    studentPrimaryTabs.unshift({ key: 'home', label: 'হোম', icon: '\u{1F3E0}' });
    const ni = studentPrimaryTabs.findIndex(t => t.key === 'notices');
    if (ni > -1) studentMoreTabs.unshift(studentPrimaryTabs.splice(ni, 1)[0]);
  }

  const origStudentTab = window.studentTab;
  if (typeof origStudentTab === 'function') {
    window.studentTab = function (tab) {
      stop();
      if (tab === 'home') {
        currentStudentTab = 'home';
        renderStudentNav('home');
        renderStudent();
        return;
      }
      return origStudentTab.apply(this, arguments);
    };
    window.showStudentApp = function () {
      startUnreadListeners();
      window.studentTab('home');
    };
  }

  // =====================================================================
  //            শিক্ষার্থী লগইন: আগে শ্রেণি, তারপর নাম, তারপর PIN
  // app.js এর confirmStudentPick() একটুও বদলানো হয়নি — সেটি আগের মতোই
  // #studentPick, #studentPinInput ও #pinError খোঁজে, তাই এই তিনটি আইডি রাখা হয়েছে।
  // =====================================================================
  let slClass = null;      // বাছাই করা শ্রেণি ('' মানে শ্রেণিহীন)
  let slSel = null;        // বাছাই করা শিক্ষার্থীর id
  let slQuery = '';
  let slLast = null;
  let slTimer = null;
  let slClassList = [];

  function slRollCmp(a, b) {
    const ra = a.roll == null ? '' : String(a.roll), rb = b.roll == null ? '' : String(b.roll);
    const na = Number(ra), nb = Number(rb);
    if (ra !== '' && rb !== '' && !isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return ra.localeCompare(rb, 'bn') || String(a.name).localeCompare(String(b.name), 'bn');
  }
  function slClasses() {
    const list = Array.from(new Set(studentsCache.map(s => s.className).filter(Boolean))).sort(classCmp);
    if (studentsCache.some(s => !s.className)) list.push('');
    return list;
  }
  function slInClass() {
    return studentsCache.filter(s => (s.className || '') === slClass).sort(slRollCmp);
  }

  function slShell() {
    return `
<div id="studentPickerScreen" class="slogin">
  <div class="sl-head">
    <div class="sl-title">শিক্ষার্থী লগইন</div>
    <div class="sl-sub">আপনার শ্রেণি বেছে নিন, তারপর নিজের নামে চাপ দিন</div>
  </div>
  <div class="sl-label">আপনার শ্রেণি</div>
  <div id="slClasses" class="sl-chips"></div>
  <div id="slStudentsWrap"></div>
  <div id="slPinWrap"></div>
  <select id="studentPick" style="display:none"></select>
  <button class="secondary" onclick="logout()" style="margin-top:16px">ফিরে যান</button>
</div>`;
  }

  function slPaintClasses() {
    const box = el('slClasses');
    if (!box) return;
    slClassList = slClasses();
    if (!studentsCache.length) {
      box.innerHTML = '<div class="sl-skel"></div><div class="sl-skel"></div><div class="sl-skel"></div>';
      return;
    }
    box.innerHTML = slClassList.map((c, i) => {
      const n = studentsCache.filter(s => (s.className || '') === c).length;
      return `<button class="sl-chip${c === slClass ? ' on' : ''}" onclick="slPickClass(${i})">${esc(c || 'শ্রেণি নেই')}<small>${bn(n)}</small></button>`;
    }).join('');
  }

  function slPaintStudents(resetSearch) {
    const wrap = el('slStudentsWrap');
    if (!wrap) return;
    if (!studentsCache.length) {
      wrap.innerHTML = '<p class="sl-note">শিক্ষার্থীদের তালিকা লোড হচ্ছে... তালিকা না এলে ইন্টারনেট দেখুন, অথবা শিক্ষককে শিক্ষার্থী যোগ করতে বলুন।</p>';
      return;
    }
    if (slClass === null) { wrap.innerHTML = ''; return; }
    const all = slInClass();
    // নাম বাছাই হয়ে গেলে শুধু সেই কার্ডটি থাকে, যাতে PIN ঘরটি ঠিক নিচেই দেখা যায়
    const chosen = slSel ? all.find(s => s.id === slSel) : null;
    if (chosen) {
      wrap.innerHTML = `<div class="sl-label">আপনার নাম</div>
        <div class="sl-list"><div class="sl-stu on"><span class="sl-av">${esc(Array.from(chosen.name || '?')[0])}</span><span class="sl-nm"><b>${esc(chosen.name)}</b><small>${chosen.roll ? 'রোল ' + esc(bn(chosen.roll)) : ''}</small></span><span class="sl-ck">\u2713</span></div></div>
        <button class="sl-link" onclick="slChange()">অন্য নাম বাছুন</button>`;
      return;
    }
    const wasChosen = !el('slList');
    if (resetSearch || wasChosen) {
      wrap.innerHTML = `<div class="sl-label">আপনার নাম</div>`
        + (all.length > 8 ? `<input id="slSearch" class="sl-search" type="search" placeholder="নাম বা রোল লিখে খুঁজুন" oninput="slSearch(this.value)">` : '')
        + '<div id="slList" class="sl-list"></div>';
    }
    const q = slQuery.trim().toLowerCase();
    const shown = q ? all.filter(s => String(s.name || '').toLowerCase().indexOf(q) > -1 || String(s.roll == null ? '' : s.roll) === q || bn(s.roll == null ? '' : s.roll) === q) : all;
    const list = el('slList');
    if (!list) return;
    list.innerHTML = shown.length ? shown.map(s => `
      <button class="sl-stu${s.id === slSel ? ' on' : ''}" onclick="slPickStudent('${esc(s.id)}')">
        <span class="sl-av">${esc(Array.from(s.name || '?')[0])}</span>
        <span class="sl-nm"><b>${esc(s.name)}</b><small>${s.roll ? 'রোল ' + esc(bn(s.roll)) : ''}</small></span>
        <span class="sl-ck">${s.id === slSel ? '\u2713' : ''}</span>
      </button>`).join('') : '<p class="sl-note">এই নামে কেউ পাওয়া যায়নি</p>';
  }

  function slPaintPin() {
    const wrap = el('slPinWrap');
    if (!wrap) return;
    const sel = el('studentPick');
    if (sel) { sel.innerHTML = studentsCache.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''); if (slSel) sel.value = slSel; }
    const me = slSel ? studentsCache.find(s => s.id === slSel) : null;
    if (!me) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div class="sl-pin">
        <label for="studentPinInput">আপনার PIN দিন</label>
        <input id="studentPinInput" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" onkeydown="if(event.key==='Enter'){confirmStudentPick();}">
        <p id="pinError" class="muted" style="color:#dc2626;"></p>
        <button onclick="confirmStudentPick()">প্রবেশ করুন</button>
      </div>`;
  }

  window.slPickClass = function (i) {
    const c = slClassList[i];
    if (c === undefined) return;
    slClass = c; slSel = null; slQuery = '';
    try { localStorage.setItem('loginClass', c); } catch (e) { /* ignore */ }
    slPaintClasses(); slPaintStudents(true); slPaintPin();
  };
  window.slPickStudent = function (id) {
    slSel = id;
    slPaintStudents(false); slPaintPin();
    setTimeout(() => {
      const pin = el('studentPinInput');
      if (pin) { pin.scrollIntoView({ behavior: 'smooth', block: 'center' }); pin.focus(); }
    }, 60);
  };
  window.slSearch = function (v) { slQuery = v || ''; slPaintStudents(false); };
  window.slChange = function () {
    slSel = null; slQuery = '';
    slPaintStudents(true); slPaintPin();
  };

  function showPicker() {
    if (studentLoginLocked()) { window.showRoleSelect(); return; }
    if (slTimer) { clearInterval(slTimer); slTimer = null; }
    const classes = slClasses();
    let saved = null;
    try { saved = localStorage.getItem('loginClass'); } catch (e) { /* ignore */ }
    slSel = null; slQuery = '';
    slClass = (saved !== null && classes.indexOf(saved) > -1) ? saved : (classes.length === 1 ? classes[0] : null);
    setScreen(slShell());
    if (typeof hideNav === 'function') hideNav();
    slPaintClasses(); slPaintStudents(true); slPaintPin();
    // শিক্ষার্থী তালিকা দেরিতে এলে (বা বদলালে) আবার আঁকা
    slLast = studentsCache;
    slTimer = setInterval(() => {
      if (!el('studentPickerScreen')) { clearInterval(slTimer); slTimer = null; return; }
      if (studentsCache !== slLast) {
        slLast = studentsCache;
        if (slClass !== null && slClasses().indexOf(slClass) === -1) slClass = null;
        if (slSel && !studentsCache.some(s => s.id === slSel)) slSel = null;
        slPaintClasses(); slPaintStudents(true); slPaintPin();
      }
    }, 700);
  }
  window.showStudentPicker = showPicker;

  // =====================================================================
  //   সাধারণ শিক্ষকের ডিভাইসে "শিক্ষার্থী" লগইন বন্ধ (অ্যাডমিন ছাড়া)
  // শিক্ষার্থীদের কোনো অ্যাকাউন্ট নেই, তাই "আপনি কে?" পাতায় অ্যাপ বুঝতে পারে না কে চাপছে।
  // তাই যে ডিভাইসে কোনো সাধারণ (অ্যাডমিন নন) শিক্ষক লগইন করেছেন, সেই ডিভাইসে
  // শিক্ষার্থী লগইন বন্ধ থাকে। অ্যাডমিন শিক্ষক বা সুপার অ্যাডমিন ওই ডিভাইসে লগইন করলে আবার খুলে যায়।
  // =====================================================================
  const LOCK_KEY = 'nonAdminTeacherDevice';
  const studentLoginLocked = () => { try { return localStorage.getItem(LOCK_KEY) === '1'; } catch (e) { return false; } };
  function syncDeviceLock() {
    try {
      if (isAdminTeacher()) localStorage.removeItem(LOCK_KEY);
      else localStorage.setItem(LOCK_KEY, '1');
    } catch (e) { /* ignore */ }
  }
  function lockStudentButton() {
    if (!studentLoginLocked()) return;
    const btn = document.querySelector("#app button[onclick=\"pickRole('student')\"]");
    if (!btn || btn.dataset.locked) return;
    btn.dataset.locked = '1';
    btn.removeAttribute('onclick');
    btn.disabled = true;
    btn.style.opacity = '.5';
    btn.style.cursor = 'not-allowed';
    btn.insertAdjacentHTML('afterend', '<p class="muted" style="margin-top:8px;line-height:1.6;">এই ফোনে শিক্ষক লগইন করা হয়েছিল, তাই এখানে শিক্ষার্থী লগইন বন্ধ। শিক্ষার্থীরা নিজেদের ফোন থেকে লগইন করুন। অ্যাডমিন শিক্ষক এই ফোনে লগইন করলে আবার চালু হবে।</p>');
  }
  const origShowRoleSelect = window.showRoleSelect;
  if (typeof origShowRoleSelect === 'function') {
    window.showRoleSelect = function () {
      const r = origShowRoleSelect.apply(this, arguments);
      lockStudentButton();
      return r;
    };
  }
  const origPickRole = window.pickRole;
  if (typeof origPickRole === 'function') {
    window.pickRole = function (r) {
      if (r === 'student' && studentLoginLocked()) { window.showRoleSelect(); return; }
      return origPickRole.apply(this, arguments);
    };
  }

  // =====================================================================
  //   শিক্ষার্থী ট্যাব: সাধারণ শিক্ষক শুধু যোগ করতে পারেন
  // "PIN সেট/পরিবর্তন", "নম্বর সম্পাদনা" ও "মুছুন" বাটন শুধু অ্যাডমিন দেখেন।
  // (সার্ভারে firestore.rules একই নিয়ম জোর করে, এটা শুধু অ্যাপের ভেতরের ব্যবস্থা)
  // =====================================================================
  ['setStudentPin', 'setStudentPhone', 'deleteStudent'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (!isAdminTeacher()) {
        alert('শিক্ষার্থীর তথ্য সংশোধন বা মোছা শুধু অ্যাডমিন শিক্ষক করতে পারেন। আপনি নতুন শিক্ষার্থী যোগ করতে পারবেন।');
        return;
      }
      return orig.apply(this, arguments);
    };
  });
  const origRenderStudentsList = window.renderStudentsList;
  if (typeof origRenderStudentsList === 'function') {
    window.renderStudentsList = function () {
      const r = origRenderStudentsList.apply(this, arguments);
      if (!isAdminTeacher()) {
        const wrap = document.getElementById('studentsListWrap');
        if (wrap) {
          wrap.querySelectorAll('button').forEach(b => {
            if (/^(setStudentPin|setStudentPhone|deleteStudent)\(/.test(b.getAttribute('onclick') || '')) b.remove();
          });
          if (wrap.children.length) wrap.insertAdjacentHTML('afterbegin', '<p class="muted" style="margin-bottom:6px;">তথ্য সংশোধন ও মোছা শুধু অ্যাডমিন শিক্ষক করতে পারেন। আপনি নতুন শিক্ষার্থী যোগ করতে পারবেন।</p>');
        }
      }
      return r;
    };
  }

  // ================= app.js এর সাথে জোড়া লাগানো =================
  const origTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    stop();
    // অ্যাডমিন ছাড়া কেউ "সেটিংস" বা "পরামর্শ" ট্যাবে ঢুকতে চাইলে হোমে ফিরিয়ে দেওয়া হয়
    if ((tab === 'settings' || tab === 'suggestions') && !isAdminTeacher()) tab = 'home';
    if (tab === 'home') {
      renderTeacherNav('home');
      render();
      return;
    }
    return origTeacherTab.apply(this, arguments);
  };

  // "আরও" মেনুতে "সেটিংস" ও "পরামর্শ" শুধু অ্যাডমিনের জন্য দেখানো (বাকি নিয়ম app.js এর মতোই)
  window.renderTeacherNav = function (activeKey) {
    const nav = document.getElementById('bottomNav');
    nav.style.display = 'block';
    const visible = teacherMoreTabs.filter(t => {
      if (t.key === 'teachers') return myTeacherIsAdmin;
      if (t.key === 'super_admin') return isSuperAdminUser;
      if (t.key === 'settings' || t.key === 'suggestions') return isAdminTeacher();
      return true;
    });
    nav.innerHTML = buildNavHtml(teacherPrimaryTabs, visible, 'teacherTab', activeKey);
  };

  // লগইন বা নিবন্ধনের পর প্রথম পাতা হবে হোম
  window.showTeacherApp = function () { syncDeviceLock(); window.teacherTab('home'); };

  const origLogout = window.logout;
  if (typeof origLogout === 'function') {
    window.logout = function () { stop(); return origLogout.apply(this, arguments); };
  }
})();
