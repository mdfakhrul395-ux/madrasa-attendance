
// =====================================================================
// ===== পরামর্শ বক্স: শুধু অ্যাডমিন ও সংশ্লিষ্ট শিক্ষার্থী/অভিভাবকের মাঝে সীমাবদ্ধ =====
// এই অংশটি app.js ফাইলের একদম শেষে যোগ করতে হবে।
// জাভাস্ক্রিপ্টে একই নামের ফাংশন পরে লিখলে সেটিই কার্যকর হয় — তাই উপরের
// পুরাতন renderTeacherNav / teacherTab / renderSuggestionsScreen
// এখান থেকে প্রতিস্থাপিত হবে (মেধাক্রম ফাংশনের মতোই)।
// আসল নিরাপত্তা firestore.rules-এ; এখানকার ট্যাব লুকানো শুধু সুবিধার জন্য।
// =====================================================================

// শিক্ষার্থীর লেখা টেক্সট সরাসরি innerHTML-এ বসালে সেটি অ্যাডমিনের স্ক্রিনে
// কোড চালিয়ে দিতে পারে, তাই সব পরামর্শ/উত্তর এই ফাংশন দিয়ে নিরাপদ করা হয়।
function escapeHtml(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTeacherNav(activeKey) {
  const nav = document.getElementById('bottomNav');
  nav.style.display = 'block';
  // "শিক্ষকগণ" ও "পরামর্শ" শুধু অ্যাডমিন শিক্ষকের জন্য; "সুপার অ্যাডমিন" শুধু মালিকের অ্যাকাউন্টের জন্য।
  const visibleMoreTabs = teacherMoreTabs.filter(t => {
    if (t.key === 'teachers') return myTeacherIsAdmin;
    if (t.key === 'suggestions') return myTeacherIsAdmin;
    if (t.key === 'super_admin') return isSuperAdminUser;
    return true;
  });
  nav.innerHTML = buildNavHtml(teacherPrimaryTabs, visibleMoreTabs, 'teacherTab', activeKey);
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
  if (tab === 'suggestions') { if (myTeacherIsAdmin) renderSuggestionsScreen(true); else teacherTab('students'); }
  if (tab === 'teachers') { if (myTeacherIsAdmin) renderTeachersScreen(); else teacherTab('students'); }
  if (tab === 'super_admin') { if (isSuperAdminUser) renderSuperAdminScreen(); else teacherTab('students'); }
  if (tab === 'settings') renderSettingsScreen();
}

// isTeacher = true মানে অ্যাডমিনের ভিউ (সব পরামর্শ + উত্তর দেওয়া), false মানে শিক্ষার্থীর ভিউ (শুধু নিজের পরামর্শ ও উত্তর)
function renderSuggestionsScreen(isTeacher) {
  if (isTeacher && !myTeacherIsAdmin) { teacherTab('students'); return; }

  let html = '';
  if (!isTeacher) {
    html += `
      <div class="card">
        <h2>পরামর্শ পাঠান</h2>
        <p class="muted">আপনার পরামর্শ শুধু মাদ্রাসার অ্যাডমিন দেখতে পাবেন, অন্য কেউ নয়।</p>
        <label>আপনার পরামর্শ লিখুন</label>
        <textarea id="suggestionText" rows="4" maxlength="2000" placeholder="আপনার পরামর্শ / মতামত লিখুন"></textarea>
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
      const replyDate = r.repliedAt ? new Date(r.repliedAt).toLocaleDateString('bn-BD') : '';
      const title = isTeacher
        ? (student ? escapeHtml(student.name) + (student.className ? ' (' + escapeHtml(student.className) + ')' : '') : 'অজানা')
        : 'আপনার পরামর্শ';
      const replyHtml = r.reply
        ? `<div style="margin-top:8px;padding:8px 10px;background:#eef2ff;border-radius:8px;">
             <div class="muted" style="font-size:12px;">অ্যাডমিনের উত্তর${replyDate ? ' • ' + replyDate : ''}</div>
             <div>${escapeHtml(r.reply).replace(/\n/g, '<br>')}</div>
           </div>`
        : '';
      return `<div class="student-row" style="display:block;">
        <div style="display:flex;justify-content:space-between;">
          <b>${title}</b>
          <span class="muted">${date}</span>
        </div>
        <div style="margin-top:4px;">${escapeHtml(r.text).replace(/\n/g, '<br>')}</div>
        ${replyHtml}
        ${isTeacher ? `<div style="margin-top:6px;">
          <button class="small secondary" onclick="replyToSuggestion('${d.id}')">${r.reply ? 'উত্তর সম্পাদনা' : 'উত্তর দিন'}</button>
          <button class="small danger" onclick="deleteSuggestion('${d.id}')">মুছুন</button>
        </div>` : ''}
      </div>`;
    }).join('');
  }, err => {
    const wrap = document.getElementById('suggestionsWrap');
    if (wrap) wrap.innerHTML = '<p class="muted">লোড করতে সমস্যা হয়েছে: ' + escapeHtml(err.message) + '</p>';
    if (err.code !== 'permission-denied') showDiagBanner('পরামর্শ লোড এরর: ' + err.message);
  });
}

// অ্যাডমিন একটি পরামর্শের উত্তর লেখে/বদলায়; শুধু ওই শিক্ষার্থীই এটি দেখতে পায়
function replyToSuggestion(id) {
  if (!myTeacherIsAdmin) return;
  db.collection('suggestions').doc(id).get().then(doc => {
    if (!doc.exists) return alert('পরামর্শটি খুঁজে পাওয়া যায়নি');
    const existing = doc.data().reply || '';
    const input = prompt('উত্তর লিখুন (শুধু এই শিক্ষার্থী দেখতে পাবে):', existing);
    if (input === null) return; // বাতিল
    const text = input.trim();
    const data = text
      ? { reply: text, repliedAt: Date.now() }
      : { reply: firebase.firestore.FieldValue.delete(), repliedAt: firebase.firestore.FieldValue.delete() };
    return db.collection('suggestions').doc(id).update(data);
  }).catch(e => { alert('উত্তর সংরক্ষণ ব্যর্থ: ' + e.message); showDiagBanner('পরামর্শের উত্তর ব্যর্থ: ' + e.message); });
}
