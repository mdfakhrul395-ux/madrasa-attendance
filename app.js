// ================= MULTI-TENANT: MADRASA ID =================
// Each madrasa gets its own link like yourapp.com/?m=abc123 — opening that
// link once saves the id to this device permanently (localStorage). Existing
// users (who never used a ?m= link) automatically stay on 'madrasa-001' —
// their current data — so nothing changes for them.
(function initMadrasaId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('m');
  if (fromUrl) localStorage.setItem('madrasaId', fromUrl);
  if (!localStorage.getItem('madrasaId')) localStorage.setItem('madrasaId', 'madrasa-001');
})();
// This can change after a teacher logs in (it's re-read from their teacher
// profile, which is the authoritative source of which madrasa they belong
// to).
let madrasaId = localStorage.getItem('madrasaId');

// ================= SELF-SIGNUP GUARD =================
// While a brand-new madrasa signup is in progress (submitSignup below),
// the normal auth.onAuthStateChanged flow must NOT also try to resolve/
// create a teacher doc for the freshly created account — submitSignup()
// owns that entire sequence itself (create auth account -> create teacher
// doc with a brand-new madrasaId -> create madrasas/{id} doc). Without this
// guard, onAuthStateChanged fires the instant the new account is created
// and races ensureTeacherDoc() against submitSignup()'s own writes.
let signupInProgress = false;

// ================= DIAGNOSTIC BANNER (debug-mode only) =================
// Shows any Firestore/auth error directly on screen — but ONLY when debug
// mode is turned on (see the "ডিবাগ মোড" checkbox in সেটিংস). Every part of
// the app reports errors through this one function, so gating it here means
// ordinary users never see raw technical error text anywhere in the app;
// the message is still always logged to the browser console (visible via
// remote debugging) so nothing is lost for troubleshooting later.
let debugMode = localStorage.getItem('debugMode') === '1';

function showDiagBanner(msg) {
  console.error('[diag]', msg);
  if (!debugMode) return;
  let el = document.getElementById('diagBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'diagBanner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fee2e2;color:#7f1d1d;padding:10px 12px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;border-bottom:3px solid #dc2626;max-height:40vh;overflow:auto;';
    document.body.insertBefore(el, document.body.firstChild);
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕ বন্ধ করুন';
    closeBtn.style.cssText = 'text-align:right;font-weight:bold;cursor:pointer;margin-top:6px;';
    closeBtn.onclick = () => { el.style.display = 'none'; };
    el.appendChild(closeBtn);
  }
  const textNode = document.createElement('div');
  textNode.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
  el.insertBefore(textNode, el.firstChild);
  el.style.display = 'block';
}

// ================= STATE =================
let role = localStorage.getItem('role') || null; // 'teacher' | 'student'
let myStudentId = localStorage.getItem('myStudentId') || null;
let studentsCache = [];
let studentContactsCache = {}; // keyed by studentId: { phone, hasWhatsapp } — teacher-only, loaded from student_contacts
const auth = firebase.auth();

// live listener handles (so we can cleanly unsubscribe on logout / auth
// changes instead of letting them keep firing against a stale/no-auth
// session, which used to show spurious "permission-denied" banners)
let studentsUnsub = null;
let settingsUnsub = null;
let studentContactsUnsub = null;
let teachersUnsub = null;

// class filter state per screen (teacher side)
let studentsClassFilter = 'all';
let attClassFilter = 'all';
let resultsClassFilter = 'all';
let leavesClassFilter = 'all';
let tlClassFilter = 'all';
let diaryClassFilter = 'all';
let suggestionsClassFilter = 'all';
let feesClassFilter = 'all';

// fees (বেতন) state
let feesMode = 'monthly'; // 'monthly' | 'onetime'
let feesMonth = new Date().toISOString().slice(0,7); // 'YYYY-MM'
let currentFeesIsTeacher = true;

// attendance report state (daily/monthly)
let reportClassFilter = 'all';
let reportMode = 'daily'; // 'daily' | 'monthly'
let reportDate = new Date().toISOString().slice(0,10);
let reportMonth = new Date().toISOString().slice(0,7); // 'YYYY-MM'
let reportStudentId = '';

// marksheet entry state (teacher side, in-progress subject rows before save)
let currentMarksheetSubjects = [];
let lastResultsIsTeacher = true;
let lastUsedSubjectFullMarks = 100; // remembers last "পূর্ণ নম্বর" entered, for faster repeated entry

// app settings (madrasa name & logo)
let appSettings = {};

// multi-admin (শিক্ষকগণ): whether the currently signed-in teacher account
// has isAdmin:true on their teachers/{uid} doc. Only admin teachers can see
// the "শিক্ষকগণ" tab and add/deactivate/promote other teacher accounts.
let myTeacherIsAdmin = false;

// unread notification badges (student side)
let unreadCounts = { notices: 0, diary: 0 };
let unreadNoticesUnsub = null;
let unreadDiaryUnsub = null; // { unsub, className }
let currentStudentTab = 'attendance';

// ================= NAV CONFIG =================
const teacherPrimaryTabs = [
  { key: 'students', label: 'শিক্ষার্থী', icon: '\u{1F468}\u200D\u{1F393}' },
  { key: 'attendance', label: 'উপস্থিতি', icon: '\u2705' },
  { key: 'report', label: 'রিপোর্ট', icon: '\u{1F4CA}' },
  { key: 'results', label: 'রেজাল্ট', icon: '\u{1F3C6}' }
];
const teacherMoreTabs = [
  { key: 'leaves', label: 'ছুটি', icon: '\u{1F4C5}' },
  { key: 'timeleft', label: 'বের হওয়ার সময়', icon: '\u23F0' },
  { key: 'fees', label: 'বেতন', icon: '\u{1F4B0}' },
  { key: 'notices', label: 'নোটিশ', icon: '\u{1F4E2}' },
  { key: 'diary', label: 'ডায়েরী', icon: '\u{1F4D3}' },
  { key: 'suggestions', label: 'পরামর্শ', icon: '\u{1F4AC}' },
  { key: 'teachers', label: 'শিক্ষকগণ', icon: '\u{1F465}' },
  { key: 'settings', label: 'সেটিংস', icon: '\u2699\uFE0F' }
];

const studentPrimaryTabs = [
  { key: 'attendance', label: 'উপস্থিতি', icon: '\u2705' },
  { key: 'results', label: 'রেজাল্ট', icon: '\u{1F3C6}' },
  { key: 'notices', label: 'নোটিশ', icon: '\u{1F4E2}' },
  { key: 'diary', label: 'ডায়েরী', icon: '\u{1F4D3}' }
];
const studentMoreTabs = [
  { key: 'leaves', label: 'ছুটির আবেদন', icon: '\u{1F4C5}' },
  { key: 'fees', label: 'বেতন', icon: '\u{1F4B0}' },
  { key: 'suggestions', label: 'পরামর্শ', icon: '\u{1F4AC}' }
];

// ================= INIT =================
window.addEventListener('DOMContentLoaded', () => {
  db.collection('_ping').doc('x').get()
    .then(() => setSync(true))
    .catch(() => setSync(false));

  auth.onAuthStateChanged(user => {
    if (signupInProgress) return; // submitSignup() owns the flow while this is true

    if (!user) {
      // Everyone (teacher or student) needs to be signed in (at least anonymously)
      // before Firestore rules will allow reading student/attendance/result data.
      auth.signInAnonymously().catch(err => { console.error('Anonymous sign-in failed:', err); showDiagBanner('Anonymous sign-in ব্যর্থ: ' + err.message); });
      return; // onAuthStateChanged will fire again once signed in
    }

    const isTeacherAccount = user.providerData.length > 0; // email/password = teacher, anonymous = student/guest

    const afterMadrasaResolved = () => {
      listenStudents();
      listenSettings();
      if (isTeacherAccount) listenStudentContacts(); else stopStudentContactsListener();

      if (role === 'teacher') {
        if (isTeacherAccount) showTeacherApp();
        else showTeacherLogin();
      } else if (role === 'student' && myStudentId) {
        // verify this device's session still matches the signed-in anonymous user
        db.collection('sessions').doc(user.uid).get().then(doc => {
          if (doc.exists && doc.data().studentId === myStudentId) {
            showStudentApp();
          } else {
            showStudentPicker();
          }
        }).catch(err => { showDiagBanner('Session চেক ব্যর্থ: ' + err.message); showStudentPicker(); });
      } else {
        showRoleSelect();
      }
    };

    if (isTeacherAccount) {
      // Resolve which madrasa this teacher belongs to (and auto-migrate old
      // data the very first time this runs after the update), then proceed.
      ensureTeacherDoc(user).then(() => runMigrationIfNeeded()).then(() => migratePinsIfNeeded()).then(() => migrateContactsIfNeeded()).finally(afterMadrasaResolved);
    } else {
      afterMadrasaResolved();
    }
  });
});

function setSync(ok) {
  const dot = document.getElementById('syncDot');
  if (dot) dot.className = 'sync-dot' + (ok ? '' : ' offline');
}

// ================= MULTI-TENANT: TEACHER <-> MADRASA LINK =================
// A teacher's madrasa is decided by their teachers/{uid} profile doc, not by
// whatever link/localStorage this particular device has. The first time an
// existing teacher logs in after this update, we create that profile for
// them automatically using the device's current madrasaId (their existing
// madrasa), so nothing needs to be set up manually.
//
// Also resolves myTeacherIsAdmin from the same doc (isAdmin:true/false) —
// see the শিক্ষকগণ (multi-admin) feature below. A teacher whose doc has
// active:false has been deactivated by an admin; Firestore rules already
// block all of their reads/writes everywhere (see isTeacherAuth() in
// firestore.rules), this just also surfaces a clear banner instead of a
// silent wall of permission-denied errors.
function ensureTeacherDoc(user) {
  const ref = db.collection('teachers').doc(user.uid);
  return ref.get().then(doc => {
    if (doc.exists && doc.data().madrasaId) {
      madrasaId = doc.data().madrasaId;
      localStorage.setItem('madrasaId', madrasaId);
      myTeacherIsAdmin = doc.data().isAdmin === true;
      if (doc.data().active === false) {
        myTeacherIsAdmin = false;
        showDiagBanner('এই শিক্ষক অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে — অ্যাডমিনের সাথে যোগাযোগ করুন');
      }
      return;
    }
    myTeacherIsAdmin = false;
    return ref.set({ madrasaId, email: user.email || '', createdAt: Date.now() }, { merge: true });
  }).catch(err => { console.error('ensureTeacherDoc failed:', err); showDiagBanner('ensureTeacherDoc এরর: ' + err.message); });
}

// ================= MULTI-TENANT: ONE-TIME DATA MIGRATION (LEGACY) =================
// This tagged every existing document (students, attendance, leaves,
// results, notices, diary, suggestions) that didn't yet have a madrasaId
// with this madrasa's id — a one-time step from when multi-tenant support
// was first added. All real data has had madrasaId for a while now.
//
// It reads each collection with NO filter (db.collection(colName).get()),
// which the current per-document security rules (resource.data.madrasaId
// == myMadrasaId()) can no longer authorize as a list query — Firestore
// rejects it up front with "Missing or insufficient permissions" before it
// can even check whether there was anything to migrate. Since there's
// nothing left to migrate anyway, we treat that rejection as "already
// done" and stop retrying, instead of showing an error banner on every
// single app load.
function runMigrationIfNeeded() {
  const flagKey = 'migrationDone_' + madrasaId;
  if (localStorage.getItem(flagKey)) return Promise.resolve();
  const collections = ['students', 'attendance', 'leaves', 'results', 'notices', 'diary', 'suggestions'];
  let chain = Promise.resolve();
  collections.forEach(colName => { chain = chain.then(() => migrateCollection(colName)); });
  return chain.then(() => {
    localStorage.setItem(flagKey, '1');
    console.log('Multi-tenant migration complete for', madrasaId);
  }).catch(err => {
    // Blocked by security rules (expected now — see comment above) or any
    // other error: mark as done so this doesn't keep re-running (and
    // re-erroring) on every future app load. There's nothing left to
    // migrate for this madrasa in practice.
    localStorage.setItem(flagKey, '1');
    console.log('Migration skipped (already complete or blocked by rules) for', madrasaId, err && err.message);
  });
}

function migrateCollection(colName) {
  return db.collection(colName).get().then(snap => {
    const toTag = snap.docs.filter(d => !d.data().madrasaId);
    if (toTag.length === 0) return;
    const commits = [];
    for (let i = 0; i < toTag.length; i += 400) {
      const batch = db.batch();
      toTag.slice(i, i + 400).forEach(d => batch.update(d.ref, { madrasaId }));
      commits.push(batch.commit());
    }
    return Promise.all(commits);
  }).catch(err => {
    // permission-denied here means the security rules no longer allow an
    // unfiltered read of this collection — expected under multi-tenant
    // rules, and means there's nothing unsafe left to migrate via this
    // path. Silently treat as "nothing to do" instead of surfacing it as
    // an error.
    if (err.code === 'permission-denied') return;
    console.error('Migration error (' + colName + '):', err);
    throw err;
  });
}

// ================= SECURITY: STUDENT PIN MIGRATION =================
// Older versions stored each student's PIN directly on the students/{id}
// document (readable by any signed-in device). This moves every existing
// plaintext PIN into the student_pins/{id} collection (which no client can
// ever read — see firestore.rules) and replaces it on the students doc with
// a harmless hasPinSet:true/false flag. Runs once per madrasa (tracked in
// localStorage) the first time a teacher opens the app after this update.
function migratePinsIfNeeded() {
  const flagKey = 'pinsMigrated_' + madrasaId;
  if (localStorage.getItem(flagKey)) return Promise.resolve();
  return db.collection('students').where('madrasaId', '==', madrasaId).get().then(snap => {
    const withPin = snap.docs.filter(d => d.data().pin);
    if (withPin.length === 0) { localStorage.setItem(flagKey, '1'); return; }
    let chain = Promise.resolve();
    withPin.forEach(docSnap => {
      chain = chain.then(() => {
        const pin = docSnap.data().pin;
        return db.collection('student_pins').doc(docSnap.id).set({ pin })
          .then(() => docSnap.ref.set({ hasPinSet: true, pin: firebase.firestore.FieldValue.delete() }, { merge: true }));
      });
    });
    return chain.then(() => {
      localStorage.setItem(flagKey, '1');
      console.log('PIN migration complete for', madrasaId);
    });
  }).catch(err => { console.error('PIN migration error:', err); showDiagBanner('PIN মাইগ্রেশন এরর: ' + err.message); });
}

// ================= SECURITY: STUDENT PHONE/WHATSAPP MIGRATION =================
// Older versions stored each student's phone number and WhatsApp flag
// directly on the students/{id} document, which is readable by any
// signed-in device (including anonymous students from other madrasas) via
// the open `students` read rule. This moves that data into the
// student_contacts/{id} collection (teacher-only read/write — see
// firestore.rules) and removes phone/hasWhatsapp from the students doc.
// Runs once per madrasa (tracked in localStorage) the first time a teacher
// opens the app after this update.
function migrateContactsIfNeeded() {
  const flagKey = 'contactsMigrated_' + madrasaId;
  if (localStorage.getItem(flagKey)) return Promise.resolve();
  return db.collection('students').where('madrasaId', '==', madrasaId).get().then(snap => {
    const withContact = snap.docs.filter(d => d.data().phone || d.data().hasWhatsapp);
    if (withContact.length === 0) { localStorage.setItem(flagKey, '1'); return; }
    let chain = Promise.resolve();
    withContact.forEach(docSnap => {
      chain = chain.then(() => {
        const data = docSnap.data();
        return db.collection('student_contacts').doc(docSnap.id).set({
          madrasaId, phone: data.phone || '', hasWhatsapp: !!data.hasWhatsapp
        }).then(() => docSnap.ref.set({
          phone: firebase.firestore.FieldValue.delete(),
          hasWhatsapp: firebase.firestore.FieldValue.delete()
        }, { merge: true }));
      });
    });
    return chain.then(() => {
      localStorage.setItem(flagKey, '1');
      console.log('Contact migration complete for', madrasaId);
    });
  }).catch(err => { console.error('Contact migration error:', err); showDiagBanner('যোগাযোগ তথ্য মাইগ্রেশন এরর: ' + err.message); });
}

