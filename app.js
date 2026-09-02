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
    <button class="tab-btn" onclick="teacherTab('leaves', this)">ছুটি</button>
    <button class="tab-btn" onclick="teacherTab('results', this)">রেজাল্ট</button>
    <button class="tab-btn" onclick="teacherTab('timeleft', this)">বের হওয়ার সময়</button>
    <button class="tab-btn" onclick="teacherTab('notices', this)">নোটিশ</button>
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
  if (tab === 'leaves') renderLeavesScreen(true);
  if (tab === 'results') renderResultsScreen(true);
  if (tab === 'timeleft') renderTimeLeftScreen();
  if (tab === 'notices') renderNoticesScreen(true);
}

function studentTab(tab, el) {
  tabActive(el);
  if (tab === 'attendance') renderMyAttendance();
  if (tab === 'leaves') renderLeavesScreen(false);
  if (tab === 'results') renderResultsScreen(false);
  if (tab === 'notices') renderNoticesScreen(false);
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
        <label>PIN (৪ সংখ্যা)</label><input id="newPin" type="text" inputmode="numeric" maxlength="4" placeholder="যেমন: 1234">
        <button onclick="addStudent()">যোগ করুন</button>
      </div>
      <div class="card">
        <h2>শিক্ষার্থী তালিকা</h2>
        <div id="studentsFilterWrap"></div>
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

  const wrap = document.getElementById('studentsListWrap');
  if (!wrap) return;
  const list = studentsByClass(studentsClassFilter);
  if (list.length === 0) { wrap.innerHTML = '<p class="muted">কোনো শিক্ষার্থী নেই</p>'; return; }
  wrap.innerHTML = list.map(s => `
    <div class="student-row">
      <span>${s.name} <span class="muted">(রোল ${s.roll || '-'}, ${s.className || '-'})</span> <span class="muted">${s.pin ? '✅ PIN সেট' : '❌ PIN নেই'}</span></span>
      <span>
        <button class="small secondary" onclick="setStudentPin('${s.id}')">PIN সেট/পরিবর্তন</button>
        <button class="small danger" onclick="deleteStudent('${s.id}')">মুছুন</button>
      </span>
    </div>
  `).join('');
}

function addStudent() {
  const name = document.getElementById('newName').value.trim();
  const roll = document.getElementById('newRoll').value.trim();
  const className = document.getElementById('newClass').value.trim();
  const pin = document.getElementById('newPin').value.trim();
  if (!name) return alert('নাম দিন');
  if (pin && !/^\d{4}$/.test(pin)) return alert('PIN অবশ্যই ৪ সংখ্যার হতে হবে');
  db.collection('students').add({ name, roll, className, pin: pin || '', createdAt: Date.now() })
    .then(() => {
      document.getElementById('newName').value = '';
      document.getElementById('newRoll').value = '';
      document.getElementById('newClass').value = '';
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

// ---- Results ----
function renderResultsScreen(isTeacher) {
  let html = '';
  if (isTeacher) {
    const students = studentsByClass(resultsClassFilter);
    const opts = students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    html += `
      <div class="card">
        <h2>রেজাল্ট এন্ট্রি</h2>
        <div id="resultsFilterWrap"></div>
        <label>শিক্ষার্থী</label><select id="resStudent">${opts}</select>
        <label>পরীক্ষার নাম</label><input id="resExam" placeholder="যেমন: অর্ধবার্ষিক">
        <label>প্রাপ্ত নম্বর</label><input id="resMarks" type="number">
        <button onclick="submitResult()">সংরক্ষণ করুন</button>
      </div>`;
  }
  html += `<div class="card"><h2>${isTeacher ? 'সকল রেজাল্ট' : 'আমার রেজাল্ট'}</h2><div id="resultsWrap">লোড হচ্ছে...</div></div>`;
  setScreen(html);

  if (isTeacher) {
    const filterWrap = document.getElementById('resultsFilterWrap');
    if (filterWrap) filterWrap.innerHTML = classFilterDropdownHtml(resultsClassFilter, 'onResultsClassFilterChange');
  }

  let q = db.collection('results');
  if (isTeacher) q = q.orderBy('date', 'desc');
  else q = q.where('studentId', '==', myStudentId);

  q.onSnapshot(snap => {
    const wrap = document.getElementById('resultsWrap');
    if (!wrap) return;
    if (snap.empty) { wrap.innerHTML = '<p class="muted">কোনো রেজাল্ট নেই</p>'; return; }
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
      return `<div class="student-row">
        <span>${isTeacher ? (student ? student.name + (student.className ? ' (' + student.className + ')' : '') : 'অজানা') + ' - ' : ''}${r.examName}</span>
        <b>${r.marks}</b>
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

function submitResult() {
  const studentId = document.getElementById('resStudent').value;
  const examName = document.getElementById('resExam').value.trim();
  const marks = document.getElementById('resMarks').value;
  if (!studentId || !examName || marks === '') return alert('সব ঘর পূরণ করুন');
  db.collection('results').doc(studentId + '_' + examName).set({
    studentId, examName, marks: Number(marks), date: new Date().toISOString().slice(0,10)
  }).then(() => { document.getElementById('resExam').value=''; document.getElementById('resMarks').value=''; });
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
