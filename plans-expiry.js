/* ShikkhaOS — প্যাকেজ, ধাপ ৩: ফ্রি ট্রায়াল, মেয়াদের ব্যানার, মেয়াদ শেষে শুধু দেখা
 * index.html এ plans-gate.js এর নিচে লোড হবে। app.js ও dashboard.js বদলাতে হয় না।
 * ১) নতুন মাদ্রাসা নিবন্ধন করলে নিজে থেকেই ৩০ দিনের ট্রায়াল (trialEndsAt) বসে।
 * ২) মেয়াদ বা ট্রায়াল শেষ হলে সব নতুন লেখা (সংরক্ষণ/মোছা) আটকায়, শুধু দেখা যায়।
 * ৩) শিক্ষকদের উপরে ব্যানার: ট্রায়ালের দিন, মেয়াদ ৭ দিনের কম হলে সতর্কতা, শেষ হলে লাল বার্তা।
 * সুপার অ্যাডমিন কখনো আটকান না। প্যাকেজ বসালে সাথে সাথে আবার চালু হয়।
 */
(function () {
  'use strict';
  if (typeof window.planState !== 'function' || typeof firebase === 'undefined') {
    console.error('[plans-expiry] plans-gate.js এর নিচে plans-expiry.js লোড করুন');
    return;
  }

  const TRIAL_DAYS = 30;
  const ALLOW = ['sessions', 'usage_stats', 'teachers', '_ping']; // লগইন ও ব্যবহারের হিসাব সবসময় চলবে
  const frozen = () => { try { return planState().expired; } catch (e) { return false; } };
  const denyErr = () => {
    const e = new Error('প্যাকেজের মেয়াদ শেষ, তাই এখন শুধু দেখা যাবে। নতুন তথ্য সংরক্ষণ করতে প্যাকেজ চালু করুন।');
    e.code = 'plan-expired';
    return e;
  };
  const colId = ref => { try { return ref && ref.parent ? ref.parent.id : ''; } catch (e) { return ''; } };

  try {
    const fs = firebase.firestore;
    const DR = fs.DocumentReference.prototype, CR = fs.CollectionReference.prototype, WB = fs.WriteBatch.prototype;

    const oSet = DR.set;
    DR.set = function () {
      const a = Array.prototype.slice.call(arguments);
      // নতুন মাদ্রাসা নিবন্ধনের মুহূর্তে ফ্রি ট্রায়াল বসানো
      if (typeof signupInProgress !== 'undefined' && signupInProgress && /^madrasas\/m_/.test(this.path) &&
          a[0] && a[0].createdAt && a[0].trialEndsAt === undefined) {
        a[0] = Object.assign({}, a[0], { trialEndsAt: Date.now() + TRIAL_DAYS * 86400000 });
      }
      if (frozen() && ALLOW.indexOf(colId(this)) < 0) return Promise.reject(denyErr());
      return oSet.apply(this, a);
    };
    ['update', 'delete'].forEach(m => {
      const o = DR[m];
      DR[m] = function () {
        if (frozen() && ALLOW.indexOf(colId(this)) < 0) return Promise.reject(denyErr());
        return o.apply(this, arguments);
      };
    });
    const oAdd = CR.add;
    CR.add = function () {
      if (frozen() && ALLOW.indexOf(this.id) < 0) return Promise.reject(denyErr());
      return oAdd.apply(this, arguments);
    };
    ['set', 'update', 'delete'].forEach(m => {
      const o = WB[m];
      WB[m] = function (ref) {
        if (frozen() && ALLOW.indexOf(colId(ref)) < 0) this.__planBlocked = true;
        return o.apply(this, arguments);
      };
    });
    const oCommit = WB.commit;
    WB.commit = function () {
      if (this.__planBlocked) return Promise.reject(denyErr());
      return oCommit.apply(this, arguments);
    };
  } catch (e) {
    console.error('[plans-expiry] লেখা আটকানোর ব্যবস্থা বসানো যায়নি', e);
  }

  // ---------- উপরের ব্যানার ----------
  function updateBanner() {
    const app = document.getElementById('app');
    if (!app || !app.parentNode) return;
    const nav = document.getElementById('bottomNav');
    const navOn = nav && nav.style.display !== 'none';
    const r = typeof role !== 'undefined' ? role : null;
    const st = planState();
    const contact = window.PLAN_SUPPORT_CONTACT ? ' যোগাযোগ: ' + window.PLAN_SUPPORT_CONTACT : '';
    let msg = '', bg = '#e7f5f2', fg = '#0f5b53';
    if (navOn && st.key) {
      if (r === 'teacher') {
        if (st.expired) { msg = (st.trial ? 'ফ্রি ট্রায়াল শেষ' : 'প্যাকেজের মেয়াদ শেষ') + ', এখন শুধু দেখা যাচ্ছে।' + contact; bg = '#fee2e2'; fg = '#991b1b'; }
        else if (st.trial) { msg = 'ফ্রি ট্রায়াল: আর ' + toBanglaNumeral(st.daysLeft) + ' দিন বাকি'; }
        else if (st.daysLeft != null && st.daysLeft <= 7) { msg = 'প্যাকেজের মেয়াদ আর ' + toBanglaNumeral(st.daysLeft) + ' দিন বাকি।' + contact; bg = '#fef3c7'; fg = '#92400e'; }
      } else if (r === 'student' && st.expired) {
        msg = 'মাদ্রাসার প্যাকেজের মেয়াদ শেষ, এখন নতুন তথ্য দেওয়া যাচ্ছে না।'; bg = '#fee2e2'; fg = '#991b1b';
      }
    }
    let b = document.getElementById('planBanner');
    if (!msg) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'planBanner'; app.parentNode.insertBefore(b, app); }
    b.style.cssText = 'padding:8px 14px;font-size:13px;font-weight:700;text-align:center;background:' + bg + ';color:' + fg + ';';
    if (b.textContent !== msg) b.textContent = msg;
  }
  setInterval(updateBanner, 1500);
})();