// ================= APP SETTINGS (মাদরাসার নাম ও লোগো) =================
function listenSettings() {
  if (settingsUnsub) { settingsUnsub(); settingsUnsub = null; }
  const ref = db.collection('madrasas').doc(madrasaId);
  ref.get().then(doc => {
    if (doc.exists) return;
    // one-time fallback: copy the old single-tenant settings/app doc over,
    // if this madrasa has never had its own madrasas/{id} doc yet
    return db.collection('settings').doc('app').get().then(legacyDoc => {
      if (legacyDoc.exists) return ref.set(legacyDoc.data(), { merge: true });
    });
  }).catch(() => {}).then(() => {
    settingsUnsub = ref.onSnapshot(doc => {
      appSettings = doc.exists ? (doc.data() || {}) : {};
      renderTopBar();
    }, err => {
      // Ignore permission-denied here: this fires briefly during logout /
      // role switches while auth is momentarily unresolved, and the
      // listener re-attaches with a valid session moments later anyway.
      if (err.code !== 'permission-denied') showDiagBanner('Settings লোড এরর: ' + err.message);
      renderTopBar();
    });
  });
}

function renderTopBar() {
  let bar = document.getElementById('topBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'topBar';
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border-bottom:1px solid #eee;position:sticky;top:0;z-index:50;';
    bar.innerHTML = `
      <img id="topBarLogo" style="width:36px;height:36px;border-radius:8px;object-fit:cover;display:none;" alt="logo">
      <b id="topBarName" style="font-size:16px;"></b>
    `;
    const appEl = document.getElementById('app');
    if (appEl && appEl.parentNode) appEl.parentNode.insertBefore(bar, appEl);
    else document.body.insertBefore(bar, document.body.firstChild);
  }
  const nameEl = document.getElementById('topBarName');
  const logoEl = document.getElementById('topBarLogo');
  if (nameEl) nameEl.textContent = (appSettings && appSettings.madrasaName) ? appSettings.madrasaName : 'মাদরাসা হাজিরা অ্যাপ';
  if (logoEl) {
    if (appSettings && appSettings.logoDataUrl) {
      logoEl.src = appSettings.logoDataUrl;
      logoEl.style.display = 'block';
    } else {
      logoEl.style.display = 'none';
    }
  }
}

function renderSettingsScreen() {
  const s = appSettings || {};
  setScreen(`
    <div class="card">
      <h2>মাদরাসার সেটিংস</h2>
      <label>মাদরাসার নাম</label>
      <input id="settingsName" placeholder="মাদরাসার নাম লিখুন" value="${(s.madrasaName || '').replace(/"/g,'&quot;')}">
      <label>লোগো</label>
      <div style="margin:8px 0;">
        ${s.logoDataUrl ? `<img src="${s.logoDataUrl}" style="width:80px;height:80px;border-radius:10px;object-fit:cover;">` : '<p class="muted">এখনো কোনো লোগো সেট করা হয়নি</p>'}
      </div>
      <input type="file" id="settingsLogoFile" accept="image/*">
      <p id="settingsError" class="muted" style="color:#dc2626;"></p>
      <button onclick="saveSettings()" style="margin-top:10px;">সংরক্ষণ করুন</button>
      ${s.logoDataUrl ? `<button class="small danger" onclick="removeLogo()" style="margin-top:8px;">লোগো মুছুন</button>` : ''}
    </div>
    <div class="card">
      <h2>ডিবাগ মোড</h2>
      <p class="muted">চালু থাকলে অ্যাপে কোনো টেকনিক্যাল এরর হলে স্ক্রিনে লাল ব্যানারে দেখাবে — সমস্যা খুঁজে বের করতে সাহায্য করার জন্য। সাধারণ ব্যবহারের জন্য এটি বন্ধ রাখাই ভালো।</p>
      <label style="display:flex;align-items:center;gap:6px;margin-top:6px;">
        <input id="debugModeToggle" type="checkbox" style="width:auto;" ${debugMode ? 'checked' : ''} onchange="toggleDebugMode(this.checked)"> ডিবাগ মোড চালু করুন (শুধু এই ডিভাইসে)
      </label>
    </div>
  `);
}

function toggleDebugMode(on) {
  debugMode = !!on;
  localStorage.setItem('debugMode', debugMode ? '1' : '0');
}

function saveSettings() {
  const name = document.getElementById('settingsName').value.trim();
  const fileInput = document.getElementById('settingsLogoFile');
  const errEl = document.getElementById('settingsError');
  if (errEl) errEl.textContent = '';
  const file = fileInput && fileInput.files && fileInput.files[0];

  const doSave = (logoDataUrl) => {
    const data = { madrasaName: name };
    if (logoDataUrl !== undefined) data.logoDataUrl = logoDataUrl;
    db.collection('madrasas').doc(madrasaId).set(data, { merge: true })
      .then(() => { alert('সংরক্ষণ করা হয়েছে'); renderSettingsScreen(); })
      .catch(e => { if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; showDiagBanner('Settings সংরক্ষণ ব্যর্থ: ' + e.message); });
  };

  if (!file) { doSave(); return; }

  if (file.size > 500 * 1024) {
    if (errEl) errEl.textContent = 'লোগো ফাইলটি অনেক বড়, সর্বোচ্চ ৫০০KB পর্যন্ত দেওয়া যাবে';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => doSave(reader.result);
  reader.onerror = () => { if (errEl) errEl.textContent = 'ফাইল পড়তে সমস্যা হয়েছে'; };
  reader.readAsDataURL(file);
}

function removeLogo() {
  if (!confirm('লোগো মুছতে চান?')) return;
  db.collection('madrasas').doc(madrasaId).set({ logoDataUrl: '' }, { merge: true })
    .then(() => renderSettingsScreen())
    .catch(e => alert('মুছতে ব্যর্থ: ' + e.message));
}

// ================= CLASS FILTER HELPERS =================
function getClassList() {
  const set = new Set(studentsCache.map(s => s.className).filter(Boolean));
  return Array.from(set).sort();
}

function classFilterDropdownHtml(currentValue, onchangeFn) {
  const classes = getClassList();
  const opts = classes.map(c => `<option value="${c}" ${currentValue === c ? 'selected' : ''}>${c}</option>`).join('');
  return `
    <label>শ্রেণি বাছাই করুন</label>
    <select onchange="${onchangeFn}(this.value)">
      <option value="all" ${currentValue === 'all' ? 'selected' : ''}>সকল শ্রেণি</option>
      ${opts}
    </select>
  `;
}

function studentsByClass(filterValue) {
  if (!filterValue || filterValue === 'all') return studentsCache;
  return studentsCache.filter(s => s.className === filterValue);
}

// ================= UNREAD BADGES (student notices/diary) =================
function noticesSeenKey() { return 'lastSeenNotices_' + (myStudentId || 'x'); }
function diarySeenKey() { return 'lastSeenDiary_' + (myStudentId || 'x'); }

function iconWithBadge(icon, badgeCount, cls) {
  const badge = badgeCount
    ? `<span style="position:absolute;top:-4px;right:-6px;background:#dc2626;color:#fff;border-radius:10px;font-size:10px;min-width:16px;height:16px;line-height:16px;text-align:center;padding:0 3px;">${badgeCount > 9 ? '9+' : badgeCount}</span>`
    : '';
  return `<span class="${cls}" style="position:relative;display:inline-block;">${icon}${badge}</span>`;
}

function startUnreadListeners() {
  if (role !== 'student' || !myStudentId) return;
  startNoticesUnreadListener();
  startDiaryUnreadListener();
}

function startNoticesUnreadListener() {
  if (unreadNoticesUnsub) return; // already listening
  unreadNoticesUnsub = db.collection('notices')
    .where('madrasaId', '==', madrasaId)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const lastSeen = Number(localStorage.getItem(noticesSeenKey()) || 0);
      unreadCounts.notices = snap.docs.filter(d => (d.data().createdAt || 0) > lastSeen).length;
      if (role === 'student') renderStudentNav(currentStudentTab);
    }, err => showDiagBanner('নোটিশ আনরিড লোড এরর: ' + err.message));
}

function startDiaryUnreadListener() {
  const me = studentsCache.find(s => s.id === myStudentId);
  const myClass = me ? me.className : null;
  if (!myClass) return; // will retry once class info is loaded (see listenStudents)
  if (unreadDiaryUnsub && unreadDiaryUnsub.className === myClass) return; // already listening for this class
  if (unreadDiaryUnsub && unreadDiaryUnsub.unsub) unreadDiaryUnsub.unsub();
  const unsub = db.collection('diary')
    .where('madrasaId', '==', madrasaId)
    .where('className', '==', myClass)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const lastSeen = Number(localStorage.getItem(diarySeenKey()) || 0);
      unreadCounts.diary = snap.docs.filter(d => (d.data().createdAt || 0) > lastSeen).length;
      if (role === 'student') renderStudentNav(currentStudentTab);
    }, err => showDiagBanner('ডায়েরী আনরিড লোড এরর: ' + err.message));
  unreadDiaryUnsub = { unsub, className: myClass };
}

function stopUnreadListeners() {
  if (unreadNoticesUnsub) { unreadNoticesUnsub(); unreadNoticesUnsub = null; }
  if (unreadDiaryUnsub && unreadDiaryUnsub.unsub) { unreadDiaryUnsub.unsub(); unreadDiaryUnsub = null; }
  unreadCounts = { notices: 0, diary: 0 };
}

function markNoticesSeen() {
  localStorage.setItem(noticesSeenKey(), String(Date.now()));
  unreadCounts.notices = 0;
}

function markDiarySeen() {
  localStorage.setItem(diarySeenKey(), String(Date.now()));
  unreadCounts.diary = 0;
}

// ================= ROLE SELECT =================
function showRoleSelect() {
  setScreen(`
    <div class="card" style="text-align:center;margin-top:60px;">
      <h2>মাদরাসা হাজিরা অ্যাপ</h2>
      <p class="muted">আপনি কে?</p>
      <button onclick="pickRole('teacher')">👨‍🏫 শিক্ষক</button>
      <button class="secondary" onclick="pickRole('student')" style="margin-top:8px;">🎓 শিক্ষার্থী</button>
      <p style="margin-top:16px;"><a href="#" onclick="showSignupScreen();return false;">নতুন মাদ্রাসা? এখানে নিবন্ধন করুন</a></p>
    </div>
  `);
  hideNav();
}

function pickRole(r) {
  role = r;
  localStorage.setItem('role', r);
  if (r === 'teacher') {
    if (auth.currentUser && auth.currentUser.providerData.length > 0) showTeacherApp();
    else showTeacherLogin();
  } else {
    showStudentPicker();
  }
}

// ================= TEACHER LOGIN =================
function showTeacherLogin() {
  setScreen(`
    <div class="card" style="margin-top:40px;">
      <h2>শিক্ষক লগইন</h2>
      <label>ইমেইল</label><input id="loginEmail" type="email" placeholder="আপনার ইমেইল">
      <label>পাসওয়ার্ড</label><input id="loginPassword" type="password" placeholder="পাসওয়ার্ড">
      <p id="loginError" class="muted" style="color:#dc2626;"></p>
      <button onclick="teacherLogin()">লগইন করুন</button>
      <button class="secondary" onclick="logout()" style="margin-top:8px;">ফিরে যান</button>
      <p style="margin-top:16px;text-align:center;"><a href="#" onclick="showSignupScreen();return false;">নতুন মাদ্রাসা? এখানে নিবন্ধন করুন</a></p>
    </div>
  `);
  hideNav();
}

function teacherLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন'; return; }
  auth.signInWithEmailAndPassword(email, password)
    .then(user => ensureTeacherDoc(user.user || auth.currentUser))
    .then(() => runMigrationIfNeeded())
    .then(() => migratePinsIfNeeded())
    .then(() => migrateContactsIfNeeded())
    .then(() => { listenStudents(); listenSettings(); listenStudentContacts(); showTeacherApp(); })
    .catch(err => {
      errEl.textContent = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
        ? 'ইমেইল বা পাসওয়ার্ড সঠিক নয়'
        : 'লগইন ব্যর্থ: ' + err.message;
      showDiagBanner('Login ব্যর্থ: ' + err.message);
    });
}

// ================= SELF-SIGNUP (নতুন মাদ্রাসা নিবন্ধন) =================
// Lets a brand-new madrasa create its own account with NO manual Firebase
// Console steps: they get their own madrasaId, their own admin teacher
// account, and their own empty madrasas/{id} settings doc — all in one go.
//
// Sequencing matters here (see firestore.rules): the teacher doc must be
// created FIRST (it's allowed to self-create as isAdmin:true only for a
// madrasaId that has no madrasas/{id} doc yet — proving this is really a
// new tenant, not an attempt to self-promote into an existing one). Once
// that teacher doc exists, myMadrasaId() can resolve for this account, and
// only then is the madrasas/{id} settings doc allowed to be created.
function showSignupScreen() {
  setScreen(`
    <div class="card" style="margin-top:30px;">
      <h2>নতুন মাদ্রাসা নিবন্ধন করুন</h2>
      <p class="muted">নিজের মাদ্রাসার জন্য একটি নতুন, আলাদা অ্যাকাউন্ট তৈরি হবে — আপনার ডেটা অন্য কোনো মাদ্রাসার সাথে মিশবে না।</p>
      <label>মাদ্রাসার নাম</label><input id="signupMadrasaName" placeholder="যেমন: দারুল উলুম মাদ্রাসা">
      <label>আপনার নাম (অ্যাডমিন)</label><input id="signupAdminName" placeholder="আপনার নাম">
      <label>ইমেইল</label><input id="signupEmail" type="email" placeholder="আপনার ইমেইল">
      <label>পাসওয়ার্ড</label><input id="signupPassword" type="password" placeholder="কমপক্ষে ৬ অক্ষর">
      <p id="signupError" class="muted" style="color:#dc2626;"></p>
      <button onclick="submitSignup()">নিবন্ধন করুন</button>
      <button class="secondary" onclick="showTeacherLogin()" style="margin-top:8px;">আগে থেকে অ্যাকাউন্ট আছে? লগইন করুন</button>
    </div>
  `);
  hideNav();
}

