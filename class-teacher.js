/* ShikkhaOS — শ্রেণি শিক্ষক নির্ধারণ (ধাপ ১) + রেজাল্ট সম্পাদনার সীমা (ধাপ ২) + শ্রেণি শিক্ষকের শিক্ষার্থী-তথ্য সম্পাদনা (ধাপ ৩)
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
            <p class="muted">যে শিক্ষক যে শ্রেণির শ্রেণি শিক্ষক, তাঁর পাশে সেই শ্রেণি বেছে দিন। (রেজাল্ট সম্পাদনা করতে পারবেন শুধু ওই শ্রেণির শ্রেণি শিক্ষক ও অ্যাডমিন; বাকিরা শুধু দেখতে পারবেন।)</p>
            <div id="classTeacherWrap">লোড হচ্ছে...</div>
          </div>`);
        load();
      }
    }
    return r;
  };

  // =====================================================================
  //   ধাপ ২: রেজাল্ট সম্পাদনা শুধু ওই শ্রেণির শ্রেণি শিক্ষক ও অ্যাডমিনের
  // সার্ভারে firestore.rules একই নিয়ম জোর করে; এখানে অ্যাপের ভেতরের ব্যবস্থা
  // (বাটন লুকানো, ফর্মে শুধু নিজের শ্রেণির শিক্ষার্থী, মেধাক্রম শুধু নিজের শ্রেণির)।
  // =====================================================================
  const isAdminNow = () => !!((typeof myTeacherIsAdmin !== 'undefined' && myTeacherIsAdmin) ||
                              (typeof isSuperAdminUser !== 'undefined' && isSuperAdminUser));
  let myClass = '';          // এই শিক্ষকের শ্রেণি ('' মানে কোনো শ্রেণির শ্রেণি শিক্ষক নন)
  let classLoaded = false;
  let listenerUid = null;
  let unsubMine = null;
  let defaultFilterApplied = false;
  let obs = null;

  function stopMine() {
    if (unsubMine) { try { unsubMine(); } catch (e) { /* ignore */ } unsubMine = null; }
    listenerUid = null;
  }

  // নিজের teachers/{uid} ডকুমেন্ট শোনা, যাতে অ্যাডমিন শ্রেণি বদলালে অ্যাপ বন্ধ না করেই কাজ করে
  function startMine() {
    const u = auth.currentUser;
    if (!u || !u.providerData || !u.providerData.length) return;
    if (listenerUid === u.uid) return;
    stopMine();
    listenerUid = u.uid;
    unsubMine = db.collection('teachers').doc(u.uid).onSnapshot(snap => {
      const d = snap.exists ? snap.data() : {};
      const c = typeof d.classTeacherOf === 'string' ? d.classTeacherOf : '';
      const changed = !classLoaded || c !== myClass;
      myClass = c;
      classLoaded = true;
      if (changed) onClassChanged();
    }, err => console.error('[class-teacher] নিজের তথ্য লোড এরর', err));
  }

  function onClassChanged() {
    if (isAdminNow()) return;
    if (document.getElementById('resultsWrap') && typeof lastResultsIsTeacher !== 'undefined' && lastResultsIsTeacher) {
      window.renderResultsScreen(true);
    }
    if (document.getElementById('studentsScreen') && typeof window.renderStudentsList === 'function') {
      window.renderStudentsList();
    }
  }

  function canEditStudent(sid) {
    if (isAdminNow()) return true;
    if (!myClass) return false;
    const s = studentsCache.find(x => x.id === sid);
    return !!s && s.className === myClass;
  }

  // রেজাল্টের docId = শিক্ষার্থীর id + '_' + পরীক্ষার নাম ..., তাই শুরু দেখেই শিক্ষার্থী চেনা যায়
  function canEditDocId(docId) {
    if (isAdminNow()) return true;
    const id = String(docId || '');
    return studentsCache.some(s => canEditStudent(s.id) && id.indexOf(s.id + '_') === 0);
  }

  const DENY_MSG = 'এই শ্রেণির রেজাল্ট শুধু ওই শ্রেণির শ্রেণি শিক্ষক বা অ্যাডমিন সম্পাদনা করতে পারেন।';

  function wrapGuard(name, check) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (!check.apply(null, arguments)) { alert(DENY_MSG); return; }
      return orig.apply(this, arguments);
    };
  }
  wrapGuard('editMarksheet', sid => canEditStudent(sid));
  wrapGuard('togglePublish', docId => canEditDocId(docId));
  wrapGuard('deleteMarksheet', docId => canEditDocId(docId));
  wrapGuard('saveMarksheet', () => {
    const sel = document.getElementById('resStudent');
    return sel && sel.value ? canEditStudent(sel.value) : true;
  });

  // তালিকার প্রতিটি সারিতে যে শিক্ষার্থীর রেজাল্ট সম্পাদনা করা যাবে না, তার বাটন সরিয়ে ফেলা
  function stripButtons() {
    const wrap = document.getElementById('resultsWrap');
    if (!wrap || isAdminNow()) return;
    wrap.querySelectorAll('button[onclick]').forEach(b => {
      const m = /^(editMarksheet|togglePublish|deleteMarksheet)\('((?:[^'\\]|\\.)*)'/.exec(b.getAttribute('onclick') || '');
      if (!m) return;
      const arg = m[2].replace(/\\(.)/g, '$1');
      const ok = m[1] === 'editMarksheet' ? canEditStudent(arg) : canEditDocId(arg);
      if (!ok) b.remove();
    });
  }

  function watchResultsList() {
    if (obs) { obs.disconnect(); obs = null; }
    const wrap = document.getElementById('resultsWrap');
    if (!wrap) return;
    obs = new MutationObserver(stripButtons);
    obs.observe(wrap, { childList: true, subtree: true });
    stripButtons();
  }

  function restrictResultsUi() {
    if (isAdminNow()) return;
    const sel = document.getElementById('resStudent');
    const formCard = sel ? sel.closest('.card') : null;
    if (formCard) {
      const mine = studentsCache.filter(s => canEditStudent(s.id) && (resultsClassFilter === 'all' || s.className === resultsClassFilter));
      if (!mine.length) {
        // শ্রেণি বাছাইয়ের ঘরটি (resultsFilterWrap) রেখে বাকি ফর্ম লুকানো, যাতে অন্য শ্রেণির রেজাল্ট দেখার ব্যবস্থা আটকে না যায়
        Array.from(formCard.children).forEach(ch => {
          if (ch.tagName !== 'H2' && ch.id !== 'resultsFilterWrap') ch.style.display = 'none';
        });
        const note = !classLoaded ? 'লোড হচ্ছে...'
          : !myClass ? 'আপনাকে কোনো শ্রেণির শ্রেণি শিক্ষক করা হয়নি, তাই রেজাল্ট শুধু দেখতে পারবেন।'
          : 'এই শ্রেণির রেজাল্ট আপনি শুধু দেখতে পারবেন। সম্পাদনা করতে পারবেন শুধু নিজের শ্রেণির (' + myClass + ')।';
        const fw = document.getElementById('resultsFilterWrap');
        const html = '<p class="muted" style="margin:8px 0 0;">' + esc(note) + '</p>';
        if (fw) fw.insertAdjacentHTML('afterend', html); else formCard.insertAdjacentHTML('beforeend', html);
      } else {
        sel.innerHTML = mine.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.roll || '')})</option>`).join('');
      }
    }
    watchResultsList();
  }

  if (typeof renderResultsScreen === 'function') {
    const origResults = window.renderResultsScreen;
    window.renderResultsScreen = function (isTeacher) {
      if (isTeacher && !isAdminNow()) {
        startMine();
        // শ্রেণি শিক্ষক প্রথমবার রেজাল্ট ট্যাবে এলে নিজের শ্রেণিই আগে দেখান
        if (classLoaded && myClass && !defaultFilterApplied && resultsClassFilter === 'all') {
          resultsClassFilter = myClass;
          defaultFilterApplied = true;
        }
      }
      const r = origResults.apply(this, arguments);
      if (isTeacher) restrictResultsUi();
      return r;
    };
  }

  // ---- মেধাক্রম: অ্যাডমিন সব শ্রেণির, শ্রেণি শিক্ষক শুধু নিজের শ্রেণির ----
  // (নইলে অন্য শ্রেণির রেজাল্টে লিখতে গিয়ে পুরো ব্যাচটাই সার্ভার ফিরিয়ে দিত)
  //
  // Firestore-এর নিয়ম: একসাথে লেখার (batch) সময় rules প্রতিটি ডকের জন্য শিক্ষার্থীর ডক দেখে
  // শ্রেণি শিক্ষক কিনা যাচাই করে, আর পুরো ব্যাচে মোট ২০টির বেশি ডক দেখা যায় না।
  // তাই শ্রেণিতে ১৮ জনের বেশি হলে এক ব্যাচে লিখলে সব বাতিল হতো — এখন ১৫টি করে ভাগ করে লেখা হয়।
  const MERIT_CHUNK = 15;

  function recomputeOwn(examName, academicYear) {
    if (!examName || !myClass) return Promise.resolve();
    return db.collection('results')
      .where('madrasaId', '==', madrasaId)
      .where('examName', '==', examName)
      .get()
      .then(snap => {
        const list = [];
        snap.docs.forEach(d => {
          const r = d.data();
          if ((r.academicYear || '') !== (academicYear || '')) return;
          if (!Array.isArray(r.subjects) || r.subjects.length === 0) return;
          const st = studentsCache.find(s => s.id === r.studentId);
          if (!st || st.className !== myClass) return;
          const t = computeMarksheetTotals(r.subjects);
          list.push({ id: d.id, gpa: Number(t.gpa), total: t.totalObtained, roll: st.roll, failed: t.grade === 'F' });
        });
        const pass = list.filter(x => !x.failed).sort((a, b) =>
          (b.gpa - a.gpa) || (b.total - a.total) || meritRollCompare(a.roll, b.roll));

        const ops = [];
        pass.forEach((x, i) => {
          ops.push({ ref: db.collection('results').doc(x.id), data: { meritRank: i + 1, meritTotal: pass.length } });
        });
        list.filter(x => x.failed).forEach(x => {
          ops.push({
            ref: db.collection('results').doc(x.id),
            data: {
              meritRank: firebase.firestore.FieldValue.delete(),
              meritTotal: firebase.firestore.FieldValue.delete()
            }
          });
        });

        let chain = Promise.resolve();
        for (let i = 0; i < ops.length; i += MERIT_CHUNK) {
          const part = ops.slice(i, i + MERIT_CHUNK);
          chain = chain.then(() => {
            const batch = db.batch();
            part.forEach(o => batch.update(o.ref, o.data));
            return batch.commit();
          });
        }
        return chain;
      })
      .catch(e => showDiagBanner('মেধাক্রম হিসাব ব্যর্থ: ' + e.message));
  }

  const origRecompute = window.recomputeMeritRanks;
  if (typeof origRecompute === 'function') {
    window.recomputeMeritRanks = function (examName, academicYear) {
      return isAdminNow() ? origRecompute.apply(this, arguments) : recomputeOwn(examName, academicYear);
    };
  }

  const origRecomputeAll = window.recomputeAllMeritRanks;
  if (typeof origRecomputeAll === 'function') {
    window.recomputeAllMeritRanks = function () {
      if (isAdminNow()) return origRecomputeAll.apply(this, arguments);
      if (!myClass) { alert('আপনি কোনো শ্রেণির শ্রেণি শিক্ষক নন।'); return; }
      db.collection('results').where('madrasaId', '==', madrasaId).get().then(snap => {
        const combos = {};
        snap.docs.forEach(d => {
          const r = d.data();
          if (!r.examName) return;
          combos[r.examName + '||' + (r.academicYear || '')] = { examName: r.examName, academicYear: r.academicYear || '' };
        });
        let chain = Promise.resolve();
        Object.keys(combos).forEach(k => { chain = chain.then(() => recomputeOwn(combos[k].examName, combos[k].academicYear)); });
        return chain;
      }).then(() => alert('আপনার শ্রেণির মেধাক্রম হালনাগাদ করা হয়েছে'))
        .catch(e => showDiagBanner('মেধাক্রম হালনাগাদ ব্যর্থ: ' + e.message));
    };
  }

  // =====================================================================
  //   ধাপ ৩: শ্রেণি শিক্ষক নিজের শ্রেণির শিক্ষার্থীর তথ্য সম্পাদনা করতে পারবেন
  // (✏️ সম্পাদনা, PIN সেট/পরিবর্তন, নম্বর সম্পাদনা)। মুছতে পারবেন শুধু অ্যাডমিন।
  // dashboard.js ও student-edit.js এ "শুধু অ্যাডমিন" পরীক্ষা আছে; সেগুলো না বদলে
  // শ্রেণি শিক্ষকের নিজের শ্রেণির ক্ষেত্রে ওই কয়েকটি ফাংশন চলার মুহূর্তটুকুতে
  // (একই সেকেন্ডে, সিঙ্ক্রোনাসভাবে) অ্যাডমিন-পতাকা চালু করা হয়, তারপরই ফিরিয়ে দেওয়া হয়।
  // সার্ভারে firestore.rules আলাদাভাবে একই নিয়ম জোর করে।
  // =====================================================================
  function asAdmin(fn) {
    const prev = myTeacherIsAdmin;
    myTeacherIsAdmin = true;
    try { return fn(); } finally { myTeacherIsAdmin = prev; }
  }

  const STU_DENY = 'আপনি শুধু নিজের শ্রেণির শিক্ষার্থীর তথ্য সম্পাদনা করতে পারবেন।';

  function lockClassField() {
    const c = document.getElementById('seClass');
    if (!c) return;
    c.readOnly = true;
    c.removeAttribute('list');
    c.style.background = '#f1f5f9';
    const note = document.querySelector('#stuEditModal p.muted:not(#seError)');
    if (note) note.textContent = 'শ্রেণি বদলাতে অ্যাডমিনের সাহায্য নিন।';
  }

  ['setStudentPin', 'setStudentPhone', 'editStudentInfo'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (id) {
      if (isAdminNow()) return orig.apply(this, arguments);
      if (!canEditStudent(id)) { alert(STU_DENY); return; }
      const r = asAdmin(() => orig.apply(this, arguments));
      if (name === 'editStudentInfo') lockClassField();
      return r;
    };
  });

  // তালিকায় বাটন: নিজের শ্রেণির সারিতে তিনটি বাটন, "মুছুন" কোথাও নয়, অন্য শ্রেণির সারিতে কিছুই নয়
  function restrictStudentsList() {
    const wrap = document.getElementById('studentsListWrap');
    if (!wrap) return;
    wrap.querySelectorAll('button[onclick]').forEach(b => {
      const m = /^(setStudentPin|setStudentPhone|deleteStudent|editStudentInfo)\('((?:[^'\\]|\\.)*)'/.exec(b.getAttribute('onclick') || '');
      if (!m) return;
      const id = m[2].replace(/\\(.)/g, '$1');
      if (m[1] === 'deleteStudent' || !canEditStudent(id)) b.remove();
    });
    if (wrap.children.length) {
      const note = !classLoaded ? 'লোড হচ্ছে...'
        : myClass ? 'শুধু আপনার শ্রেণির (' + myClass + ') শিক্ষার্থীর তথ্য সম্পাদনা করতে পারবেন। মোছা শুধু অ্যাডমিন করতে পারেন।'
        : 'তথ্য সংশোধন ও মোছা শুধু অ্যাডমিন শিক্ষক করতে পারেন। আপনি নতুন শিক্ষার্থী যোগ করতে পারবেন।';
      wrap.insertAdjacentHTML('afterbegin', '<p class="muted" style="margin-bottom:6px;">' + esc(note) + '</p>');
    }
  }

  const origStudentsList = window.renderStudentsList;
  if (typeof origStudentsList === 'function') {
    window.renderStudentsList = function () {
      if (isAdminNow()) return origStudentsList.apply(this, arguments);
      startMine();
      const r = asAdmin(() => origStudentsList.apply(this, arguments)); // বাটনসহ আঁকা
      restrictStudentsList();
      return r;
    };
  }

  // লগইনের পর নিজের শ্রেণি শোনা শুরু; লগআউটে বন্ধ
  const origEnsure = window.ensureTeacherDoc;
  if (typeof origEnsure === 'function') {
    window.ensureTeacherDoc = function () {
      return Promise.resolve(origEnsure.apply(this, arguments)).then(r => { startMine(); return r; });
    };
  }
  const origLogout = window.logout;
  if (typeof origLogout === 'function') {
    window.logout = function () {
      stopMine();
      myClass = ''; classLoaded = false; defaultFilterApplied = false;
      if (obs) { obs.disconnect(); obs = null; }
      return origLogout.apply(this, arguments);
    };
  }
})();
