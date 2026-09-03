// ================= STATE =================
let role = localStorage.getItem('role') || null; // 'teacher' | 'student'
let myStudentId = localStorage.getItem('myStudentId') || null;
let studentsCache = [];
const auth = firebase.auth();

// class filter state per screen (teacher side)
let studentsClassFilter = 'all';
let attClassFilter = 'all';
let resultsClassFilter = 'all';
let leavesClassFilter = 'all';
let tlClassFilter = 'all';
let diaryClassFilter = 'all';
let suggestionsClassFilter = 'all';

// attendance report state (daily/monthly)
let reportClassFilter = 'all';
let reportMode = 'daily'; // 'daily' | 'monthly'
let reportDate = new Date().toISOString().slice(0,10);
let reportMonth = new Date().toISOString().slice(0,7); // 'YYYY-MM'
let reportStudentId = '';

// marksheet entry state (teacher side, in-progress subject rows before save)
let currentMarksheetSubjects = [];
let lastResultsIsTeacher = true;

// app settings (madrasa name & logo)
let appSettings = {};

// ================= INIT =================
window.addEventListener('DOMContentLoaded', () => {
  db.collection('_ping').doc('x').get()
    .then(() => setSync(true))
    .catch(() => setSync(false));

  auth.onAuthStateChanged(user => {
    if (!user) {
      // Everyone (teacher or student) needs to be signed in (at least anonymously)
      // before Firestore rules will allow reading student/attendance/result data.
      auth.signInAnonymously().catch(err => console.error('Anonymous sign-in failed:', err));
      return; // onAuthStateChanged will fire again once signed in
    }

    listenStudents();
    listenSettings();

    const isTeacherAccount = user.providerData.length > 0; // email/password = teacher, anonymous = student/guest

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
      }).catch(() => showStudentPicker());
    } else {
      showRoleSelect();
    }
  });
});

function setSync(ok) {
  const dot = document.getElementById('syncDot');
  if (dot) dot.className = 'sync-dot' + (ok ? '' : ' offline');
}