function submitSignup() {
  const madrasaName = document.getElementById('signupMadrasaName').value.trim();
  const adminName = document.getElementById('signupAdminName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errEl = document.getElementById('signupError');
  if (errEl) errEl.textContent = '';

  if (!madrasaName) { if (errEl) errEl.textContent = 'মাদ্রাসার নাম দিন'; return; }
  if (!email || !password) { if (errEl) errEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন'; return; }
  if (password.length < 6) { if (errEl) errEl.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'; return; }

  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = 'নিবন্ধন করা হচ্ছে...'; }

  // A short random id is enough here — collisions are astronomically
  // unlikely, and firestore.rules' self-signup branch double-checks the
  // madrasas/{id} doc doesn't already exist before allowing the write
  // anyway, so even a collision would just fail safely rather than
  // overwrite someone else's data.
  const newMadrasaId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  signupInProgress = true;

  auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      const uid = cred.user.uid;
      // Step 1: create the teacher doc FIRST, as isAdmin:true, for the
      // brand-new madrasaId (allowed by firestore.rules' self-signup branch
      // since no madrasas/{newMadrasaId} doc exists yet).
      return db.collection('teachers').doc(uid).set({
        madrasaId: newMadrasaId, email, name: adminName, isAdmin: true, active: true, createdAt: Date.now()
      }).then(() => {
        // Step 2: now that this account's teacher doc exists, myMadrasaId()
        // resolves correctly, so the madrasas/{id} settings doc can be
        // created too.
        return db.collection('madrasas').doc(newMadrasaId).set({
          madrasaName, createdAt: Date.now()
        });
      });
    })
    .then(() => {
      madrasaId = newMadrasaId;
      localStorage.setItem('madrasaId', madrasaId);
      role = 'teacher';
      localStorage.setItem('role', 'teacher');
      myTeacherIsAdmin = true;
      signupInProgress = false;
      listenStudents();
      listenSettings();
      listenStudentContacts();
      showTeacherApp();
    })
    .catch(e => {
      signupInProgress = false;
      if (btn) { btn.disabled = false; btn.textContent = 'নিবন্ধন করুন'; }
      const msg = e.code === 'auth/email-already-in-use' ? 'এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে, লগইন করুন'
        : e.code === 'auth/invalid-email' ? 'ইমেইলটি সঠিক নয়'
        : e.code === 'auth/weak-password' ? 'পাসওয়ার্ড দুর্বল, আরেকটু শক্তিশালী দিন'
        : 'নিবন্ধন ব্যর্থ: ' + e.message;
      if (errEl) errEl.textContent = msg;
      showDiagBanner('মাদ্রাসা নিবন্ধন ব্যর্থ: ' + e.message);
    });
}

// ================= STUDENT PIN LOGIN =================
function showStudentPicker() {
  const opts = studentsCache.map(s => `<option value="${s.id}">${s.name} (${s.roll || ''})</option>`).join('');
  setScreen(`
    <div class="card">
      <h2>আপনার নাম নির্বাচন করুন</h2>
      <select id="studentPick">${opts || '<option>কোনো শিক্ষার্থী যোগ করা হয়নি</option>'}</select>
      <label>আপনার PIN দিন</label>
      <input id="studentPinInput" type="password" inputmode="numeric" maxlength="4" placeholder="৪ সংখ্যার PIN">
      <p id="pinError" class="muted" style="color:#dc2626;"></p>
      <button onclick="confirmStudentPick()">প্রবেশ করুন</button>
      <button class="secondary" onclick="logout()">ফিরে যান</button>
    </div>
  `);
  hideNav();
}

function confirmStudentPick() {
  const sel = document.getElementById('studentPick');
  const pinInput = document.getElementById('studentPinInput');
  const errEl = document.getElementById('pinError');
  if (errEl) errEl.textContent = '';
  if (!sel || !sel.value) return alert('তালিকায় কোনো শিক্ষার্থী নেই। আগে শিক্ষককে যোগ করতে বলুন।');

  const student = studentsCache.find(s => s.id === sel.value);
  const enteredPin = (pinInput.value || '').trim();

  if (!student) return alert('শিক্ষার্থী খুঁজে পাওয়া যায়নি');
  if (!enteredPin) {
    if (errEl) errEl.textContent = 'PIN দিন';
    return;
  }
  if (!student.hasPinSet) {
    if (errEl) errEl.textContent = 'এই শিক্ষার্থীর জন্য এখনো PIN সেট করা হয়নি। শিক্ষককে জানান।';
    return;
  }

  // The PIN itself is never checked here on the client (it can't be — this
  // device is never allowed to read the real PIN). Instead we attempt to
  // create the session doc with the entered PIN attached, and a Firestore
  // rule checks it server-side against student_pins/{studentId}. A wrong
  // PIN makes the write itself fail with "permission-denied".
  const uid = auth.currentUser.uid;
  db.collection('sessions').doc(uid).set({
    studentId: student.id, madrasaId, name: student.name, pin: enteredPin, updatedAt: Date.now()
  }, { merge: true })
    .then(() => {
      myStudentId = student.id;
      localStorage.setItem('myStudentId', myStudentId);
      showStudentApp();
    })
    .catch(e => {
      if (e.code === 'permission-denied') {
        if (errEl) errEl.textContent = 'ভুল PIN দিয়েছেন';
      } else {
        if (errEl) errEl.textContent = 'প্রবেশ ব্যর্থ: ' + e.message;
        showDiagBanner('Session সংরক্ষণ ব্যর্থ: ' + e.message);
      }
    });
}

function logout() {
  // Tear down any live listeners *before* switching auth state — otherwise
  // they keep firing during the brief window where request.auth is null
  // (between signOut and the automatic anonymous re-sign-in), which used to
  // surface a burst of harmless "Missing or insufficient permissions"
  // errors on the diagnostic banner.
  if (studentsUnsub) { studentsUnsub(); studentsUnsub = null; }
  if (settingsUnsub) { settingsUnsub(); settingsUnsub = null; }
  stopStudentContactsListener();
  stopTeachersListener();
  stopUnreadListeners();

  if (role === 'teacher' && auth.currentUser && auth.currentUser.providerData.length > 0) auth.signOut();
  localStorage.removeItem('role');
  localStorage.removeItem('myStudentId');
  role = null; myStudentId = null; myTeacherIsAdmin = false;
  showRoleSelect();
}

// ================= NAV =================
function hideNav() {
  closeMoreMenu();
  document.getElementById('bottomNav').style.display = 'none';
}
function setScreen(html) { document.getElementById('app').innerHTML = html; }

function buildNavHtml(primaryTabs, moreTabs, tabFnName, activeKey, badges) {
  badges = badges || {};

  const primaryHtml = primaryTabs.map(t => `
    <button class="tab-btn ${activeKey === t.key ? 'active' : ''}" onclick="${tabFnName}('${t.key}')">
      ${iconWithBadge(t.icon, badges[t.key], 'tab-icon')}
      <span>${t.label}</span>
    </button>
  `).join('');

  const moreActive = moreTabs.some(t => t.key === activeKey);
  const moreBadgeTotal = moreTabs.reduce((sum, t) => sum + (badges[t.key] || 0), 0);
  const moreBtnHtml = `
    <button class="tab-btn ${moreActive ? 'active' : ''}" onclick="toggleMoreMenu()">
      ${iconWithBadge('\u2022\u2022\u2022', moreBadgeTotal, 'tab-icon')}
      <span>আরও</span>
    </button>
  `;

  const moreItemsHtml = moreTabs.map(t => `
    <div class="more-item ${activeKey === t.key ? 'active' : ''}" onclick="${tabFnName}('${t.key}'); closeMoreMenu();">
      ${iconWithBadge(t.icon, badges[t.key], 'more-icon')}
      <span>${t.label}</span>
    </div>
  `).join('');

  return `
    <div class="tabs-primary">${primaryHtml}${moreBtnHtml}</div>
    <div id="moreSheetBackdrop" class="more-sheet-backdrop" style="display:none;" onclick="closeMoreMenu()"></div>
    <div id="moreSheet" class="more-sheet" style="display:none;">
      <div class="more-title">সব মেনু</div>
      <div class="more-grid">${moreItemsHtml}</div>
    </div>
  `;
}

function toggleMoreMenu() {
  const sheet = document.getElementById('moreSheet');
  const backdrop = document.getElementById('moreSheetBackdrop');
  if (!sheet || !backdrop) return;
  const isOpen = sheet.style.display === 'block';
  sheet.style.display = isOpen ? 'none' : 'block';
  backdrop.style.display = isOpen ? 'none' : 'block';
}

function closeMoreMenu() {
  const sheet = document.getElementById('moreSheet');
  const backdrop = document.getElementById('moreSheetBackdrop');
  if (sheet) sheet.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
}

function renderTeacherNav(activeKey) {
  const nav = document.getElementById('bottomNav');
  nav.style.display = 'block';
  // "শিক্ষকগণ" (multi-admin management) is only shown to admin teachers —
  // filtered out of the "আরও" menu entirely for non-admin teacher accounts.
  const visibleMoreTabs = myTeacherIsAdmin ? teacherMoreTabs : teacherMoreTabs.filter(t => t.key !== 'teachers');
  nav.innerHTML = buildNavHtml(teacherPrimaryTabs, visibleMoreTabs, 'teacherTab', activeKey);
}

function renderStudentNav(activeKey) {
  const nav = document.getElementById('bottomNav');
  nav.style.display = 'block';
  nav.innerHTML = buildNavHtml(studentPrimaryTabs, studentMoreTabs, 'studentTab', activeKey, unreadCounts);
}

function showTeacherApp() {
  teacherTab('students');
}

function showStudentApp() {
  startUnreadListeners();
  studentTab('attendance');
}

// ================= STUDENTS (shared, realtime) =================
function listenStudents() {
  if (studentsUnsub) { studentsUnsub(); studentsUnsub = null; }
  studentsUnsub = db.collection('students')
    .where('madrasaId', '==', madrasaId)
    .orderBy('roll')
    .onSnapshot(snap => {
      studentsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSync(true);
      // refresh currently visible screen if it depends on student list
      if (role === 'teacher' && document.getElementById('studentsScreen')) renderStudentsList();
      if (role === 'teacher' && document.getElementById('attendanceScreen')) renderAttendanceList();
      if (role === 'student' && myStudentId) startDiaryUnreadListener();
    }, err => {
      setSync(false);
      // Ignore permission-denied here: this fires briefly during logout /
      // role switches while auth is momentarily unresolved, and the
      // listener re-attaches with a valid session moments later anyway.
      if (err.code !== 'permission-denied') {
        showDiagBanner('স্টুডেন্ট লিস্ট লোড এরর (madrasaId=' + madrasaId + '): ' + err.message);
      }
    });
}

// ================= STUDENT CONTACTS (phone/WhatsApp — teacher-only, separate from students) =================
// Kept in its own collection (not on students/{id}) so phone numbers are
// never exposed by the open `students` read rule. Only loaded for
// signed-in teacher accounts; students never need or can read this.
function listenStudentContacts() {
  if (studentContactsUnsub) { studentContactsUnsub(); studentContactsUnsub = null; }
  studentContactsUnsub = db.collection('student_contacts')
    .where('madrasaId', '==', madrasaId)
    .onSnapshot(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      studentContactsCache = map;
      if (role === 'teacher' && document.getElementById('studentsScreen')) renderStudentsList();
    }, err => {
      // Ignore permission-denied: fires briefly during logout/role-switch
      // while auth is momentarily unresolved, same pattern as other listeners.
      if (err.code !== 'permission-denied') showDiagBanner('যোগাযোগ তথ্য লোড এরর: ' + err.message);
    });
}

function stopStudentContactsListener() {
  if (studentContactsUnsub) { studentContactsUnsub(); studentContactsUnsub = null; }
  studentContactsCache = {};
}

// ================= TEACHERS (শিক্ষকগণ — multi-admin management, teacher-admin-only) =================
function stopTeachersListener() {
  if (teachersUnsub) { teachersUnsub(); teachersUnsub = null; }
}

function teacherTab(tab) {
  renderTeacherNav(tab);
  if (tab === 'students') renderStudentsScreen();
  if (tab === 'attendance') renderAttendanceScreen();
  if (tab === 'report') renderReportScreen();
  if (tab === 'leaves') renderLeavesScreen(true);
  if (tab === 'results') { currentMarksheetSubjects = []; renderResultsScreen(true); }
  if (tab === 'timeleft') renderTimeLeftScreen();
  if (tab === 'fees') renderFeesScreen(true);
  if (tab === 'notices') renderNoticesScreen(true);
  if (tab === 'diary') renderDiaryScreen(true);
  if (tab === 'suggestions') renderSuggestionsScreen(true);
  if (tab === 'teachers') { if (myTeacherIsAdmin) renderTeachersScreen(); else teacherTab('students'); }
  if (tab === 'settings') renderSettingsScreen();
}

function studentTab(tab) {
  currentStudentTab = tab;
  if (tab === 'notices') markNoticesSeen();
  if (tab === 'diary') markDiarySeen();
  renderStudentNav(tab);
  if (tab === 'attendance') renderMyAttendance();
  if (tab === 'leaves') renderLeavesScreen(false);
  if (tab === 'fees') renderFeesScreen(false);
  if (tab === 'results') renderResultsScreen(false);
  if (tab === 'notices') renderNoticesScreen(false);
  if (tab === 'diary') renderDiaryScreen(false);
  if (tab === 'suggestions') renderSuggestionsScreen(false);
}

// ---- Students list (teacher) ----
function renderStudentsScreen() {
  setScreen(`
    <div id="studentsScreen">
      <div class="card">
        <h2>নতুন শিক্ষার্থী যোগ করুন</h2>
        <label>নাম</label><input id="newName" placeholder="শিক্ষার্থীর নাম">
        <label>রোল</label><input id="newRoll" placeholder="রোল নম্বর">
        <label>শ্রেণি</label><input id="newClass" placeholder="শ্রেণি">
        <label>মোবাইল নম্বর</label><input id="newPhone" type="tel" placeholder="যেমন: 01712345678">
        <label style="display:flex;align-items:center;gap:6px;margin-top:6px;">
          <input id="newWhatsapp" type="checkbox" style="width:auto;"> এই নম্বরে WhatsApp আছে
        </label>
        <label>PIN (৪ সংখ্যা)</label><input id="newPin" type="text" inputmode="numeric" maxlength="4" placeholder="যেমন: 1234">
        <button onclick="addStudent()">যোগ করুন</button>
      </div>
      <div class="card">
        <h2>শিক্ষার্থী তালিকা</h2>
        <div id="studentsFilterWrap"></div>
        <div id="studentsCountWrap"></div>
        <div id="studentsListWrap"></div>
      </div>
    </div>
  `);
  renderStudentsList();
}

function onStudentsClassFilterChange(value) {
  studentsClassFilter = value;
  renderStudentsList();
}

function renderStudentsList() {
  const filterWrap = document.getElementById('studentsFilterWrap');
  if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(studentsClassFilter, 'onStudentsClassFilterChange');

  const countWrap = document.getElementById('studentsCountWrap');
  if (countWrap) {
    const total = studentsCache.length;
    if (studentsClassFilter === 'all') {
      countWrap.innerHTML = `<p class="muted">মোট শিক্ষার্থী: <b>${total}</b> জন</p>`;
    } else {
      const filteredCount = studentsByClass(studentsClassFilter).length;
      countWrap.innerHTML = `<p class="muted">${studentsClassFilter} শ্রেণিতে: <b>${filteredCount}</b> জন &nbsp; (সর্বমোট: ${total} জন)</p>`;
    }
  }

  const wrap = document.getElementById('studentsListWrap');
  if (!wrap) return;
  const list = studentsByClass(studentsClassFilter);
  if (list.length === 0) { wrap.innerHTML = '<p class="muted">কোনো শিক্ষার্থী নেই</p>'; return; }
  wrap.innerHTML = list.map(s => {
    const contact = studentContactsCache[s.id] || {};
    return `
    <div class="student-row" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>${s.name} <span class="muted">(রোল ${s.roll || '-'}, ${s.className || '-'})</span></span>
        ${contact.hasWhatsapp && contact.phone ? `<a href="https://wa.me/${normalizePhoneForWhatsapp(contact.phone)}" target="_blank" style="text-decoration:none;font-size:20px;" title="WhatsApp-এ মেসেজ পাঠান">💬</a>` : ''}
      </div>
      <div class="muted" style="margin-top:2px;">
        ${contact.phone ? '📱 ' + contact.phone : 'মোবাইল নম্বর নেই'} &nbsp; ${s.hasPinSet ? '✅ PIN সেট' : '❌ PIN নেই'}
      </div>
      <div style="margin-top:6px;">
        <button class="small secondary" onclick="setStudentPin('${s.id}')">PIN সেট/পরিবর্তন</button>
        <button class="small secondary" onclick="setStudentPhone('${s.id}')">নম্বর সম্পাদনা</button>
        <button class="small danger" onclick="deleteStudent('${s.id}')">মুছুন</button>
      </div>
    </div>
  `;
  }).join('');
}

