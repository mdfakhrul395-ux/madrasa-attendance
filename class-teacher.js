/* ShikkhaOS — শ্রেণি শিক্ষক নির্ধারণ (ধাপ ১)
 *
 * শিক্ষকগণ ট্যাবের নিচে "শ্রেণি শিক্ষক নির্ধারণ" নামে একটি কার্ড যোগ করে।
 * অ্যাডমিন সেখানে প্রতিটি শিক্ষকের পাশে তাঁর শ্রেণি বেছে দেন।
 * তথ্য জমা হয় teachers/{uid} ডকুমেন্টের classTeacherOf ফিল্ডে (শ্রেণির নাম, লেখা)।
 *
 * app.js বা অন্য কোনো ফাইল বদলাতে হয় না। index.html এ এটি সবার শেষে লোড করুন
 * (final-result.js এর পরে)।
 */
(function () {
  'use strict';

  if (typeof renderTeachersScreen !== 'function' || typeof db === 'undefined') {
    console.error('[class-teacher] app.js এর পরে এই ফাইলটি লোড করুন।');
    return;
  }

  const origRender = window.renderTeachersScreen;
  let token = 0;

  function paint(docs) {
    const wrap = document.getElementById('classTeacherWrap');
    if (!wrap) return;
    const classes = getClassList();
    const myUid = auth.currentUser ? auth.currentUser.uid : null;

    const list = docs
      .filter(d => d.data().active !== false)
      .sort((a, b) => (a.data().createdAt || 0) - (b.data().createdAt || 0));

    if (!list.length) { wrap.innerHTML = '<p class="muted">কোনো শিক্ষক পাওয়া যায়নি</p>'; return; }

    wrap.innerHTML = list.map(d => {
      const t = d.data();
      const cur = typeof t.classTeacherOf === 'string' ? t.classTeacherOf : '';
      // শ্রেণির নাম পরে বদলে গিয়ে থাকলেও আগের মানটি তালিকায় থাকবে, যাতে হারিয়ে না যায়
      const all = cur && classes.indexOf(cur) === -1 ? classes.concat([cur]) : classes;
      const opts = all.map(c => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
      const tags = (d.id === myUid ? ' <span class="muted">(আপনি)</span>' : '')
        + (t.isAdmin === true ? ' <span class="muted">⭐ অ্যাডমিন</span>' : '')
        + (t.pending === true ? ' <span class="muted">(অনুমোদনের অপেক্ষায়)</span>' : '');
      return `
        <div class="student-row" style="display:block;">
          <div>${esc(t.email || d.id)}${tags}</div>
          <select onchange="setClassTeacher('${jsq(d.id)}', this)" style="margin-top:6px;">
            <option value="">— শ্রেণি শিক্ষক নন —</option>
            ${opts}
          </select>
          <div class="muted" id="ctMsg_${esc(d.id)}" style="min-height:16px;font-size:12px;margin-top:2px;"></div>
        </div>`;
    }).join('');
  }

  function load() {
    const my = ++token;
    db.collection('teachers').where('madrasaId', '==', madrasaId).get()
      .then(snap => { if (my === token) paint(snap.docs); })
      .catch(e => {
        const wrap = document.getElementById('classTeacherWrap');
        if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + esc(e.message) + '</p>';
        if (e.code !== 'permission-denied') showDiagBanner('শ্রেণি শিক্ষক তালিকা লোড এরর: ' + e.message);
      });
  }

  window.setClassTeacher = function (uid, sel) {
    if (!myTeacherIsAdmin) { alert('শ্রেণি শিক্ষক ঠিক করা শুধু অ্যাডমিন করতে পারেন'); return; }
    const msg = document.getElementById('ctMsg_' + uid);
    if (msg) msg.textContent = 'সংরক্ষণ হচ্ছে...';
    db.collection('teachers').doc(uid).set({ classTeacherOf: sel.value }, { merge: true })
      .then(() => { if (msg) msg.textContent = '✓ সংরক্ষিত'; })
      .catch(e => {
        if (msg) msg.textContent = '';
        alert('সংরক্ষণ ব্যর্থ: ' + e.message);
        showDiagBanner('শ্রেণি শিক্ষক সংরক্ষণ ব্যর্থ: ' + e.message);
        load();
      });
  };

  window.renderTeachersScreen = function () {
    const r = origRender.apply(this, arguments);
    if (myTeacherIsAdmin) {
      const app = document.getElementById('app');
      if (app) {
        app.insertAdjacentHTML('beforeend', `
          <div class="card">
            <h2>শ্রেণি শিক্ষক নির্ধারণ</h2>
            <p class="muted">যে শিক্ষক যে শ্রেণির শ্রেণি শিক্ষক, তাঁর পাশে সেই শ্রেণি বেছে দিন। (পরের ধাপে শুধু শ্রেণি শিক্ষক ও অ্যাডমিন রেজাল্ট সম্পাদনা করতে পারবেন।)</p>
            <div id="classTeacherWrap">লোড হচ্ছে...</div>
          </div>`);
        load();
      }
    }
    return r;
  };
})();