// ================= APP SETTINGS (মাদরাসার নাম ও লোগো) =================
function listenSettings() {
  db.collection('settings').doc('app').onSnapshot(doc => {
    appSettings = doc.exists ? (doc.data() || {}) : {};
    renderTopBar();
  }, () => renderTopBar());
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
  `);
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
    db.collection('settings').doc('app').set(data, { merge: true })
      .then(() => { alert('সংরক্ষণ করা হয়েছে'); renderSettingsScreen(); })
      .catch(e => { if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; });
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
  db.collection('settings').doc('app').set({ logoDataUrl: '' }, { merge: true })
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

// ================= ROLE SELECT =================
function showRoleSelect() {
  setScreen(`
    <div class="card" style="text-align:center;margin-top:60px;">
      <h2>মাদরাসা হাজিরা অ্যাপ</h2>
      <p class="muted">আপনি কে?</p>
      <button onclick="pickRole('teacher')">👨‍🏫 শিক্ষক</button>
      <button class="secondary" onclick="pickRole('student')" style="margin-top:8px;">🎓 শিক্ষার্থী</button>
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
    .then(() => showTeacherApp())
    .catch(err => {
      errEl.textContent = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
        ? 'ইমেইল বা পাসওয়ার্ড সঠিক নয়'
        : 'লগইন ব্যর্থ: ' + err.message;
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
  if (!student.pin) {
    if (errEl) errEl.textContent = 'এই শিক্ষার্থীর জন্য এখনো PIN সেট করা হয়নি। শিক্ষককে জানান।';
    return;
  }
  if (enteredPin !== student.pin) {
    if (errEl) errEl.textContent = 'ভুল PIN দিয়েছেন';
    return;
  }

  const uid = auth.currentUser.uid;
  db.collection('sessions').doc(uid).set({ studentId: student.id, name: student.name, updatedAt: Date.now() }, { merge: true })
    .then(() => {
      myStudentId = student.id;
      localStorage.setItem('myStudentId', myStudentId);
      showStudentApp();
    })
    .catch(e => { if (errEl) errEl.textContent = 'প্রবেশ ব্যর্থ: ' + e.message; });
}

function logout() {
  if (role === 'teacher' && auth.currentUser && auth.currentUser.providerData.length > 0) auth.signOut();
  localStorage.removeItem('role');
  localStorage.removeItem('myStudentId');
  role = null; myStudentId = null;
  showRoleSelect();
}

// ================= NAV =================
function hideNav() { document.getElementById('bottomNav').style.display = 'none'; }
function setScreen(html) { document.getElementById('app').innerHTML = html; }

function showTeacherApp() {
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('bottomNav').innerHTML = `
    <button class="tab-btn active" onclick="teacherTab('students', this)">শিক্ষার্থী</button>
    <button class="tab-btn" onclick="teacherTab('attendance', this)">উপস্থিতি</button>
    <button class="tab-btn" onclick="teacherTab('report', this)">রিপোর্ট</button>
    <button class="tab-btn" onclick="teacherTab('leaves', this)">ছুটি</button>
    <button class="tab-btn" onclick="teacherTab('results', this)">রেজাল্ট</button>
    <button class="tab-btn" onclick="teacherTab('timeleft', this)">বের হওয়ার সময়</button>
    <button class="tab-btn" onclick="teacherTab('notices', this)">নোটিশ</button>
    <button class="tab-btn" onclick="teacherTab('diary', this)">ডায়েরী</button>
    <button class="tab-btn" onclick="teacherTab('suggestions', this)">পরামর্শ</button>
    <button class="tab-btn" onclick="teacherTab('settings', this)">সেটিংস</button>
  `;
  teacherTab('students');
}

function showStudentApp() {
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('bottomNav').innerHTML = `
    <button class="tab-btn active" onclick="studentTab('attendance', this)">উপস্থিতি</button>
    <button class="tab-btn" onclick="studentTab('leaves', this)">ছুটির আবেদন</button>
    <button class="tab-btn" onclick="studentTab('results', this)">রেজাল্ট</button>
    <button class="tab-btn" onclick="studentTab('notices', this)">নোটিশ</button>
    <button class="tab-btn" onclick="studentTab('diary', this)">ডায়েরী</button>
    <button class="tab-btn" onclick="studentTab('suggestions', this)">পরামর্শ</button>
  `;
  studentTab('attendance');
}

function tabActive(el) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

// ================= STUDENTS (shared, realtime) =================
function listenStudents() {
  db.collection('students').orderBy('roll').onSnapshot(snap => {
    studentsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setSync(true);
    // refresh currently visible screen if it depends on student list
    if (role === 'teacher' && document.getElementById('studentsScreen')) renderStudentsList();
    if (role === 'teacher' && document.getElementById('attendanceScreen')) renderAttendanceList();
  }, () => setSync(false));
}

function teacherTab(tab, el) {
  tabActive(el);
  if (tab === 'students') renderStudentsScreen();
  if (tab === 'attendance') renderAttendanceScreen();
  if (tab === 'report') renderReportScreen();
  if (tab === 'leaves') renderLeavesScreen(true);
  if (tab === 'results') { currentMarksheetSubjects = []; renderResultsScreen(true); }
  if (tab === 'timeleft') renderTimeLeftScreen();
  if (tab === 'notices') renderNoticesScreen(true);
  if (tab === 'diary') renderDiaryScreen(true);
  if (tab === 'suggestions') renderSuggestionsScreen(true);
  if (tab === 'settings') renderSettingsScreen();
}

function studentTab(tab, el) {
  tabActive(el);
  if (tab === 'attendance') renderMyAttendance();
  if (tab === 'leaves') renderLeavesScreen(false);
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
  wrap.innerHTML = list.map(s => `
    <div class="student-row" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>${s.name} <span class="muted">(রোল ${s.roll || '-'}, ${s.className || '-'})</span></span>
        ${s.hasWhatsapp && s.phone ? `<a href="https://wa.me/${normalizePhoneForWhatsapp(s.phone)}" target="_blank" style="text-decoration:none;font-size:20px;" title="WhatsApp-এ মেসেজ পাঠান">💬</a>` : ''}
      </div>
      <div class="muted" style="margin-top:2px;">
        ${s.phone ? '📱 ' + s.phone : 'মোবাইল নম্বর নেই'} &nbsp; ${s.pin ? '✅ PIN সেট' : '❌ PIN নেই'}
      </div>
      <div style="margin-top:6px;">
        <button class="small secondary" onclick="setStudentPin('${s.id}')">PIN সেট/পরিবর্তন</button>
        <button class="small secondary" onclick="setStudentPhone('${s.id}')">নম্বর সম্পাদনা</button>
        <button class="small danger" onclick="deleteStudent('${s.id}')">মুছুন</button>
      </div>
    </div>
  `).join('');
}

function normalizePhoneForWhatsapp(phone) {
  let p = (phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '88' + p; // Bangladeshi local -> international
  return p;
}

function setStudentPhone(id) {
  const student = studentsCache.find(s => s.id === id);
  const phone = prompt('মোবাইল নম্বর দিন (যেমন: 01712345678):', student && student.phone ? student.phone : '');
  if (phone === null) return; // cancelled
  const trimmed = phone.trim();
  const hasWhatsapp = trimmed ? confirm('এই নম্বরে কি WhatsApp আছে?') : false;
  db.collection('students').doc(id).set({ phone: trimmed, hasWhatsapp }, { merge: true })
    .catch(e => alert('সংরক্ষণ ব্যর্থ: ' + e.message));
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
  db.collection('students').add({ name, roll, className, phone, hasWhatsapp, pin: pin || '', createdAt: Date.now() })
    .then(() => {
      document.getElementById('newName').value = '';
      document.getElementById('newRoll').value = '';
      document.getElementById('newClass').value = '';
      document.getElementById('newPhone').value = '';
      document.getElementById('newWhatsapp').checked = false;
      document.getElementById('newPin').value = '';
    })
    .catch(e => alert('সংরক্ষণ ব্যর্থ: ' + e.message));
}

function setStudentPin(id) {
  const pin = prompt('শিক্ষার্থীর জন্য ৪-সংখ্যার PIN দিন:');
  if (pin === null) return; // cancelled
  if (!/^\d{4}$/.test(pin)) { alert('PIN অবশ্যই ৪ সংখ্যার হতে হবে'); return; }
  db.collection('students').doc(id).set({ pin }, { merge: true })
    .catch(e => alert('PIN সংরক্ষণ ব্যর্থ: ' + e.message));
}

function deleteStudent(id) {
  if (!confirm('সত্যিই মুছতে চান?')) return;
  db.collection('students').doc(id).delete();
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
  students.forEach(s => {
    db.collection('attendance').doc(s.id + '_' + date).get().then(doc => {
      const d = doc.exists ? doc.data() : {};
      const cell = document.getElementById('att_' + s.id);
      if (!cell) return;
      cell.innerHTML = `
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
    });
  });
}

function setAttendance(studentId, date, status) {
  db.collection('attendance').doc(studentId + '_' + date).set({ studentId, date, status }, { merge: true })
    .then(() => renderAttendanceList());
}

function updateAttField(studentId, date, field, value) {
  db.collection('attendance').doc(studentId + '_' + date).set({ studentId, date, [field]: value }, { merge: true });
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
    });
}

function submitMyTimeLeft() {
  const today = new Date().toISOString().slice(0,10);
  const value = document.getElementById('myTimeLeft').value;
  if (!value) return;
  db.collection('attendance').doc(myStudentId + '_' + today).set({
    studentId: myStudentId, date: today, timeLeftHome: value
  }, { merge: true });
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
  if (isTeacher) q = q.orderBy('createdAt', 'desc');
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
  db.collection('leaves').add({ studentId: myStudentId, date, reason, status: 'pending', createdAt: Date.now() })
    .then(() => { document.getElementById('leaveReason').value=''; });
}

function setLeaveStatus(id, status) {
  db.collection('leaves').doc(id).update({ status });
}

// ================= RESULTS / MARKSHEET =================

// Standard percentage -> grade scale used for the marksheet
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
  }

  let q = db.collection('results');
  if (isTeacher) {
    q = q.orderBy('date', 'desc');
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
  });
}

function onResultsClassFilterChange(value) {
  resultsClassFilter = value;
  renderResultsScreen(true);
}

function addSubjectRow() {
  const name = document.getElementById('resSubjectName').value.trim();
  const full = Number(document.getElementById('resSubjectFull').value);
  const obtained = Number(document.getElementById('resSubjectObtained').value);
  if (!name) return alert('বিষয়ের নাম লিখুন');
  if (!full || full <= 0) return alert('পূর্ণ নম্বর সঠিকভাবে দিন');
  if (document.getElementById('resSubjectObtained').value === '' || isNaN(obtained)) return alert('প্রাপ্ত নম্বর দিন');
  if (obtained > full) return alert('প্রাপ্ত নম্বর পূর্ণ নম্বরের চেয়ে বেশি হতে পারে না');
  currentMarksheetSubjects.push({ name, full, obtained });
  document.getElementById('resSubjectName').value = '';
  document.getElementById('resSubjectFull').value = '100';
  document.getElementById('resSubjectObtained').value = '';
  renderSubjectRows();
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
  if (!studentId) return alert('শিক্ষার্থী নির্বাচন করুন');
  if (!examName) return alert('পরীক্ষার নাম লিখুন');
  if (currentMarksheetSubjects.length === 0) return alert('অন্তত একটি বিষয় যোগ করুন');

  const totalObtained = currentMarksheetSubjects.reduce((sum, s) => sum + s.obtained, 0);
  const totalFull = currentMarksheetSubjects.reduce((sum, s) => sum + s.full, 0);
  const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
  const { grade, gpa } = gradeFromPercent(percentage);

  db.collection('results').doc(studentId + '_' + examName).set({
    studentId,
    examName,
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
  }).catch(e => alert('সংরক্ষণ ব্যর্থ: ' + e.message));
}

function togglePublish(docId, currentlyPublished) {
  db.collection('results').doc(docId).set({ published: !currentlyPublished }, { merge: true })
    .catch(e => alert('আপডেট ব্যর্থ: ' + e.message));
}

function deleteMarksheet(docId) {
  if (!confirm('এই মার্কশিট মুছতে চান?')) return;
  db.collection('results').doc(docId).delete();
}

function viewMarksheet(studentId, docId) {
  db.collection('results').doc(docId).get().then(doc => {
    if (!doc.exists) return alert('মার্কশিট খুঁজে পাওয়া যায়নি');
    const r = doc.data();
    const student = studentsCache.find(s => s.id === studentId) || {};
    const hasSubjects = Array.isArray(r.subjects) && r.subjects.length > 0;

    const rows = hasSubjects ? r.subjects.map(s => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;">${s.name}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;">${s.full}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;">${s.obtained}</td>
      </tr>
    `).join('') : `<tr><td colspan="3" style="padding:6px;border:1px solid #ddd;text-align:center;" class="muted">বিষয়ভিত্তিক তথ্য নেই (পুরাতন রেজাল্ট)</td></tr>`;

    const totalRow = hasSubjects ? `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;"><b>মোট</b></td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;"><b>${r.totalFull}</b></td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;"><b>${r.totalObtained}</b></td>
      </tr>
    ` : '';

    setScreen(`
      <style id="marksheetPrintStyle">
        @media print {
          #bottomNav, .no-print { display: none !important; }
        }
      </style>
      <div class="card" id="marksheetPrintArea">
        <h2 style="text-align:center;margin-bottom:2px;">মার্কশিট</h2>
        <p class="muted" style="text-align:center;margin-top:0;">${r.examName}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:10px 0;">
        <p><b>নাম:</b> ${student.name || '-'}</p>
        <p><b>রোল:</b> ${student.roll || '-'} &nbsp;&nbsp; <b>শ্রেণি:</b> ${student.className || '-'}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr>
              <th style="padding:6px;border:1px solid #ddd;text-align:left;">বিষয়</th>
              <th style="padding:6px;border:1px solid #ddd;">পূর্ণ নম্বর</th>
              <th style="padding:6px;border:1px solid #ddd;">প্রাপ্ত নম্বর</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${totalRow}
          </tbody>
        </table>
        ${hasSubjects ? `
          <p style="margin-top:10px;"><b>শতাংশ:</b> ${r.percentage}%</p>
          <p><b>গ্রেড:</b> ${r.grade} ${r.gpa ? '(GPA ' + r.gpa + ')' : ''}</p>
        ` : `<p style="margin-top:10px;"><b>প্রাপ্ত নম্বর:</b> ${r.marks !== undefined ? r.marks : '-'}</p>`}
        <p class="muted" style="margin-top:10px;">তারিখ: ${r.date || '-'}</p>
        <div class="no-print" style="margin-top:14px;">
          <button onclick="printMarksheet()">🖨️ প্রিন্ট করুন</button>
          <button class="secondary" onclick="renderResultsScreen(lastResultsIsTeacher)">ফিরে যান</button>
        </div>
      </div>
    `);
  }).catch(e => alert('লোড ব্যর্থ: ' + e.message));
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
  db.collection('attendance').where('date', '==', date).get().then(snap => {
    const wrap = document.getElementById('tlWrap');
    const rows = {};
    snap.docs.forEach(d => rows[d.data().studentId] = d.data());
    const students = studentsByClass(tlClassFilter);
    if (students.length === 0) { wrap.innerHTML = '<p class="muted">এই শ্রেণিতে শিক্ষার্থী নেই</p>'; return; }
    wrap.innerHTML = students.map(s => {
      const r = rows[s.id] || {};
      return `<div class="student-row"><span>${s.name} <span class="muted">(${s.className || '-'})</span></span><span>${r.timeLeftHome || '—'}</span></div>`;
    }).join('');
  });
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

  db.collection('attendance').where('studentId', '==', reportStudentId).get()
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

  db.collection('notices').orderBy('createdAt', 'desc').onSnapshot(snap => {
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
  });
}

function addNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const body = document.getElementById('noticeBody').value.trim();
  if (!title || !body) return alert('শিরোনাম ও বিস্তারিত লিখুন');
  db.collection('notices').add({ title, body, createdAt: Date.now() })
    .then(() => { document.getElementById('noticeTitle').value=''; document.getElementById('noticeBody').value=''; })
    .catch(e => alert('সংরক্ষণ ব্যর্থ: ' + e.message));
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
    diaryQuery = db.collection('diary').orderBy('createdAt', 'desc');
  } else {
    const me = studentsCache.find(s => s.id === myStudentId);
    const myClass = me ? me.className : null;
    if (!myClass) {
      const wrap = document.getElementById('diaryWrap');
      if (wrap) wrap.innerHTML = '<p class="muted">শ্রেণি তথ্য পাওয়া যায়নি</p>';
      return;
    }
    // Firestore requires the query itself to filter by className (matching the
    // security rule's resource.data.className check) — a plain list query
    // without this where() is rejected as insufficient permissions.
    diaryQuery = db.collection('diary').where('className', '==', myClass).orderBy('createdAt', 'desc');
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
      date, className, text,
      attachmentDataUrl: attachmentDataUrl || '',
      attachmentName: attachmentName || '',
      attachmentType: attachmentType || '',
      createdAt: Date.now()
    }).then(() => {
      document.getElementById('diaryText').value = '';
      if (fileInput) fileInput.value = '';
    }).catch(e => { if (errEl) errEl.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; });
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
  if (isTeacher) q = q.orderBy('createdAt', 'desc');
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
  db.collection('suggestions').add({ studentId: myStudentId, text, createdAt: Date.now() })
    .then(() => {
      document.getElementById('suggestionText').value = '';
      alert('আপনার পরামর্শ পাঠানো হয়েছে');
    })
    .catch(e => { if (errEl) errEl.textContent = 'পাঠাতে ব্যর্থ: ' + e.message; });
}

function deleteSuggestion(id) {
  if (!confirm('এই পরামর্শ মুছতে চান?')) return;
  db.collection('suggestions').doc(id).delete();
}