function normalizePhoneForWhatsapp(phone) {
  let p = (phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '88' + p; // Bangladeshi local -> international
  return p;
}

function setStudentPhone(id) {
  const existing = studentContactsCache[id] || {};
  const phone = prompt('মোবাইল নম্বর দিন (যেমন: 01712345678):', existing.phone || '');
  if (phone === null) return; // cancelled
  const trimmed = phone.trim();
  const hasWhatsapp = trimmed ? confirm('এই নম্বরে কি WhatsApp আছে?') : false;
  db.collection('student_contacts').doc(id).set({ madrasaId, phone: trimmed, hasWhatsapp }, { merge: true })
    .catch(e => { alert('সংরক্ষণ ব্যর্থ: ' + e.message); showDiagBanner('ফোন সংরক্ষণ ব্যর্থ: ' + e.message); });
}

function addStudent() {
  const name = document.getElementById('newName').value.trim();
  const roll = document.getElementById('newRoll').value.trim();
  const className = document.getElementById('newClass').value.trim();
  const phone = document.getElementById('newPhone').value.trim();
  const hasWhatsapp = document.getElementById('newWhatsapp').checked;
  const pin = document.getElementById('newPin').value.trim();
  if (!name) return alert('নাম দিন');
  if (pin && !/^\d{4}$/.test(pin)) return alert('PIN অবশ্যই ৪ সংখ্যার হতে হবে');

  const clearForm = () => {
    document.getElementById('newName').value = '';
    document.getElementById('newRoll').value = '';
    document.getElementById('newClass').value = '';
    document.getElementById('newPhone').value = '';
    document.getElementById('newWhatsapp').checked = false;
    document.getElementById('newPin').value = '';
  };

  db.collection('students').add({ madrasaId, name, roll, className, hasPinSet: !!pin, createdAt: Date.now() })
    .then(docRef => {
      let chain = Promise.resolve();
      if (phone || hasWhatsapp) {
        chain = chain.then(() => db.collection('student_contacts').doc(docRef.id).set({ madrasaId, phone, hasWhatsapp }));
      }
      if (pin) {
        chain = chain.then(() => db.collection('student_pins').doc(docRef.id).set({ pin }));
      }
      return chain.then(clearForm);
    })
    .catch(e => { alert('সংরক্ষণ ব্যর্থ: ' + e.message); showDiagBanner('স্টুডেন্ট যোগ ব্যর্থ (madrasaId=' + madrasaId + '): ' + e.message); });
}

function setStudentPin(id) {
  const pin = prompt('শিক্ষার্থীর জন্য ৪-সংখ্যার PIN দিন:');
  if (pin === null) return; // cancelled
  if (!/^\d{4}$/.test(pin)) { alert('PIN অবশ্যই ৪ সংখ্যার হতে হবে'); return; }
  db.collection('student_pins').doc(id).set({ pin }, { merge: true })
    .then(() => db.collection('students').doc(id).set({ hasPinSet: true }, { merge: true }))
    .catch(e => { alert('PIN সংরক্ষণ ব্যর্থ: ' + e.message); showDiagBanner('PIN সংরক্ষণ ব্যর্থ: ' + e.message); });
}

function deleteStudent(id) {
  if (!confirm('সত্যিই মুছতে চান?')) return;
  db.collection('students').doc(id).delete();
  db.collection('student_contacts').doc(id).delete().catch(() => {});
  db.collection('student_pins').doc(id).delete().catch(() => {});
}

// ---- Attendance (teacher marks, shared) ----
function renderAttendanceScreen() {
  const today = new Date().toISOString().slice(0,10);
  setScreen(`
    <div id="attendanceScreen">
      <div class="card">
        <h2>উপস্থিতি নেওয়ার তারিখ</h2>
        <input type="date" id="attDate" value="${today}" onchange="loadAttendanceForDate()">
        <div id="attFilterWrap"></div>
      </div>
      <div id="attList"></div>
    </div>
  `);
  loadAttendanceForDate();
}

function onAttClassFilterChange(value) {
  attClassFilter = value;
  renderAttendanceList();
}

function loadAttendanceForDate() {
  renderAttendanceList();
}

function renderAttendanceList() {
  const filterWrap = document.getElementById('attFilterWrap');
  if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(attClassFilter, 'onAttClassFilterChange');

  const dateEl = document.getElementById('attDate');
  const list = document.getElementById('attList');
  if (!dateEl || !list) return;
  const date = dateEl.value;
  const students = studentsByClass(attClassFilter);
  if (students.length === 0) { list.innerHTML = '<p class="muted">শিক্ষার্থী তালিকা খালি</p>'; return; }
  list.innerHTML = students.map(s => `<div class="card" id="att_${s.id}">লোড হচ্ছে...</div>`).join('');
  students.forEach(s => loadAttendanceCell(s, date));
}

// Loads (or reloads) a single student's attendance card. Pulled out of
// renderAttendanceList so a failed card can retry itself without having to
// re-fetch every other student too.
//
// IMPORTANT: this always resolves the card to a definite end state — either
// the real controls, or a visible "লোড ব্যর্থ" + রিট্রাই button. It never
// leaves a card silently stuck on "লোড হচ্ছে..." the way the old code did
// when db.collection('attendance').doc(...).get() rejected (e.g. on a
// permission-denied for a student whose attendance doc doesn't exist yet
// for this date) and the .catch() did nothing to the DOM.
function loadAttendanceCell(s, date) {
  const cell = document.getElementById('att_' + s.id);
  if (cell) cell.innerHTML = 'লোড হচ্ছে...';

  // Belt-and-suspenders timeout: if Firestore never settles the promise at
  // all (e.g. stuck offline with no cached data), don't leave the card
  // stuck forever either — show the same retry state after 15s.
  let settled = false;
  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    renderAttendanceCellError(s, date, { message: 'সময় শেষ (নেটওয়ার্ক ধীর হতে পারে)' });
  }, 15000);

  db.collection('attendance').doc(s.id + '_' + date).get()
    .then(doc => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      const d = doc.exists ? doc.data() : {};
      const liveCell = document.getElementById('att_' + s.id);
      if (!liveCell) return;
      liveCell.innerHTML = `
        <b>${s.name}</b> <span class="muted">(${s.className || '-'})</span>
        <div class="row" style="margin-top:6px;">
          <button class="small ${d.status==='present'?'':'secondary'}" onclick="setAttendance('${s.id}','${date}','present')">উপস্থিত</button>
          <button class="small ${d.status==='absent'?'danger':'secondary'}" onclick="setAttendance('${s.id}','${date}','absent')">অনুপস্থিত</button>
        </div>
        <label>বাসা থেকে বের হওয়ার সময়</label>
        <input type="time" value="${d.timeLeftHome||''}" onchange="updateAttField('${s.id}','${date}','timeLeftHome',this.value)">
        <label>অনুপস্থিতির কারণ (যদি থাকে)</label>
        <input value="${d.reason||''}" onchange="updateAttField('${s.id}','${date}','reason',this.value)">
      `;
    })
    .catch(e => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      renderAttendanceCellError(s, date, e);
      // Show every load failure here (not just non-permission-denied ones)
      // since this is a foreground screen the teacher is actively looking
      // at, not a background listener — silently hiding it is what made
      // the card look stuck for no visible reason.
      showDiagBanner('অ্যাটেন্ডেন্স লোড ব্যর্থ (' + s.name + '): ' + (e.code || '') + ' ' + e.message);
    });
}

function renderAttendanceCellError(s, date, e) {
  const cell = document.getElementById('att_' + s.id);
  if (!cell) return;
  cell.innerHTML = `
    <b>${s.name}</b> <span class="muted">(${s.className || '-'})</span>
    <p class="muted" style="color:#dc2626;margin:6px 0;">লোড করতে সমস্যা হয়েছে${e && e.message ? ' (' + e.message + ')' : ''}</p>
    <button class="small secondary" onclick="retryAttendanceCell('${s.id}','${date}')">আবার চেষ্টা করুন</button>
  `;
}

function retryAttendanceCell(studentId, date) {
  const s = studentsCache.find(st => st.id === studentId);
  if (!s) return;
  loadAttendanceCell(s, date);
}

function setAttendance(studentId, date, status) {
  db.collection('attendance').doc(studentId + '_' + date).set({ studentId, date, status, madrasaId }, { merge: true })
    .then(() => updateAttendanceButtonsUI(studentId, status))
    .catch(e => showDiagBanner('অ্যাটেন্ডেন্স সংরক্ষণ ব্যর্থ: ' + e.message));
}

// Updates just the clicked student's present/absent buttons in place,
// instead of re-fetching and re-rendering every student's card (which used
// to make the whole attendance list flash "লোড হচ্ছে..." and reload on
// every single tap).
function updateAttendanceButtonsUI(studentId, status) {
  const cell = document.getElementById('att_' + studentId);
  if (!cell) return;
  const buttons = cell.querySelectorAll('.row button');
  if (buttons[0]) buttons[0].className = 'small' + (status === 'present' ? '' : ' secondary');
  if (buttons[1]) buttons[1].className = 'small' + (status === 'absent' ? ' danger' : ' secondary');
}

function updateAttField(studentId, date, field, value) {
  db.collection('attendance').doc(studentId + '_' + date).set({ studentId, date, madrasaId, [field]: value }, { merge: true })
    .catch(e => showDiagBanner('অ্যাটেন্ডেন্স ফিল্ড সংরক্ষণ ব্যর্থ: ' + e.message));
}

// ---- Student's own attendance view ----
function renderMyAttendance() {
  const today = new Date().toISOString().slice(0,10);
  setScreen(`
    <div class="card">
      <h2>আজ বাসা থেকে বের হওয়ার সময়</h2>
      <input type="time" id="myTimeLeft" onchange="submitMyTimeLeft()">
      <p class="muted" style="margin-top:6px;">তারিখ: ${today}</p>
    </div>
    <div class="card"><h2>আমার সাম্প্রতিক উপস্থিতি</h2><div id="myAttWrap">লোড হচ্ছে...</div></div>
  `);

  // pre-fill today's time if already set
  db.collection('attendance').doc(myStudentId + '_' + today).get().then(doc => {
    const el = document.getElementById('myTimeLeft');
    if (el && doc.exists && doc.data().timeLeftHome) el.value = doc.data().timeLeftHome;
  });

  db.collection('attendance').where('studentId', '==', myStudentId)
    .onSnapshot(snap => {
      const wrap = document.getElementById('myAttWrap');
      if (!wrap) return;
      if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো তথ্য নেই</p>'; return; }
      const rows = snap.docs.map(d => d.data()).sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0,30);
      wrap.innerHTML = rows.map(r => {
        return `<div class="student-row">
          <span>${r.date}</span>
          <span class="badge ${r.status}">${r.status==='present'?'উপস্থিত':'অনুপস্থিত'}</span>
        </div>
        ${r.timeLeftHome ? `<div class="muted">বের হওয়ার সময়: ${r.timeLeftHome}</div>` : ''}
        ${r.reason ? `<div class="muted">কারণ: ${r.reason}</div>` : ''}`;
      }).join('<hr style="border:none;border-top:1px solid #eee;margin:6px 0;">');
    }, err => {
      const wrap = document.getElementById('myAttWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
      showDiagBanner('আমার উপস্থিতি লোড এরর: ' + err.message);
    });
}

function submitMyTimeLeft() {
  const today = new Date().toISOString().slice(0,10);
  const value = document.getElementById('myTimeLeft').value;
  if (!value) return;
  db.collection('attendance').doc(myStudentId + '_' + today).set({
    studentId: myStudentId, date: today, madrasaId, timeLeftHome: value
  }, { merge: true }).catch(e => showDiagBanner('বের হওয়ার সময় সংরক্ষণ ব্যর্থ: ' + e.message));
}

// ---- Leaves ----
function renderLeavesScreen(isTeacher) {
  let html = '';
  if (!isTeacher) {
    const today = new Date().toISOString().slice(0,10);
    html += `
      <div class="card">
        <h2>ছুটির আবেদন করুন</h2>
        <label>তারিখ</label><input type="date" id="leaveDate" value="${today}">
        <label>কারণ</label><textarea id="leaveReason" rows="3"></textarea>
        <button onclick="submitLeave()">আবেদন জমা দিন</button>
      </div>`;
  }
  html += `<div class="card">
    <h2>${isTeacher ? 'সকল ছুটির আবেদন' : 'আমার আবেদনসমূহ'}</h2>
    ${isTeacher ? '<div id="leavesFilterWrap"></div>' : ''}
    <div id="leavesWrap">লোড হচ্ছে...</div>
  </div>`;
  setScreen(html);

  if (isTeacher) {
    const filterWrap = document.getElementById('leavesFilterWrap');
    if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(leavesClassFilter, 'onLeavesClassFilterChange');
  }

  let q = db.collection('leaves');
  if (isTeacher) q = q.where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc');
  else q = q.where('studentId', '==', myStudentId);

  q.onSnapshot(snap => {
    const wrap = document.getElementById('leavesWrap');
    if (!wrap) return;
    if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো আবেদন নেই</p>'; return; }
    let docs = snap.docs;
    if (!isTeacher) docs = [...docs].sort((a,b) => (b.data().createdAt||0) - (a.data().createdAt||0));

    if (isTeacher && leavesClassFilter !== 'all') {
      docs = docs.filter(d => {
        const student = studentsCache.find(s => s.id === d.data().studentId);
        return student && student.className === leavesClassFilter;
      });
    }

    if (docs.length === 0) { wrap.innerHTML = '<p class="muted">এই শ্রেণিতে কোনো আবেদন নেই</p>'; return; }

    wrap.innerHTML = docs.map(d => {
      const r = d.data();
      const student = studentsCache.find(s => s.id === r.studentId);
      const statusText = { pending: 'অপেক্ষমাণ', approved: 'অনুমোদিত', rejected: 'প্রত্যাখ্যাত' }[r.status] || 'অপেক্ষমাণ';
      return `<div class="student-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;">
          <b>${isTeacher ? (student ? student.name + (student.className ? ' (' + student.className + ')' : '') : 'অজানা') : r.date}</b>
          <span class="badge ${r.status||'pending'}">${statusText}</span>
        </div>
        <div class="muted">${isTeacher ? 'তারিখ: ' + r.date : ''}</div>
        <div>${r.reason}</div>
        ${isTeacher ? `
          <button class="small" onclick="setLeaveStatus('${d.id}','approved')">অনুমোদন</button>
          <button class="small danger" onclick="setLeaveStatus('${d.id}','rejected')">প্রত্যাখ্যান</button>
        ` : ''}
      </div>`;
    }).join('');
  }, err => {
    const wrap = document.getElementById('leavesWrap');
    if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
    showDiagBanner('ছুটির আবেদন লোড এরর: ' + err.message);
  });
}

function onLeavesClassFilterChange(value) {
  leavesClassFilter = value;
  renderLeavesScreen(true);
}

function submitLeave() {
  const date = document.getElementById('leaveDate').value;
  const reason = document.getElementById('leaveReason').value.trim();
  if (!reason) return alert('কারণ লিখুন');
  db.collection('leaves').add({ madrasaId, studentId: myStudentId, date, reason, status: 'pending', createdAt: Date.now() })
    .then(() => { document.getElementById('leaveReason').value=''; })
    .catch(e => showDiagBanner('ছুটির আবেদন সংরক্ষণ ব্যর্থ: ' + e.message));
}

