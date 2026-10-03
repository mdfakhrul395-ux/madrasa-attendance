/* ShikkhaOS — প্যাকেজ/প্ল্যান, ধাপ ১
 * সুপার অ্যাডমিন প্যানেলে প্রতিটি মাদ্রাসার প্যাকেজ ও মেয়াদ ঠিক করার ব্যবস্থা।
 * app.js ও dashboard.js একটুও বদলাতে হয় না। index.html এ এই ফাইলটি সবার শেষে লোড হবে।
 * ডেটা: madrasas/{id} ডকুমেন্টে plan, planExpiry (YYYY-MM-DD), planUpdatedAt।
 * শুধু সুপার অ্যাডমিন এগুলো লিখতে পারেন (firestore.rules-এও একই নিয়ম)।
 * এই ধাপে প্যাকেজ অনুযায়ী কোনো ফিচার আটকানো হয় না, সেটা ধাপ ২-এ।
 */
(function () {
  'use strict';
  if (typeof listenMadrasasList !== 'function' || typeof db === 'undefined') {
    console.error('[plans] app.js এর পরে plans.js লোড করুন');
    return;
  }

  const PLANS = {
    basic:    { label: 'বেসিক',         price: 500,  students: 100,  teachers: 3 },
    standard: { label: 'স্ট্যান্ডার্ড', price: 1200, students: 300,  teachers: 10 },
    premium:  { label: 'প্রিমিয়াম',    price: 2500, students: null, teachers: null }
  };
  window.PLANS = PLANS;

  const bn = n => toBanglaNumeral(n);
  const $ = id => document.getElementById(id);
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const ymd = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');

  function daysLeft(exp) {
    const a = todayLocal().split('-').map(Number), b = exp.split('-').map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
  }

  // মেয়াদের শেষ দিন পর্যন্ত চালু ধরা হয় (daysLeft == 0 মানে আজই শেষ দিন)
  window.getPlanInfo = function (m) {
    const key = m && PLANS[m.plan] ? m.plan : null;
    const expiry = m && validDate(m.planExpiry) ? m.planExpiry : null;
    const left = expiry ? daysLeft(expiry) : null;
    return { key, plan: key ? PLANS[key] : null, expiry, daysLeft: left, expired: left !== null && left < 0 };
  };

  // মাস যোগ করা (৩১ জানুয়ারি + ১ মাস = ২৮/২৯ ফেব্রুয়ারি)
  function addMonths(ds, n) {
    const p = ds.split('-').map(Number);
    const t = new Date(Date.UTC(p[0], p[1] - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(p[2], last));
  }
  window.__plansAddMonths = addMonths;

  const cache = {};
  const loginLinkFor = id => window.location.origin + window.location.pathname.replace(/index\.html$/, '') + '?m=' + encodeURIComponent(id);

  window.listenMadrasasList = function () {
    stopMadrasasListener();
    madrasasUnsub = db.collection('madrasas').onSnapshot(snap => {
      const wrap = $('madrasasListWrap');
      if (!wrap) return;
      const docs = snap.docs.slice().sort((a, b) => (b.data().createdAt || 0) - (a.data().createdAt || 0));
      Object.keys(cache).forEach(k => { delete cache[k]; });
      docs.forEach(d => { cache[d.id] = d.data(); });
      if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো মাদ্রাসা পাওয়া যায়নি</p>'; return; }

      let live = 0, expired = 0, none = 0;
      docs.forEach(d => {
        const i = getPlanInfo(d.data());
        if (!i.key) none++; else if (i.expired) expired++; else live++;
      });
      const summary = `<p class="muted" style="margin-bottom:8px;">চালু প্যাকেজ: <b>${bn(live)}</b> &nbsp; মেয়াদ শেষ: <b>${bn(expired)}</b> &nbsp; প্যাকেজ নেই: <b>${bn(none)}</b></p>`;

      wrap.innerHTML = summary + docs.map(d => {
        const m = d.data();
        const isActiveM = m.active !== false;
        const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleDateString('bn-BD') : '-';
        const isCurrent = d.id === madrasaId;
        const info = getPlanInfo(m);
        let cls = 'pending', txt = 'প্যাকেজ নেই', line = 'এখনো কোনো প্যাকেজ দেওয়া হয়নি';
        if (info.key) {
          if (info.expired) { cls = 'absent'; txt = 'মেয়াদ শেষ'; }
          else if (info.daysLeft !== null && info.daysLeft <= 7) { cls = 'pending'; txt = 'শিগগির শেষ'; }
          else { cls = 'present'; txt = 'চালু'; }
          line = esc(info.plan.label) + ' · ' + (info.expiry
            ? 'মেয়াদ: ' + esc(fmtHolidayDate(info.expiry, false)) + (info.expired ? '' : ' (আর ' + bn(info.daysLeft) + ' দিন)')
            : 'মেয়াদ ঠিক করা নেই');
        }
        return `<div class="student-row" style="display:block;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>${esc(m.madrasaName || d.id)}${isCurrent ? ' <span class="muted">(আপনার বর্তমান)</span>' : ''}</span>
            <span class="badge ${isActiveM ? 'present' : 'absent'}">${isActiveM ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
          </div>
          <div class="muted" style="margin-top:2px;">নিবন্ধনের তারিখ: ${esc(dateStr)} &nbsp; আইডি: ${esc(d.id)}</div>
          ${typeof tenantCopyLinkFor === 'function' ? `<input readonly value="${esc(loginLinkFor(d.id))}" style="margin-top:6px;font-size:12px;" onclick="this.select()">` : ''}
          <div style="margin-top:6px;">📦 <b>${line}</b> <span class="badge ${cls}">${txt}</span></div>
          <div style="margin-top:6px;">
            <button class="small secondary" onclick="planOpenEditor('${jsq(d.id)}')">📦 প্যাকেজ ঠিক করুন</button>
            <button class="small ${isActiveM ? 'danger' : ''}" onclick="toggleMadrasaActive('${jsq(d.id)}', ${isActiveM})">${isActiveM ? 'নিবন্ধন বাতিল করুন' : 'পুনরায় সক্রিয় করুন'}</button>
            ${typeof tenantCopyLinkFor === 'function' ? `<button class="small secondary" onclick="tenantCopyLinkFor('${jsq(d.id)}')">লিংক কপি</button>
            <button class="small secondary" onclick="tenantShareLinkFor('${jsq(d.id)}','${jsq(m.madrasaName || d.id)}')">হোয়াটসঅ্যাপে পাঠান</button>` : ''}
          </div>
        </div>`;
      }).join('');
    }, err => {
      const wrap = $('madrasasListWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(err.message) + '</p>';
      showDiagBanner('মাদ্রাসা তালিকা লোড এরর: ' + err.message);
    });
  };

  // ---------- প্যাকেজ ঠিক করার জানালা (তালিকা নতুন করে আঁকলেও হারায় না) ----------
  window.planCloseEditor = function () {
    const ov = $('planModal');
    if (ov) ov.remove();
  };

  window.planOpenEditor = function (id) {
    const m = cache[id];
    if (!m) return;
    planCloseEditor();
    const info = getPlanInfo(m);
    const opts = ['<option value="">কোনো প্যাকেজ নেই</option>'].concat(Object.keys(PLANS).map(k =>
      `<option value="${k}"${info.key === k ? ' selected' : ''}>${esc(PLANS[k].label)} (${esc(bn(PLANS[k].price))} টাকা/মাস)</option>`)).join('');
    const ov = document.createElement('div');
    ov.id = 'planModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = `
      <div style="background:#fff;width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:18px;max-height:90vh;overflow:auto;">
        <h2 style="margin-top:0;">${esc(m.madrasaName || id)}</h2>
        <label>প্যাকেজ</label><select id="planSel">${opts}</select>
        <label>মেয়াদ শেষের তারিখ</label><input type="date" id="planExp" value="${esc(info.expiry || '')}">
        <div class="row" style="margin-top:8px;">
          <button class="small secondary" onclick="planAdd(1)">+১ মাস</button>
          <button class="small secondary" onclick="planAdd(3)">+৩ মাস</button>
          <button class="small secondary" onclick="planAdd(12)">+১ বছর</button>
        </div>
        <p class="muted" style="font-size:12px;">"+" বাটন তারিখের ঘরে থাকা ভবিষ্যৎ তারিখ থেকে, না থাকলে আজ থেকে গোনে।</p>
        <p id="planErr" class="muted" style="color:#dc2626;"></p>
        <button onclick="planSave('${jsq(id)}')">সংরক্ষণ করুন</button>
        <button class="secondary" onclick="planCloseEditor()" style="margin-top:8px;">বাতিল</button>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) planCloseEditor(); });
    document.body.appendChild(ov);
  };

  window.planAdd = function (months) {
    const inp = $('planExp');
    if (!inp) return;
    const today = todayLocal();
    const base = (validDate(inp.value) && inp.value >= today) ? inp.value : today;
    inp.value = addMonths(base, months);
  };

  window.planSave = function (id) {
    const err = $('planErr');
    if (err) err.textContent = '';
    if (!isSuperAdminUser) { alert('শুধু সুপার অ্যাডমিন প্যাকেজ বদলাতে পারেন'); return; }
    const sel = $('planSel').value;
    const exp = $('planExp').value;
    if (sel && exp && !validDate(exp)) { if (err) err.textContent = 'তারিখ সঠিক নয়'; return; }
    const F = firebase.firestore.FieldValue;
    const patch = sel
      ? { plan: sel, planExpiry: exp || F.delete(), planUpdatedAt: Date.now() }
      : { plan: F.delete(), planExpiry: F.delete(), planUpdatedAt: Date.now() };
    db.collection('madrasas').doc(id).set(patch, { merge: true })
      .then(() => planCloseEditor())
      .catch(e => { if (err) err.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; showDiagBanner('প্যাকেজ সংরক্ষণ ব্যর্থ: ' + e.message); });
  };
})();