function setLeaveStatus(id, status) {
  db.collection('leaves').doc(id).update({ status }).catch(e => showDiagBanner('ছুটি স্ট্যাটাস আপডেট ব্যর্থ: ' + e.message));
}

// ================= RESULTS / MARKSHEET =================
function gradeFromPercent(percent) {
  if (percent >= 80) return { grade: 'A+', gpa: '5.00' };
  if (percent >= 70) return { grade: 'A', gpa: '4.00' };
  if (percent >= 60) return { grade: 'A-', gpa: '3.50' };
  if (percent >= 50) return { grade: 'B', gpa: '3.00' };
  if (percent >= 40) return { grade: 'C', gpa: '2.00' };
  if (percent >= 33) return { grade: 'D', gpa: '1.00' };
  return { grade: 'F', gpa: '0.00' };
}

function renderResultsScreen(isTeacher) {
  lastResultsIsTeacher = isTeacher;
  let html = '';
  if (isTeacher) {
    const students = studentsByClass(resultsClassFilter);
    const opts = students.map(s => `<option value="${s.id}">${s.name} (${s.roll || ''})</option>`).join('');
    html += `
      <div class="card">
        <h2>নতুন মার্কশিট তৈরি করুন</h2>
        <div id="resultsFilterWrap"></div>
        <label>শিক্ষার্থী</label><select id="resStudent">${opts || '<option value="">কোনো শিক্ষার্থী নেই</option>'}</select>
        <label>পরীক্ষার নাম</label><input id="resExam" placeholder="যেমন: অর্ধবার্ষিক পরীক্ষা ২০২৬">
        <label>শিক্ষাবর্ষ</label><input id="resAcademicYear" placeholder="যেমন: ২০২৬" value="${new Date().getFullYear()}">
        <hr style="border:none;border-top:1px solid #eee;margin:10px 0;">
        <label>বিষয়ের নাম</label><input id="resSubjectName" placeholder="যেমন: আরবি">
        <label>পূর্ণ নম্বর</label><input id="resSubjectFull" type="number" value="100">
        <label>প্রাপ্ত নম্বর</label><input id="resSubjectObtained" type="number">
        <button class="secondary" onclick="addSubjectRow()">+ বিষয় যোগ করুন</button>
        <div id="subjectRowsWrap" style="margin-top:10px;"></div>
        <button onclick="saveMarksheet()" style="margin-top:10px;">মার্কশিট সংরক্ষণ করুন</button>
      </div>`;
  }
  html += `<div class="card"><h2>${isTeacher ? 'সকল মার্কশিট' : 'আমার রেজাল্ট'}</h2><div id="resultsWrap">লোড হচ্ছে...</div></div>`;
  setScreen(html);

  if (isTeacher) {
    const filterWrap = document.getElementById('resultsFilterWrap');
    if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(resultsClassFilter, 'onResultsClassFilterChange');
    renderSubjectRows();
    attachResultsFastEntryHandlers();
  }

  let q = db.collection('results');
  if (isTeacher) {
    q = q.where('madrasaId', '==', madrasaId).orderBy('date', 'desc');
  } else {
    q = q.where('studentId', '==', myStudentId).where('published', '==', true);
  }

  q.onSnapshot(snap => {
    const wrap = document.getElementById('resultsWrap');
    if (!wrap) return;
    if (snap.empty) { wrap.innerHTML = `<p class="muted">${isTeacher ? 'কোনো রেজাল্ট নেই' : 'এখনো কোনো রেজাল্ট প্রকাশ করা হয়নি'}</p>`; return; }
    let docs = snap.docs;
    if (!isTeacher) docs = [...docs].sort((a,b) => (b.data().date||'').localeCompare(a.data().date||''));

    if (isTeacher && resultsClassFilter !== 'all') {
      docs = docs.filter(d => {
        const student = studentsCache.find(s => s.id === d.data().studentId);
        return student && student.className === resultsClassFilter;
      });
    }

    if (docs.length === 0) { wrap.innerHTML = '<p class="muted">এই শ্রেণিতে কোনো রেজাল্ট নেই</p>'; return; }

    wrap.innerHTML = docs.map(d => {
      const r = d.data();
      const student = studentsCache.find(s => s.id === r.studentId);
      const nameLine = isTeacher ? (student ? student.name + (student.className ? ' (' + student.className + ')' : '') : 'অজানা') : '';
      const hasMarksheet = Array.isArray(r.subjects) && r.subjects.length > 0;
      const summary = hasMarksheet
        ? `${r.totalObtained}/${r.totalFull} &nbsp; <span class="badge">${r.grade}</span>`
        : (r.marks !== undefined ? `${r.marks}` : '');
      const isPublished = r.published === true;
      return `<div class="student-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>${nameLine ? nameLine + ' - ' : ''}${r.examName}</span>
          <span>${summary}</span>
        </div>
        ${isTeacher ? `<div class="muted" style="margin-top:2px;">${isPublished ? '✅ প্রকাশিত (শিক্ষার্থী দেখতে পারবে)' : '🔒 অপ্রকাশিত (শুধু শিক্ষক দেখতে পারবে)'}</div>` : ''}
        <div style="margin-top:6px;">
          <button class="small secondary" onclick="viewMarksheet('${r.studentId}','${d.id}')">মার্কশিট দেখুন</button>
          ${isTeacher ? `<button class="small ${isPublished ? 'secondary' : ''}" onclick="togglePublish('${d.id}', ${isPublished})">${isPublished ? 'স্থগিত করুন' : 'প্রকাশ করুন'}</button>` : ''}
          ${isTeacher ? `<button class="small danger" onclick="deleteMarksheet('${d.id}')">মুছুন</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }, err => {
    const wrap = document.getElementById('resultsWrap');
    if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
    if (err.code !== 'permission-denied') showDiagBanner('রেজাল্ট লোড এরর: ' + err.message);
  });
}

function onResultsClassFilterChange(value) {
  resultsClassFilter = value;
  renderResultsScreen(true);
}

// Faster subject entry: pressing Enter in the "প্রাপ্ত নম্বর" (marks
// obtained) field adds the subject row immediately, instead of forcing the
// teacher to reach for the "+ বিষয় যোগ করুন" button after every subject.
function attachResultsFastEntryHandlers() {
  const obtainedEl = document.getElementById('resSubjectObtained');
  if (obtainedEl) {
    obtainedEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addSubjectRow(); } };
  }
  const nameEl = document.getElementById('resSubjectName');
  if (nameEl) {
    nameEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('resSubjectObtained').focus(); } };
  }
}

function addSubjectRow() {
  const nameEl = document.getElementById('resSubjectName');
  const fullEl = document.getElementById('resSubjectFull');
  const obtainedEl = document.getElementById('resSubjectObtained');
  const name = nameEl.value.trim();
  const full = Number(fullEl.value);
  const obtained = Number(obtainedEl.value);
  if (!name) return alert('বিষয়ের নাম লিখুন');
  if (!full || full <= 0) return alert('পূর্ণ নম্বর সঠিকভাবে দিন');
  if (obtainedEl.value === '' || isNaN(obtained)) return alert('প্রাপ্ত নম্বর দিন');
  if (obtained > full) return alert('প্রাপ্ত নম্বর পূর্ণ নম্বরের চেয়ে বেশি হতে পারে না');
  currentMarksheetSubjects.push({ name, full, obtained });

  // Remember this full-marks value so the next subject row starts
  // pre-filled with it (most exams use the same full marks for every
  // subject, e.g. 100 or 200) — saves re-typing it every time.
  lastUsedSubjectFullMarks = full;

  nameEl.value = '';
  fullEl.value = String(lastUsedSubjectFullMarks);
  obtainedEl.value = '';
  renderSubjectRows();
  nameEl.focus();
}

function removeSubjectRow(index) {
  currentMarksheetSubjects.splice(index, 1);
  renderSubjectRows();
}

function renderSubjectRows() {
  const wrap = document.getElementById('subjectRowsWrap');
  if (!wrap) return;
  if (currentMarksheetSubjects.length === 0) {
    wrap.innerHTML = '<p class="muted">এখনো কোনো বিষয় যোগ করা হয়নি</p>';
    return;
  }
  wrap.innerHTML = currentMarksheetSubjects.map((s, i) => `
    <div class="student-row">
      <span>${s.name}</span>
      <span>${s.obtained}/${s.full} <button class="small danger" onclick="removeSubjectRow(${i})">✕</button></span>
    </div>
  `).join('');
}

function saveMarksheet() {
  const studentId = document.getElementById('resStudent').value;
  const examName = document.getElementById('resExam').value.trim();
  const academicYear = document.getElementById('resAcademicYear').value.trim();
  if (!studentId) return alert('শিক্ষার্থী নির্বাচন করুন');
  if (!examName) return alert('পরীক্ষার নাম লিখুন');
  if (currentMarksheetSubjects.length === 0) return alert('অন্তত একটি বিষয় যোগ করুন');

  const totalObtained = currentMarksheetSubjects.reduce((sum, s) => sum + s.obtained, 0);
  const totalFull = currentMarksheetSubjects.reduce((sum, s) => sum + s.full, 0);
  const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
  const { grade, gpa } = gradeFromPercent(percentage);

  // Doc id includes academicYear (when given) so the same exam name reused
  // in a different year creates a new marksheet instead of overwriting an
  // older year's result for this student.
  const docId = studentId + '_' + examName + (academicYear ? '_' + academicYear : '');

  db.collection('results').doc(docId).set({
    madrasaId,
    studentId,
    examName,
    academicYear: academicYear || '',
    subjects: currentMarksheetSubjects,
    totalObtained,
    totalFull,
    percentage: Math.round(percentage * 100) / 100,
    grade,
    gpa,
    published: false,
    date: new Date().toISOString().slice(0,10)
  }).then(() => {
    currentMarksheetSubjects = [];
    document.getElementById('resExam').value = '';
    renderSubjectRows();
    alert('মার্কশিট সংরক্ষণ করা হয়েছে (এখনো অপ্রকাশিত — শিক্ষার্থী দেখতে পাবে না যতক্ষণ না আপনি "প্রকাশ করুন" চাপবেন)');
  }).catch(e => { alert('সংরক্ষণ ব্যর্থ: ' + e.message); showDiagBanner('মার্কশিট সংরক্ষণ ব্যর্থ: ' + e.message); });
}

function togglePublish(docId, currentlyPublished) {
  db.collection('results').doc(docId).set({ published: !currentlyPublished }, { merge: true })
    .catch(e => { alert('আপডেট ব্যর্থ: ' + e.message); showDiagBanner('প্রকাশ/স্থগিত ব্যর্থ: ' + e.message); });
}

function deleteMarksheet(docId) {
  if (!confirm('এই মার্কশিট মুছতে চান?')) return;
  db.collection('results').doc(docId).delete();
}

// Small helper: pick a colour for a grade badge in the redesigned marksheet
// (green tones for A+/A, blue for A-/B, orange for C/D, red for F).
function gradeColor(grade) {
  if (grade === 'A+' || grade === 'A') return { bg: '#dcfce7', fg: '#166534' };
  if (grade === 'A-' || grade === 'B') return { bg: '#dbeafe', fg: '#1e40af' };
  if (grade === 'C' || grade === 'D') return { bg: '#ffedd5', fg: '#9a3412' };
  return { bg: '#fee2e2', fg: '#991b1b' };
}

function viewMarksheet(studentId, docId) {
  db.collection('results').doc(docId).get().then(doc => {
    if (!doc.exists) return alert('মার্কশিট খুঁজে পাওয়া যায়নি');
    const r = doc.data();
    const student = studentsCache.find(s => s.id === studentId) || {};
    const hasSubjects = Array.isArray(r.subjects) && r.subjects.length > 0;
    const instName = (appSettings && appSettings.madrasaName) ? appSettings.madrasaName : 'শিক্ষা প্রতিষ্ঠান';
    const logoHtml = (appSettings && appSettings.logoDataUrl)
      ? `<img src="${appSettings.logoDataUrl}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;margin-right:10px;" alt="logo">`
      : '';

    const rows = hasSubjects ? r.subjects.map((s, i) => {
      const subjPct = s.full > 0 ? (s.obtained / s.full) * 100 : 0;
      const subjGrade = gradeFromPercent(subjPct);
      const subjGc = gradeColor(subjGrade.grade);
      return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${s.name}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${s.full}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${s.obtained}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;"><span style="background:${subjGc.bg};color:${subjGc.fg};border-radius:6px;padding:2px 8px;font-weight:bold;">${subjGrade.grade}</span></td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${subjGrade.gpa}</td>
      </tr>
    `;
    }).join('') : `<tr><td colspan="5" style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;" class="muted">বিষয়ভিত্তিক তথ্য নেই (পুরাতন রেজাল্ট)</td></tr>`;

    const totalRow = hasSubjects ? `
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 10px;border:1px solid #e5e7eb;"><b>মোট</b></td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;"><b>${r.totalFull}</b></td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;"><b>${r.totalObtained}</b></td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;"><b>${r.grade}</b></td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;"><b>${r.gpa}</b></td>
      </tr>
    ` : '';

    const gc = gradeColor(r.grade);
    const statBoxes = hasSubjects ? `
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:90px;background:#eef2ff;border-radius:10px;padding:10px;text-align:center;">
          <div class="muted" style="font-size:11px;">শতাংশ</div>
          <div style="font-size:18px;font-weight:bold;color:#3730a3;">${r.percentage}%</div>
        </div>
        <div style="flex:1;min-width:90px;background:${gc.bg};border-radius:10px;padding:10px;text-align:center;">
          <div class="muted" style="font-size:11px;">গ্রেড</div>
          <div style="font-size:18px;font-weight:bold;color:${gc.fg};">${r.grade}</div>
        </div>
        ${r.gpa ? `
        <div style="flex:1;min-width:90px;background:#fef9c3;border-radius:10px;padding:10px;text-align:center;">
          <div class="muted" style="font-size:11px;">GPA</div>
          <div style="font-size:18px;font-weight:bold;color:#854d0e;">${r.gpa}</div>
        </div>` : ''}
      </div>
    ` : `<p style="margin-top:10px;"><b>প্রাপ্ত নম্বর:</b> ${r.marks !== undefined ? r.marks : '-'}</p>`;

    setScreen(`
      <style id="marksheetPrintStyle">
        @media print {
          #bottomNav, #topBar, .no-print { display: none !important; }
          #marksheetPrintArea { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      </style>
      <div class="card" id="marksheetPrintArea" style="position:relative;border-top:5px solid #4f46e5;">
        ${r.academicYear ? `<div style="position:absolute;top:10px;right:14px;background:#eef2ff;color:#3730a3;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">শিক্ষাবর্ষ: ${r.academicYear}</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:center;margin-top:4px;">
          ${logoHtml}
          <div style="text-align:center;">
            <div style="font-size:19px;font-weight:bold;">${instName}</div>
            <div class="muted" style="font-size:13px;margin-top:2px;">${r.examName}</div>
          </div>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;font-size:14px;">
          <span><b>নাম:</b> ${student.name || '-'}</span>
          <span><b>রোল:</b> ${student.roll || '-'}</span>
          <span><b>শ্রেণি:</b> ${student.className || '-'}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="background:#eef2ff;">
              <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">বিষয়</th>
              <th style="padding:8px 10px;border:1px solid #e5e7eb;">পূর্ণ নম্বর</th>
              <th style="padding:8px 10px;border:1px solid #e5e7eb;">প্রাপ্ত নম্বর</th>
              <th style="padding:8px 10px;border:1px solid #e5e7eb;">গ্রেড</th>
              <th style="padding:8px 10px;border:1px solid #e5e7eb;">GPA</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${totalRow}
          </tbody>
        </table>
        ${statBoxes}
        <p class="muted" style="margin-top:12px;text-align:center;">প্রকাশের তারিখ: ${r.date || '-'}</p>
        <div class="no-print" style="margin-top:14px;">
          <button onclick="printMarksheet()">🖨️ প্রিন্ট করুন</button>
          <button class="secondary" onclick="renderResultsScreen(lastResultsIsTeacher)">ফিরে যান</button>
        </div>
      </div>
    `);
  }).catch(e => { alert('লোড ব্যর্থ: ' + e.message); showDiagBanner('মার্কশিট লোড ব্যর্থ: ' + e.message); });
}

function printMarksheet() {
  window.print();
}

// ---- Time left home report (teacher) ----
function renderTimeLeftScreen() {
  const today = new Date().toISOString().slice(0,10);
  setScreen(`
    <div class="card">
      <h2>বের হওয়ার সময় রিপোর্ট</h2>
      <input type="date" id="tlDate" value="${today}" onchange="loadTimeLeftReport()">
      <div id="tlFilterWrap"></div>
    </div>
    <div class="card"><div id="tlWrap">লোড হচ্ছে...</div></div>
  `);
  loadTimeLeftReport();
}

function onTlClassFilterChange(value) {
  tlClassFilter = value;
  loadTimeLeftReport();
}

function loadTimeLeftReport() {
  const filterWrap = document.getElementById('tlFilterWrap');
  if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(tlClassFilter, 'onTlClassFilterChange');

  const date = document.getElementById('tlDate').value;
  db.collection('attendance').where('madrasaId', '==', madrasaId).where('date', '==', date).get().then(snap => {
    const wrap = document.getElementById('tlWrap');
    const rows = {};
    snap.docs.forEach(d => rows[d.data().studentId] = d.data());
    const students = studentsByClass(tlClassFilter);
    if (students.length === 0) { wrap.innerHTML = '<p class="muted">এই শ্রেণিতে শিক্ষার্থী নেই</p>'; return; }
    wrap.innerHTML = students.map(s => {
      const r = rows[s.id] || {};
      return `<div class="student-row"><span>${s.name} <span class="muted">(${s.className || '-'})</span></span><span>${r.timeLeftHome || '—'}</span></div>`;
    }).join('');
  }).catch(e => showDiagBanner('বের হওয়ার সময় রিপোর্ট এরর: ' + e.message));
}

// ---- Attendance report (দৈনিক / মাসিক, teacher) ----
function renderReportScreen() {
  setScreen(`
    <div class="card">
      <h2>উপস্থিতি রিপোর্ট</h2>
      <div class="row" style="margin-bottom:10px;">
        <button class="small ${reportMode==='daily' ? '' : 'secondary'}" onclick="switchReportMode('daily')">দৈনিক রিপোর্ট</button>
        <button class="small ${reportMode==='monthly' ? '' : 'secondary'}" onclick="switchReportMode('monthly')">মাসিক রিপোর্ট</button>
      </div>
      <div id="reportControlsWrap"></div>
    </div>
    <div id="reportResultWrap"></div>
  `);
  if (reportMode === 'daily') renderDailyReportControls();
  else renderMonthlyReportControls();
}

function switchReportMode(mode) {
  reportMode = mode;
  renderReportScreen();
}

// -- daily report --
function renderDailyReportControls() {
  const controlsWrap = document.getElementById('reportControlsWrap');
  if (!controlsWrap) return;
  controlsWrap.innerHTML = `
    <label>তারিখ</label>
    <input type="date" id="reportDateInput" value="${reportDate}" onchange="onReportDateChange(this.value)">
    <div id="reportClassFilterWrap"></div>
  `;
  document.getElementById('reportClassFilterWrap').innerHTML = classFilterDropdownHtml(reportClassFilter, 'onReportClassFilterChange');
  loadDailyReport();
}

function onReportDateChange(value) {
  reportDate = value;
  loadDailyReport();
}

function onReportClassFilterChange(value) {
  reportClassFilter = value;
  if (reportMode === 'daily') loadDailyReport();
  else { populateReportStudentSelect(); loadMonthlyReport(); }
}

function loadDailyReport() {
  const resultWrap = document.getElementById('reportResultWrap');
  if (!resultWrap) return;
  resultWrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';

  const students = studentsByClass(reportClassFilter);
  if (students.length === 0) { resultWrap.innerHTML = '<div class="card"><p class="muted">কোনো শিক্ষার্থী নেই</p></div>'; return; }

  const date = reportDate;
  Promise.all(students.map(s => db.collection('attendance').doc(s.id + '_' + date).get()))
    .then(docs => {
      let presentCount = 0, absentCount = 0, unmarkedCount = 0;
      const rows = students.map((s, i) => {
        const doc = docs[i];
        const d = doc.exists ? doc.data() : {};
        const status = d.status;
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
        else unmarkedCount++;
        const statusText = status === 'present' ? 'উপস্থিত' : (status === 'absent' ? 'অনুপস্থিত' : 'চিহ্নিত হয়নি');
        const badgeClass = status === 'present' ? 'present' : (status === 'absent' ? 'absent' : 'pending');
        return `
          <tr>
            <td style="padding:6px;border:1px solid #ddd;">${s.roll || '-'}</td>
            <td style="padding:6px;border:1px solid #ddd;">${s.name}</td>
            <td style="padding:6px;border:1px solid #ddd;">${s.className || '-'}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:center;"><span class="badge ${badgeClass}">${statusText}</span></td>
            <td style="padding:6px;border:1px solid #ddd;">${d.timeLeftHome || '-'}</td>
            <td style="padding:6px;border:1px solid #ddd;">${d.reason || '-'}</td>
          </tr>
        `;
      }).join('');

      resultWrap.innerHTML = `
        <style id="reportPrintStyle">
          @media print { #bottomNav, .no-print { display: none !important; } }
        </style>
        <div class="card" id="reportPrintArea">
          <h2 style="text-align:center;margin-bottom:2px;">দৈনিক উপস্থিতি রিপোর্ট</h2>
          <p class="muted" style="text-align:center;margin-top:0;">তারিখ: ${date}${reportClassFilter !== 'all' ? ' | শ্রেণি: ' + reportClassFilter : ''}</p>
          <p style="text-align:center;">মোট: <b>${students.length}</b> &nbsp; উপস্থিত: <b>${presentCount}</b> &nbsp; অনুপস্থিত: <b>${absentCount}</b> &nbsp; চিহ্নিত হয়নি: <b>${unmarkedCount}</b></p>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead>
              <tr>
                <th style="padding:6px;border:1px solid #ddd;">রোল</th>
                <th style="padding:6px;border:1px solid #ddd;">নাম</th>
                <th style="padding:6px;border:1px solid #ddd;">শ্রেণি</th>
                <th style="padding:6px;border:1px solid #ddd;">অবস্থা</th>
                <th style="padding:6px;border:1px solid #ddd;">বের হওয়ার সময়</th>
                <th style="padding:6px;border:1px solid #ddd;">কারণ</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="no-print" style="margin-top:14px;text-align:center;">
            <button onclick="window.print()">🖨️ প্রিন্ট করুন</button>
          </div>
        </div>
      `;
    })
    .catch(e => {
      resultWrap.innerHTML = '<div class="card"><p class="muted">লোড করতে সমস্যা হয়েছে: ' + e.message + '</p></div>';
      if (e.code !== 'permission-denied') showDiagBanner('দৈনিক রিপোর্ট এরর: ' + e.message);
    });
}

// -- monthly report --
function renderMonthlyReportControls() {
  const controlsWrap = document.getElementById('reportControlsWrap');
  if (!controlsWrap) return;
  controlsWrap.innerHTML = `
    <div id="reportClassFilterWrap"></div>
    <label>শিক্ষার্থী</label>
    <select id="reportStudentSelect" onchange="onReportStudentChange(this.value)"></select>
    <label>মাস</label>
    <input type="month" id="reportMonthInput" value="${reportMonth}" onchange="onReportMonthChange(this.value)">
  `;
  document.getElementById('reportClassFilterWrap').innerHTML = classFilterDropdownHtml(reportClassFilter, 'onReportClassFilterChange');
  populateReportStudentSelect();
  loadMonthlyReport();
}

function onReportMonthChange(value) {
  reportMonth = value;
  loadMonthlyReport();
}

function populateReportStudentSelect() {
  const sel = document.getElementById('reportStudentSelect');
  if (!sel) return;
  const students = studentsByClass(reportClassFilter);
  if (students.length === 0) {
    sel.innerHTML = '<option value="">কোনো শিক্ষার্থী নেই</option>';
    reportStudentId = '';
    return;
  }
  if (!reportStudentId || !students.find(s => s.id === reportStudentId)) {
    reportStudentId = students[0].id;
  }
  sel.innerHTML = students.map(s => `<option value="${s.id}" ${s.id === reportStudentId ? 'selected' : ''}>${s.name} (${s.roll || ''})</option>`).join('');
}

function onReportStudentChange(value) {
  reportStudentId = value;
  loadMonthlyReport();
}

function loadMonthlyReport() {
  const resultWrap = document.getElementById('reportResultWrap');
  if (!resultWrap) return;

  if (!reportStudentId) {
    resultWrap.innerHTML = '<div class="card"><p class="muted">কোনো শিক্ষার্থী নেই</p></div>';
    return;
  }

  resultWrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
  const student = studentsCache.find(s => s.id === reportStudentId);
  const month = reportMonth; // 'YYYY-MM'

  // NOTE: must filter by madrasaId as well as studentId — firestore.rules'
  // teacher-read branch checks resource.data.madrasaId == myMadrasaId(),
  // and Firestore rejects list queries whose filters can't prove that
  // condition on every possible result. Without this, the whole query was
  // failing with "Missing or insufficient permissions".
  db.collection('attendance')
    .where('madrasaId', '==', madrasaId)
    .where('studentId', '==', reportStudentId)
    .get()
    .then(snap => {
      const entries = snap.docs
        .map(d => d.data())
        .filter(d => (d.date || '').startsWith(month))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      const presentCount = entries.filter(e => e.status === 'present').length;
      const absentCount = entries.filter(e => e.status === 'absent').length;
      const markedCount = presentCount + absentCount;
      const rate = markedCount > 0 ? Math.round((presentCount / markedCount) * 1000) / 10 : 0;

      const rows = entries.length > 0 ? entries.map(e => {
        const statusText = e.status === 'present' ? 'উপস্থিত' : (e.status === 'absent' ? 'অনুপস্থিত' : 'চিহ্নিত হয়নি');
        const badgeClass = e.status === 'present' ? 'present' : (e.status === 'absent' ? 'absent' : 'pending');
        return `
          <tr>
            <td style="padding:6px;border:1px solid #ddd;">${e.date}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:center;"><span class="badge ${badgeClass}">${statusText}</span></td>
            <td style="padding:6px;border:1px solid #ddd;">${e.timeLeftHome || '-'}</td>
            <td style="padding:6px;border:1px solid #ddd;">${e.reason || '-'}</td>
          </tr>
        `;
      }).join('') : `<tr><td colspan="4" style="padding:6px;border:1px solid #ddd;text-align:center;" class="muted">এই মাসে কোনো তথ্য নেই</td></tr>`;

      resultWrap.innerHTML = `
        <style id="reportPrintStyle">
          @media print { #bottomNav, .no-print { display: none !important; } }
        </style>
        <div class="card" id="reportPrintArea">
          <h2 style="text-align:center;margin-bottom:2px;">মাসিক উপস্থিতি রিপোর্ট</h2>
          <p class="muted" style="text-align:center;margin-top:0;">${student ? student.name + ' (রোল ' + (student.roll || '-') + ', ' + (student.className || '-') + ')' : ''}</p>
          <p class="muted" style="text-align:center;margin-top:0;">মাস: ${month}</p>
          <p style="text-align:center;">উপস্থিত: <b>${presentCount}</b> &nbsp; অনুপস্থিত: <b>${absentCount}</b> &nbsp; চিহ্নিত দিন: <b>${markedCount}</b> &nbsp; উপস্থিতির হার: <b>${rate}%</b></p>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead>
              <tr>
                <th style="padding:6px;border:1px solid #ddd;">তারিখ</th>
                <th style="padding:6px;border:1px solid #ddd;">অবস্থা</th>
                <th style="padding:6px;border:1px solid #ddd;">বের হওয়ার সময়</th>
                <th style="padding:6px;border:1px solid #ddd;">কারণ</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="no-print" style="margin-top:14px;text-align:center;">
            <button onclick="window.print()">🖨️ প্রিন্ট করুন</button>
          </div>
        </div>
      `;
    })
    .catch(e => {
      resultWrap.innerHTML = '<div class="card"><p class="muted">লোড করতে সমস্যা হয়েছে: ' + e.message + '</p></div>';
      if (e.code !== 'permission-denied') showDiagBanner('মাসিক রিপোর্ট এরর: ' + e.message);
    });
}

// ---- Notices (shared, realtime) ----
function renderNoticesScreen(isTeacher) {
  let html = '';
  if (isTeacher) {
    html += `
      <div class="card">
        <h2>নতুন নোটিশ</h2>
        <label>শিরোনাম</label><input id="noticeTitle" placeholder="শিরোনাম">
        <label>বিস্তারিত</label><textarea id="noticeBody" rows="3"></textarea>
        <button onclick="addNotice()">পোস্ট করুন</button>
      </div>`;
  }
  html += `<div class="card"><h2>নোটিশ বোর্ড</h2><div id="noticesWrap">লোড হচ্ছে...</div></div>`;
  setScreen(html);

  db.collection('notices').where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc').onSnapshot(snap => {
    const wrap = document.getElementById('noticesWrap');
    if (!wrap) return;
    if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো নোটিশ নেই</p>'; return; }
    wrap.innerHTML = snap.docs.map(d => {
      const n = d.data();
      const date = n.createdAt ? new Date(n.createdAt).toLocaleDateString('bn-BD') : '';
      return `<div class="student-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;">
          <b>${n.title}</b>
          <span class="muted">${date}</span>
        </div>
        <div>${n.body}</div>
        ${isTeacher ? `<button class="small danger" onclick="deleteNotice('${d.id}')">মুছুন</button>` : ''}
      </div>`;
    }).join('');
  }, err => {
    const wrap = document.getElementById('noticesWrap');
    if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
    if (err.code !== 'permission-denied') showDiagBanner('নোটিশ লোড এরর: ' + err.message);
  });
}

function addNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const body = document.getElementById('noticeBody').value.trim();
  if (!title || !body) return alert('শিরোনাম ও বিস্তারিত লিখুন');
  db.collection('notices').add({ madrasaId, title, body, createdAt: Date.now() })
    .then(() => { document.getElementById('noticeTitle').value=''; document.getElementById('noticeBody').value=''; })
    .catch(e => { alert('সংরক্ষণ ব্যর্থ: ' + e.message); showDiagBanner('নোটিশ সংরক্ষণ ব্যর্থ: ' + e.message); });
}

function deleteNotice(id) {
  if (!confirm('এই নোটিশ মুছতে চান?')) return;
  db.collection('notices').doc(id).delete();
}

// ---- Diary (শিক্ষকের ডায়েরি/হোমওয়ার্ক এন্ট্রি, শ্রেণি অনুযায়ী, ফাইল সংযুক্তি সহ) ----

const DIARY_MAX_FILE_BYTES = 700 * 1024; // ~700KB raw file limit (base64 inflates it, Firestore doc cap is 1MB)

function renderDiaryScreen(isTeacher) {
  let html = '';
  if (isTeacher) {
    const classes = getClassList();
    const classOpts = classes.map(c => `<option value="${c}">${c}</option>`).join('');
    html += `
      <div class="card">
        <h2>নতুন ডায়েরি এন্ট্রি</h2>
        <label>তারিখ</label><input type="date" id="diaryDate" value="${new Date().toISOString().slice(0,10)}">
        <label>শ্রেণি</label>
        <select id="diaryClass">${classOpts || '<option value="">কোনো শ্রেণি পাওয়া যায়নি, আগে শিক্ষার্থী যোগ করুন</option>'}</select>
        <label>লেখা</label><textarea id="diaryText" rows="4" placeholder="হোমওয়ার্ক / ডায়েরি লিখুন"></textarea>
        <label>ফাইল সংযুক্ত করুন (ঐচ্ছিক, সর্বোচ্চ ~৭০০KB)</label>
        <input type="file" id="diaryFile">
        <p id="diaryError" class="muted" style="color:#dc2626;"></p>
        <button onclick="addDiaryEntry()">এন্ট্রি যোগ করুন</button>
      </div>
      <div class="card">
        <h2>ডায়েরি তালিকা</h2>
        <div id="diaryFilterWrap"></div>
        <div id="diaryWrap">লোড হচ্ছে...</div>
      </div>`;
  } else {
    html += `<div class="card"><h2>ডায়েরি</h2><div id="diaryWrap">লোড হচ্ছে...</div></div>`;
  }
  setScreen(html);

  if (isTeacher) {
    const filterWrap = document.getElementById('diaryFilterWrap');
    if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(diaryClassFilter, 'onDiaryClassFilterChange');
  }

  let diaryQuery;
  if (isTeacher) {
    diaryQuery = db.collection('diary').where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc');
  } else {
    const me = studentsCache.find(s => s.id === myStudentId);
    const myClass = me ? me.className : null;
    if (!myClass) {
      const wrap = document.getElementById('diaryWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">শ্রেণি তথ্য পাওয়া যায়নি</p>';
      return;
    }
    diaryQuery = db.collection('diary').where('madrasaId', '==', madrasaId).where('className', '==', myClass).orderBy('createdAt', 'desc');
  }

  diaryQuery.onSnapshot(snap => {
    const wrap = document.getElementById('diaryWrap');
    if (!wrap) return;

    let docs = snap.docs;
    if (isTeacher && diaryClassFilter !== 'all') {
      docs = docs.filter(d => d.data().className === diaryClassFilter);
    }

    if (docs.length === 0) { wrap.innerHTML = '<p class="muted">কোনো ডায়েরি এন্ট্রি নেই</p>'; return; }

    wrap.innerHTML = docs.map(d => {
      const r = d.data();
      let attachmentHtml = '';
      if (r.attachmentDataUrl) {
        if ((r.attachmentType || '').startsWith('image/')) {
          attachmentHtml = `<div style="margin-top:6px;"><img src="${r.attachmentDataUrl}" style="max-width:100%;border-radius:8px;" alt="attachment"></div>`;
        } else {
          attachmentHtml = `<div style="margin-top:6px;"><a href="${r.attachmentDataUrl}" download="${r.attachmentName || 'file'}">📎 ${r.attachmentName || 'ফাইল ডাউনলোড করুন'}</a></div>`;
        }
      }
      return `<div class="student-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;">
          <b>${r.className || '-'}</b>
          <span class="muted">${r.date || ''}</span>
        </div>
        <div style="margin-top:4px;">${(r.text || '').replace(/\n/g, '<br>')}</div>
        ${attachmentHtml}
        ${isTeacher ? `<button class="small danger" onclick="deleteDiaryEntry('${d.id}')" style="margin-top:6px;">মুছুন</button>` : ''}
      </div>`;
    }).join('');
  }, err => {
    const wrap = document.getElementById('diaryWrap');
    if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
    if (err.code !== 'permission-denied') showDiagBanner('ডায়েরী লোড এরর: ' + err.message);
  });
}

function onDiaryClassFilterChange(value) {
  diaryClassFilter = value;
  renderDiaryScreen(true);
}

function addDiaryEntry() {
  const date = document.getElementById('diaryDate').value;
  const className = document.getElementById('diaryClass').value;
  const text = document.getElementById('diaryText').value.trim();
  const fileInput = document.getElementById('diaryFile');
  const errEl = document.getElementById('diaryError');
  if (errEl) errEl.textContent = '';

  if (!className) { if (errEl) errEl.textContent = 'শ্রেণি নির্বাচন করুন'; return; }
  if (!text) { if (errEl) errEl.textContent = 'লেখা দিন'; return; }

  const file = fileInput && fileInput.files && fileInput.files[0];

  const saveEntry = (attachmentDataUrl, attachmentName, attachmentType) => {
    db.collection('diary').add({
      madrasaId, date, className, text,
      attachmentDataUrl: attachmentDataUrl || '',
      attachmentName: attachmentName || '',
      attachmentType: attachmentType || '',
      createdAt: Date.now()
    }).then(() => {
      document.getElementById('diaryText').value = '';
      if (fileInput) fileInput.value = '';
    }).catch(e => { if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; showDiagBanner('ডায়েরী সংরক্ষণ ব্যর্থ: ' + e.message); });
  };

  if (!file) { saveEntry(); return; }

  if (file.size > DIARY_MAX_FILE_BYTES) {
    if (errEl) errEl.textContent = 'ফাইলটি অনেক বড়, সর্বোচ্চ ৭০০KB পর্যন্ত ফাইল দেওয়া যাবে';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => saveEntry(reader.result, file.name, file.type);
  reader.onerror = () => { if (errEl) errEl.textContent = 'ফাইল পড়তে সমস্যা হয়েছে'; };
  reader.readAsDataURL(file);
}

function deleteDiaryEntry(id) {
  if (!confirm('এই ডায়েরি এন্ট্রি মুছতে চান?')) return;
  db.collection('diary').doc(id).delete();
}

// ---- Suggestion box (পরামর্শ বক্স, শিক্ষার্থীর নাম-সহ) ----

function renderSuggestionsScreen(isTeacher) {
  let html = '';
  if (!isTeacher) {
    html += `
      <div class="card">
        <h2>পরামর্শ পাঠান</h2>
        <label>আপনার পরামর্শ লিখুন</label>
        <textarea id="suggestionText" rows="4" placeholder="আপনার পরামর্শ / মতামত লিখুন"></textarea>
        <p id="suggestionError" class="muted" style="color:#dc2626;"></p>
        <button onclick="submitSuggestion()">পাঠান</button>
      </div>`;
  }
  html += `<div class="card">
    <h2>${isTeacher ? 'সকল পরামর্শ' : 'আমার পাঠানো পরামর্শ'}</h2>
    ${isTeacher ? '<div id="suggestionsFilterWrap"></div>' : ''}
    <div id="suggestionsWrap">লোড হচ্ছে...</div>
  </div>`;
  setScreen(html);

  if (isTeacher) {
    const filterWrap = document.getElementById('suggestionsFilterWrap');
    if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(suggestionsClassFilter, 'onSuggestionsClassFilterChange');
  }

  let q = db.collection('suggestions');
  if (isTeacher) q = q.where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc');
  else q = q.where('studentId', '==', myStudentId);

  q.onSnapshot(snap => {
    const wrap = document.getElementById('suggestionsWrap');
    if (!wrap) return;
    if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো পরামর্শ নেই</p>'; return; }
    let docs = snap.docs;
    if (!isTeacher) docs = [...docs].sort((a,b) => (b.data().createdAt||0) - (a.data().createdAt||0));

    if (isTeacher && suggestionsClassFilter !== 'all') {
      docs = docs.filter(d => {
        const student = studentsCache.find(s => s.id === d.data().studentId);
        return student && student.className === suggestionsClassFilter;
      });
    }

    if (docs.length === 0) { wrap.innerHTML = '<p class="muted">এই শ্রেণিতে কোনো পরামর্শ নেই</p>'; return; }

    wrap.innerHTML = docs.map(d => {
      const r = d.data();
      const student = studentsCache.find(s => s.id === r.studentId);
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('bn-BD') : '';
      return `<div class="student-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;">
          <b>${isTeacher ? (student ? student.name + (student.className ? ' (' + student.className + ')' : '') : 'অজানা') : 'আপনার পরামর্শ'}</b>
          <span class="muted">${date}</span>
        </div>
        <div style="margin-top:4px;">${r.text}</div>
        ${isTeacher ? `<button class="small danger" onclick="deleteSuggestion('${d.id}')" style="margin-top:6px;">মুছুন</button>` : ''}
      </div>`;
    }).join('');
  }, err => {
    const wrap = document.getElementById('suggestionsWrap');
    if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
    if (err.code !== 'permission-denied') showDiagBanner('পরামর্শ লোড এরর: ' + err.message);
  });
}

function onSuggestionsClassFilterChange(value) {
  suggestionsClassFilter = value;
  renderSuggestionsScreen(true);
}

function submitSuggestion() {
  const text = document.getElementById('suggestionText').value.trim();
  const errEl = document.getElementById('suggestionError');
  if (errEl) errEl.textContent = '';
  if (!text) { if (errEl) errEl.textContent = 'পরামর্শ লিখুন'; return; }
  db.collection('suggestions').add({ madrasaId, studentId: myStudentId, text, createdAt: Date.now() })
    .then(() => {
      document.getElementById('suggestionText').value = '';
      alert('আপনার পরামর্শ পাঠানো হয়েছে');
    })
    .catch(e => { if (errEl) errEl.textContent = 'পাঠাতে ব্যর্থ: ' + e.message; showDiagBanner('পরামর্শ পাঠাতে ব্যর্থ: ' + e.message); });
}

function deleteSuggestion(id) {
  if (!confirm('এই পরামর্শ মুছতে চান?')) return;
  db.collection('suggestions').doc(id).delete();
}

// ================= শিক্ষকগণ (MULTI-ADMIN TEACHER MANAGEMENT) =================
// Only visible/usable for teacher accounts whose teachers/{uid} doc has
// isAdmin:true (see myTeacherIsAdmin, resolved in ensureTeacherDoc above,
// and enforced server-side in firestore.rules — this screen only ever
// being rendered client-side for an admin is a UX convenience, NOT the
// real security boundary).
//
// "যোগ করুন" (add) creates a brand-new Firebase Auth email/password
// account for the new teacher. This has to be done through a SECOND,
// throwaway Firebase app instance — calling
// createUserWithEmailAndPassword on the normal `auth` object would
// sign the admin OUT of their own account and sign them into the new
// teacher's account instead (a well-known Firebase behavior). The
// secondary app instance is deleted again right after, so it never
// lingers.
//
// "নিষ্ক্রিয় করুন" (deactivate) does NOT delete the teacher's Firebase
// Auth account (that requires the Admin SDK / a Cloud Function, which
// needs the paid Blaze plan — deliberately avoided so far in this
// project). Instead it sets active:false on their teachers/{uid} doc.
// firestore.rules' isTeacherAuth() now also checks this active flag, so
// a deactivated teacher instantly loses ALL access everywhere in the
// app (students, attendance, results, etc.) the moment this is set —
// not just from this "শিক্ষকগণ" screen.
function renderTeachersScreen() {
  setScreen(`
    <div class="card">
      <h2>নতুন শিক্ষক অ্যাকাউন্ট যোগ করুন</h2>
      <label>ইমেইল</label><input id="newTeacherEmail" type="email" placeholder="teacher@example.com">
      <label>পাসওয়ার্ড</label><input id="newTeacherPassword" type="password" placeholder="কমপক্ষে ৬ অক্ষর">
      <label style="display:flex;align-items:center;gap:6px;margin-top:6px;">
        <input id="newTeacherIsAdmin" type="checkbox" style="width:auto;"> অ্যাডমিন অধিকার দিন (তিনিও শিক্ষক যোগ/অপসারণ করতে পারবেন)
      </label>
      <p id="newTeacherError" class="muted" style="color:#dc2626;"></p>
      <button onclick="addTeacherAccount()">যোগ করুন</button>
    </div>
    <div class="card">
      <h2>শিক্ষকগণ</h2>
      <div id="teachersListWrap">লোড হচ্ছে...</div>
    </div>
  `);
  listenTeachersList();
}

function listenTeachersList() {
  if (teachersUnsub) { teachersUnsub(); teachersUnsub = null; }
  teachersUnsub = db.collection('teachers').where('madrasaId', '==', madrasaId)
    .onSnapshot(snap => {
      const wrap = document.getElementById('teachersListWrap');
      if (!wrap) return;
      if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো শিক্ষক পাওয়া যায়নি</p>'; return; }
      const myUid = auth.currentUser ? auth.currentUser.uid : null;
      const docs = [...snap.docs].sort((a, b) => (a.data().createdAt || 0) - (b.data().createdAt || 0));
      wrap.innerHTML = docs.map(d => {
        const t = d.data();
        const isMe = d.id === myUid;
        const isAdminT = t.isAdmin === true;
        const isActiveT = t.active !== false;
        return `<div class="student-row" style="display:block;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>${t.email || d.id}${isMe ? ' <span class="muted">(আপনি)</span>' : ''}</span>
            <span class="badge ${isActiveT ? 'present' : 'absent'}">${isActiveT ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
          </div>
          <div class="muted" style="margin-top:2px;">${isAdminT ? '⭐ অ্যাডমিন' : 'সাধারণ শিক্ষক'}</div>
          ${!isMe ? `
            <div style="margin-top:6px;">
              <button class="small secondary" onclick="toggleTeacherAdmin('${d.id}', ${isAdminT})">${isAdminT ? 'অ্যাডমিন বাতিল করুন' : 'অ্যাডমিন করুন'}</button>
              <button class="small ${isActiveT ? 'danger' : ''}" onclick="toggleTeacherActive('${d.id}', ${isActiveT})">${isActiveT ? 'নিষ্ক্রিয় করুন' : 'পুনরায় সক্রিয় করুন'}</button>
            </div>
          ` : '<p class="muted" style="margin-top:6px;">নিজের অ্যাকাউন্ট এখান থেকে পরিবর্তন করা যাবে না</p>'}
        </div>`;
      }).join('');
    }, err => {
      const wrap = document.getElementById('teachersListWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p>';
      if (err.code !== 'permission-denied') showDiagBanner('শিক্ষক তালিকা লোড এরর: ' + err.message);
    });
}

function addTeacherAccount() {
  const email = document.getElementById('newTeacherEmail').value.trim();
  const password = document.getElementById('newTeacherPassword').value;
  const isAdminNew = document.getElementById('newTeacherIsAdmin').checked;
  const errEl = document.getElementById('newTeacherError');
  if (errEl) errEl.textContent = '';
  if (!email || !password) { if (errEl) errEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন'; return; }
  if (password.length < 6) { if (errEl) errEl.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'; return; }

  let secondaryApp;
  try {
    // Unique app name each time so repeated add attempts never collide with
    // a still-initializing previous instance.
    secondaryApp = firebase.initializeApp(firebase.apps[0].options, 'TeacherCreate_' + Date.now());
  } catch (e) {
    if (errEl) errEl.textContent = 'শুরু করা যায়নি: ' + e.message;
    return;
  }
  const secondaryAuth = secondaryApp.auth();

  secondaryAuth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      const newUid = cred.user.uid;
      return db.collection('teachers').doc(newUid).set({
        madrasaId, email, isAdmin: !!isAdminNew, active: true, createdAt: Date.now()
      }).then(() => secondaryAuth.signOut().catch(() => {}));
    })
    .then(() => {
      secondaryApp.delete().catch(() => {});
      document.getElementById('newTeacherEmail').value = '';
      document.getElementById('newTeacherPassword').value = '';
      document.getElementById('newTeacherIsAdmin').checked = false;
      alert('শিক্ষক অ্যাকাউন্ট তৈরি করা হয়েছে');
    })
    .catch(e => {
      const msg = e.code === 'auth/email-already-in-use' ? 'এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে'
        : e.code === 'auth/invalid-email' ? 'ইমেইলটি সঠিক নয়'
        : e.code === 'auth/weak-password' ? 'পাসওয়ার্ড দুর্বল, আরেকটু শক্তিশালী দিন'
        : 'অ্যাকাউন্ট তৈরি ব্যর্থ: ' + e.message;
      if (errEl) errEl.textContent = msg;
      showDiagBanner('শিক্ষক তৈরি ব্যর্থ: ' + e.message);
      try { secondaryApp.delete(); } catch (_e) {}
    });
}

function toggleTeacherAdmin(uid, currentlyAdmin) {
  if (auth.currentUser && uid === auth.currentUser.uid) { alert('নিজের অ্যাডমিন স্ট্যাটাস এখান থেকে পরিবর্তন করা যাবে না'); return; }
  db.collection('teachers').doc(uid).set({ isAdmin: !currentlyAdmin }, { merge: true })
    .catch(e => { alert('আপডেট ব্যর্থ: ' + e.message); showDiagBanner('অ্যাডমিন স্ট্যাটাস আপডেট ব্যর্থ: ' + e.message); });
}

function toggleTeacherActive(uid, currentlyActive) {
  if (auth.currentUser && uid === auth.currentUser.uid) { alert('নিজেকে নিষ্ক্রিয় করা যাবে না'); return; }
  const confirmMsg = currentlyActive
    ? 'এই শিক্ষককে নিষ্ক্রিয় করতে চান? তিনি সাথে সাথে অ্যাপে প্রবেশাধিকার হারাবেন।'
    : 'এই শিক্ষককে পুনরায় সক্রিয় করতে চান?';
  if (!confirm(confirmMsg)) return;
  db.collection('teachers').doc(uid).set({ active: !currentlyActive }, { merge: true })
    .catch(e => { alert('আপডেট ব্যর্থ: ' + e.message); showDiagBanner('সক্রিয়/নিষ্ক্রিয় আপডেট ব্যর্থ: ' + e.message); });
}

// ================= FEES / বেতন =================
// Two kinds of fee are tracked:
//  - monthly (মাসিক বেতন): one paid/due entry per student per month, marked
//    the same way attendance is (doc id = studentId_YYYY-MM, in fees_monthly)
//  - onetime (ভর্তি/পরীক্ষা ফি): ad-hoc charges of any custom name/amount,
//    each its own doc in fees_onetime, toggled paid/due individually
//
// Students can see only their own fee/due status; teachers see and manage
// everyone's, filterable by class like the rest of the app.

function renderFeesScreen(isTeacher) {
  currentFeesIsTeacher = isTeacher;
  setScreen(`
    <div class="card">
      <h2>বেতন / ফি</h2>
      <div class="row" style="margin-bottom:10px;">
        <button class="small ${feesMode==='monthly' ? '' : 'secondary'}" onclick="switchFeesMode('monthly')">মাসিক বেতন</button>
        <button class="small ${feesMode==='onetime' ? '' : 'secondary'}" onclick="switchFeesMode('onetime')">ভর্তি/পরীক্ষা ফি</button>
      </div>
      <div id="feesControlsWrap"></div>
    </div>
    <div id="feesResultWrap"></div>
  `);
  if (feesMode === 'monthly') renderMonthlyFeesControls(isTeacher);
  else renderOnetimeFeesControls(isTeacher);
}

function switchFeesMode(mode) {
  feesMode = mode;
  renderFeesScreen(currentFeesIsTeacher);
}

function onFeesClassFilterChange(value) {
  feesClassFilter = value;
  if (feesMode === 'monthly') loadMonthlyFeesTeacher();
  else loadOnetimeFeesTeacher();
}

// ---- Monthly fee (মাসিক বেতন) ----
function renderMonthlyFeesControls(isTeacher) {
  const controlsWrap = document.getElementById('feesControlsWrap');
  if (!controlsWrap) return;
  if (isTeacher) {
    controlsWrap.innerHTML = `
      <label>মাস</label>
      <input type="month" id="feesMonthInput" value="${feesMonth}" onchange="onFeesMonthChange(this.value)">
      <div id="feesClassFilterWrap"></div>
    `;
    document.getElementById('feesClassFilterWrap').innerHTML = classFilterDropdownHtml(feesClassFilter, 'onFeesClassFilterChange');
    loadMonthlyFeesTeacher();
  } else {
    controlsWrap.innerHTML = '';
    loadMonthlyFeesStudent();
  }
}

function onFeesMonthChange(value) {
  feesMonth = value;
  loadMonthlyFeesTeacher();
}

function loadMonthlyFeesTeacher() {
  const resultWrap = document.getElementById('feesResultWrap');
  if (!resultWrap) return;
  const students = studentsByClass(feesClassFilter);
  if (students.length === 0) { resultWrap.innerHTML = '<div class="card"><p class="muted">কোনো শিক্ষার্থী নেই</p></div>'; return; }
  resultWrap.innerHTML = students.map(s => `<div class="card" id="fee_${s.id}">লোড হচ্ছে...</div>`).join('');
  const month = feesMonth;
  students.forEach(s => {
    db.collection('fees_monthly').doc(s.id + '_' + month).get().then(doc => {
      const d = doc.exists ? doc.data() : {};
      const cell = document.getElementById('fee_' + s.id);
      if (!cell) return;
      const status = d.status || 'due';
      cell.innerHTML = `
        <b>${s.name}</b> <span class="muted">(${s.className || '-'})</span>
        <label>বেতনের পরিমাণ</label>
        <input type="number" value="${d.amount || ''}" onchange="updateFeeAmount('${s.id}','${month}',this.value)">
        <div class="row" style="margin-top:6px;">
          <button class="small ${status==='paid'?'':'secondary'}" onclick="setFeeStatus('${s.id}','${month}','paid')">পরিশোধিত</button>
          <button class="small ${status==='due'?'danger':'secondary'}" onclick="setFeeStatus('${s.id}','${month}','due')">বকেয়া</button>
        </div>
        ${d.paidDate ? `<div class="muted" style="margin-top:4px;">পরিশোধের তারিখ: ${d.paidDate}</div>` : ''}
      `;
    }).catch(e => {
      const cell = document.getElementById('fee_' + s.id);
      if (cell) {
        cell.innerHTML = `
          <b>${s.name}</b> <span class="muted">(${s.className || '-'})</span>
          <p class="muted" style="color:#dc2626;margin:6px 0;">লোড করতে সমস্যা হয়েছে${e && e.message ? ' (' + e.message + ')' : ''}</p>
          <button class="small secondary" onclick="loadMonthlyFeesTeacher()">আবার চেষ্টা করুন</button>
        `;
      }
      showDiagBanner('বেতন লোড ব্যর্থ (' + s.name + '): ' + (e.code || '') + ' ' + e.message);
    });
  });
}

function updateFeeAmount(studentId, month, value) {
  db.collection('fees_monthly').doc(studentId + '_' + month).set({
    studentId, month, madrasaId, amount: Number(value) || 0
  }, { merge: true }).catch(e => showDiagBanner('বেতন সংরক্ষণ ব্যর্থ: ' + e.message));
}

function setFeeStatus(studentId, month, status) {
  const data = { studentId, month, madrasaId, status };
  if (status === 'paid') data.paidDate = new Date().toISOString().slice(0,10);
  db.collection('fees_monthly').doc(studentId + '_' + month).set(data, { merge: true })
    .then(() => {
      updateFeeButtonsUI(studentId, status);
      loadMonthlyFeesTeacher(); // refresh to show/hide the paid-date line correctly
    })
    .catch(e => showDiagBanner('বেতন স্ট্যাটাস আপডেট ব্যর্থ: ' + e.message));
}

function updateFeeButtonsUI(studentId, status) {
  const cell = document.getElementById('fee_' + studentId);
  if (!cell) return;
  const buttons = cell.querySelectorAll('.row button');
  if (buttons[0]) buttons[0].className = 'small' + (status === 'paid' ? '' : ' secondary');
  if (buttons[1]) buttons[1].className = 'small' + (status === 'due' ? ' danger' : ' secondary');
}

// ---- Monthly fee (student's own view) ----
function loadMonthlyFeesStudent() {
  const resultWrap = document.getElementById('feesResultWrap');
  if (!resultWrap) return;
  resultWrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
  db.collection('fees_monthly').where('studentId', '==', myStudentId)
    .onSnapshot(snap => {
      if (snap.empty) { resultWrap.innerHTML = '<div class="card"><p class="muted">কোনো তথ্য নেই</p></div>'; return; }
      const rows = snap.docs.map(d => d.data()).sort((a,b) => (b.month||'').localeCompare(a.month||''));
      resultWrap.innerHTML = `<div class="card">${rows.map(r => `
        <div class="student-row">
          <span>${r.month}</span>
          <span class="badge ${r.status==='paid'?'present':'absent'}">${r.status==='paid'?'পরিশোধিত':'বকেয়া'}</span>
        </div>
        <div class="muted">পরিমাণ: ${r.amount || 0} টাকা${r.paidDate ? ' | পরিশোধের তারিখ: ' + r.paidDate : ''}</div>
      `).join('<hr style="border:none;border-top:1px solid #eee;margin:6px 0;">')}</div>`;
    }, err => {
      resultWrap.innerHTML = '<div class="card"><p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p></div>';
      showDiagBanner('আমার বেতন লোড এরর: ' + err.message);
    });
}

// ---- One-time fee (ভর্তি/পরীক্ষা ফি ইত্যাদি, teacher) ----
function renderOnetimeFeesControls(isTeacher) {
  const controlsWrap = document.getElementById('feesControlsWrap');
  if (!controlsWrap) return;
  if (isTeacher) {
    const students = studentsByClass(feesClassFilter);
    const opts = students.map(s => `<option value="${s.id}">${s.name} (${s.roll || ''})</option>`).join('');
    controlsWrap.innerHTML = `
      <div id="feesClassFilterWrap"></div>
      <h2 style="margin-top:10px;">নতুন ফি যোগ করুন</h2>
      <label>শিক্ষার্থী</label><select id="onetimeStudent">${opts || '<option value="">কোনো শিক্ষার্থী নেই</option>'}</select>
      <label>ফি এর ধরন</label><input id="onetimeFeeType" placeholder="যেমন: ভর্তি ফি, পরীক্ষার ফি">
      <label>পরিমাণ</label><input id="onetimeAmount" type="number">
      <p id="onetimeError" class="muted" style="color:#dc2626;"></p>
      <button onclick="addOnetimeFee()" style="margin-top:8px;">যোগ করুন</button>
    `;
    document.getElementById('feesClassFilterWrap').innerHTML = classFilterDropdownHtml(feesClassFilter, 'onFeesClassFilterChange');
    loadOnetimeFeesTeacher();
  } else {
    controlsWrap.innerHTML = '';
    loadOnetimeFeesStudent();
  }
}

function addOnetimeFee() {
  const studentId = document.getElementById('onetimeStudent').value;
  const feeType = document.getElementById('onetimeFeeType').value.trim();
  const amount = Number(document.getElementById('onetimeAmount').value);
  const errEl = document.getElementById('onetimeError');
  if (errEl) errEl.textContent = '';
  if (!studentId) { if (errEl) errEl.textContent = 'শিক্ষার্থী নির্বাচন করুন'; return; }
  if (!feeType) { if (errEl) errEl.textContent = 'ফি এর ধরন লিখুন'; return; }
  if (!amount || amount <= 0) { if (errEl) errEl.textContent = 'সঠিক পরিমাণ দিন'; return; }
  db.collection('fees_onetime').add({
    madrasaId, studentId, feeType, amount, status: 'due', date: new Date().toISOString().slice(0,10), createdAt: Date.now()
  }).then(() => {
    document.getElementById('onetimeFeeType').value = '';
    document.getElementById('onetimeAmount').value = '';
  }).catch(e => { if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; showDiagBanner('ফি যোগ ব্যর্থ: ' + e.message); });
}

function loadOnetimeFeesTeacher() {
  const resultWrap = document.getElementById('feesResultWrap');
  if (!resultWrap) return;
  db.collection('fees_onetime').where('madrasaId', '==', madrasaId).orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      let docs = snap.docs;
      if (feesClassFilter !== 'all') {
        docs = docs.filter(d => {
          const student = studentsCache.find(s => s.id === d.data().studentId);
          return student && student.className === feesClassFilter;
        });
      }
      if (docs.length === 0) { resultWrap.innerHTML = '<div class="card"><p class="muted">কোনো ফি এন্ট্রি নেই</p></div>'; return; }
      resultWrap.innerHTML = docs.map(d => {
        const r = d.data();
        const student = studentsCache.find(s => s.id === r.studentId);
        const isPaid = r.status === 'paid';
        return `<div class="student-row" style="display:block;">
          <div style="display:flex;justify-content:space-between;">
            <span>${student ? student.name + (student.className ? ' (' + student.className + ')' : '') : 'অজানা'} - ${r.feeType}</span>
            <span class="badge ${isPaid ? 'present' : 'absent'}">${isPaid ? 'পরিশোধিত' : 'বকেয়া'}</span>
          </div>
          <div class="muted">পরিমাণ: ${r.amount} টাকা | তারিখ: ${r.date}</div>
          <div style="margin-top:6px;">
            <button class="small ${isPaid ? 'secondary' : ''}" onclick="toggleOnetimeFeeStatus('${d.id}', ${isPaid})">${isPaid ? 'বকেয়া করুন' : 'পরিশোধিত চিহ্নিত করুন'}</button>
            <button class="small danger" onclick="deleteOnetimeFee('${d.id}')">মুছুন</button>
          </div>
        </div>`;
      }).join('');
    }, err => {
      resultWrap.innerHTML = '<div class="card"><p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p></div>';
      if (err.code !== 'permission-denied') showDiagBanner('ফি লোড এরর: ' + err.message);
    });
}

function toggleOnetimeFeeStatus(docId, currentlyPaid) {
  db.collection('fees_onetime').doc(docId).set({ status: currentlyPaid ? 'due' : 'paid' }, { merge: true })
    .catch(e => showDiagBanner('ফি স্ট্যাটাস আপডেট ব্যর্থ: ' + e.message));
}

function deleteOnetimeFee(docId) {
  if (!confirm('এই ফি এন্ট্রি মুছতে চান?')) return;
  db.collection('fees_onetime').doc(docId).delete();
}

// ---- One-time fee (student's own view) ----
function loadOnetimeFeesStudent() {
  const resultWrap = document.getElementById('feesResultWrap');
  if (!resultWrap) return;
  resultWrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';
  db.collection('fees_onetime').where('studentId', '==', myStudentId)
    .onSnapshot(snap => {
      if (snap.empty) { resultWrap.innerHTML = '<div class="card"><p class="muted">কোনো ফি তথ্য নেই</p></div>'; return; }
      const rows = snap.docs.map(d => d.data()).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      resultWrap.innerHTML = `<div class="card">${rows.map(r => {
        const isPaid = r.status === 'paid';
        return `<div class="student-row">
          <span>${r.feeType}</span>
          <span class="badge ${isPaid ? 'present' : 'absent'}">${isPaid ? 'পরিশোধিত' : 'বকেয়া'}</span>
        </div>
        <div class="muted">পরিমাণ: ${r.amount} টাকা | তারিখ: ${r.date}</div>`;
      }).join('<hr style="border:none;border-top:1px solid #eee;margin:6px 0;">')}</div>`;
    }, err => {
      resultWrap.innerHTML = '<div class="card"><p class="muted">লোড করতে সমস্যা হয়েছে: ' + err.message + '</p></div>';
      showDiagBanner('আমার ফি লোড এরর: ' + err.message);
    });
}
