/* ShikkhaOS — শিক্ষকের হাজিরা (ধাপ ১)
 *
 * index.html এ সবার শেষে যোগ করুন:
 *   <script defer src="teacher-attendance.js"></script>
 *
 * app.js / dashboard.js বদলাতে হয় না। এই ফাইল:
 *   - "আরও" মেনুর শুরুতে "আমার হাজিরা" ট্যাব যোগ করে
 *   - শিক্ষক "হাজির" ও "প্রস্থান" বাটন চাপলে GPS দিয়ে মাদ্রাসার এরিয়ায় আছেন কিনা যাচাই করে
 *   - সময় নেয় সার্ভারের ঘড়ি (serverTimestamp) থেকে, ফোনের ঘড়ি থেকে নয়
 *   - সেটিংস পাতায় (শুধু অ্যাডমিন) মাদ্রাসার অবস্থান, দূরত্বের সীমা ও দেরির সময় ঠিক করার কার্ড যোগ করে
 *   - অ্যাডমিন "আমার হাজিরা" পাতার নিচে আজকের সব শিক্ষকের তালিকা দেখেন
 *
 * ডেটা: teacher_attendance/{uid}_{YYYY-MM-DD}
 * মাদ্রাসার ডকে নতুন ফিল্ড: attGeoLat, attGeoLng, attGeoRadius, attLateTime
 */
(function () {
  'use strict';

  if (typeof teacherTab !== 'function' || typeof db === 'undefined' || typeof teacherMoreTabs === 'undefined') {
    console.error('[teacher-attendance] app.js ও dashboard.js এর পরে এই ফাইল লোড করুন।');
    return;
  }

  const COL = 'teacher_attendance';
  const el = id => document.getElementById(id);
  const bn = n => toBanglaNumeral(n);
  let nameCache = null; // { uid, name }

  // ================= নিচের মেনু =================
  if (!teacherMoreTabs.some(t => t.key === 'tattendance')) {
    teacherMoreTabs.unshift({ key: 'tattendance', label: 'আমার হাজিরা', icon: '\u{1F552}' });
  }

  // ================= হিসাব / সহায়ক =================
  function cfg() {
    const s = appSettings || {};
    if (s.attGeoLat == null || s.attGeoLng == null) return null;
    const lat = Number(s.attGeoLat), lng = Number(s.attGeoLng);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng, radius: Number(s.attGeoRadius) || 100, late: s.attLateTime || '' };
  }

  function meters(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function getPos() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej({ taMsg: 'এই ফোনে লোকেশন সুবিধা নেই' });
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  }

  function fmtTime(ts) {
    if (!ts || !ts.toDate) return '—';
    return ts.toDate().toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function isLate(ts, lateStr) {
    if (!lateStr || !ts || !ts.toDate) return false;
    const p = lateStr.split(':').map(Number);
    if (p.length < 2 || p.some(isNaN)) return false;
    const d = ts.toDate();
    return d.getHours() * 60 + d.getMinutes() > p[0] * 60 + p[1];
  }

  function lateBadge(ts, lateStr) {
    if (!lateStr) return '';
    return isLate(ts, lateStr)
      ? '<span class="badge pending">দেরি</span>'
      : '<span class="badge present">সময়মতো</span>';
  }

  function errText(e) {
    if (e && e.taMsg) return e.taMsg;
    if (e && typeof e.code === 'number') {
      if (e.code === 1) return 'লোকেশনের অনুমতি দেওয়া হয়নি। ব্রাউজার বা ফোনের সেটিংস থেকে এই অ্যাপকে লোকেশনের অনুমতি দিন।';
      if (e.code === 2) return 'আপনার অবস্থান পাওয়া যায়নি। ফোনের GPS চালু করে আবার চেষ্টা করুন।';
      if (e.code === 3) return 'অবস্থান পেতে বেশি সময় লাগছে। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন।';
    }
    if (e && e.code === 'permission-denied') return 'সংরক্ষণের অনুমতি নেই। অ্যাডমিনকে বলুন firestore.rules হালনাগাদ করতে।';
    return 'সমস্যা হয়েছে: ' + ((e && e.message) || 'অজানা');
  }

  function myName() {
    const u = auth.currentUser;
    if (nameCache && nameCache.uid === u.uid) return Promise.resolve(nameCache.name);
    return db.collection('teachers').doc(u.uid).get()
      .then(d => (d.exists && d.data().name) || u.email || '')
      .catch(() => u.email || '')
      .then(n => { nameCache = { uid: u.uid, name: n }; return n; });
  }

  // ================= শিক্ষকের পাতা =================
  function renderScreen() {
    setScreen(`
      <div id="taScreen">
        <div class="card">
          <h2>আমার হাজিরা</h2>
          <p class="muted" id="taDate" style="margin-top:0;"></p>
          <div id="taBody">লোড হচ্ছে...</div>
          <p id="taMsg" class="muted" style="margin-top:10px;"></p>
        </div>
        ${myTeacherIsAdmin ? '<div class="card"><h2>আজকের সব শিক্ষক</h2><div id="taList">লোড হচ্ছে...</div></div>' : ''}
      </div>`);
    const d = el('taDate');
    if (d) d.textContent = new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    load();
    loadList();
  }

  function docRef() {
    return db.collection(COL).doc(auth.currentUser.uid + '_' + todayLocal());
  }

  function load() {
    docRef().get()
      .then(doc => paint(doc.exists ? doc.data() : null))
      .catch(e => {
        const b = el('taBody');
        if (b) b.innerHTML = '<p class="muted" style="color:#dc2626;">লোড করা যায়নি: ' + esc(errText(e)) + '</p>';
        showDiagBanner('শিক্ষক হাজিরা লোড এরর: ' + (e.code || '') + ' ' + e.message);
      });
  }

  function paint(d) {
    const body = el('taBody');
    if (!body) return;
    const c = cfg();
    if (!c) {
      body.innerHTML = '<p class="muted">মাদ্রাসার অবস্থান এখনো সেট করা হয়নি, তাই হাজিরা দেওয়া যাচ্ছে না।</p>'
        + (myTeacherIsAdmin
          ? '<button onclick="teacherTab(\'settings\')">সেটিংসে গিয়ে অবস্থান সেট করুন</button>'
          : '<p class="muted">অ্যাডমিনকে মাদ্রাসার অবস্থান সেট করতে বলুন।</p>');
      return;
    }
    const hol = (typeof holidayInfo === 'function') ? holidayInfo(todayLocal()) : null;
    const holHtml = hol ? '<p style="text-align:center;color:#4f46e5;font-weight:bold;">🚫 আজ বন্ধের দিন (' + esc(hol.reason) + ')</p>' : '';

    if (!d) {
      body.innerHTML = holHtml + '<p class="muted">আজকের হাজিরা এখনো দেওয়া হয়নি। মাদ্রাসার এরিয়ার ভেতরে এসে নিচের বাটন চাপুন।</p>'
        + '<button id="taBtn" onclick="taAct(\'in\')">✅ হাজির</button>';
      return;
    }
    const inRow = '<div class="student-row"><span>আগমন</span><span><b>' + esc(fmtTime(d.checkInAt)) + '</b> ' + lateBadge(d.checkInAt, c.late) + '</span></div>';
    if (!d.checkOutAt) {
      body.innerHTML = holHtml + inRow
        + '<p class="muted" style="margin-top:10px;">ছুটির সময় মাদ্রাসার এরিয়ায় থেকে "প্রস্থান" চাপুন।</p>'
        + '<button id="taBtn" class="secondary" onclick="taAct(\'out\')">🚪 প্রস্থান</button>';
      return;
    }
    body.innerHTML = holHtml + inRow
      + '<div class="student-row"><span>প্রস্থান</span><span><b>' + esc(fmtTime(d.checkOutAt)) + '</b></span></div>'
      + '<p class="muted" style="margin-top:10px;">আজকের হাজিরা সম্পূর্ণ হয়েছে। জাযাকাল্লাহু খাইরান।</p>';
  }

  window.taAct = function (kind) {
    const c = cfg();
    if (!c) return;
    const btn = el('taBtn'), msg = el('taMsg');
    const say = t => { if (msg) { msg.style.color = ''; msg.textContent = t; } };
    const fail = t => { if (msg) { msg.style.color = '#dc2626'; msg.textContent = t; } if (btn) btn.disabled = false; };
    if (btn) btn.disabled = true;
    say('অবস্থান যাচাই করা হচ্ছে... (১০–২০ সেকেন্ড লাগতে পারে)');

    getPos().then(pos => {
      const cc = pos.coords, acc = cc.accuracy || 0;
      const dist = meters(cc.latitude, cc.longitude, c.lat, c.lng);
      if (acc > 200) throw { taMsg: 'GPS সংকেত দুর্বল (±' + bn(Math.round(acc)) + ' মিটার)। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন।' };
      if (dist > c.radius) throw { taMsg: 'আপনি মাদ্রাসার এরিয়ার বাইরে আছেন (প্রায় ' + bn(Math.round(dist)) + ' মিটার দূরে)। এরিয়ার ভেতরে এসে আবার চেষ্টা করুন।' };

      const ts = firebase.firestore.FieldValue.serverTimestamp();
      const lat = cc.latitude, lng = cc.longitude, d = Math.round(dist), a = Math.round(acc);
      if (kind === 'in') {
        return myName().then(name => docRef().set({
          madrasaId, teacherUid: auth.currentUser.uid, teacherName: name || '', date: todayLocal(),
          checkInAt: ts, checkInLat: lat, checkInLng: lng, checkInDist: d, checkInAcc: a
        }));
      }
      return docRef().update({ checkOutAt: ts, checkOutLat: lat, checkOutLng: lng, checkOutDist: d, checkOutAcc: a });
    }).then(() => {
      say('');
      load();
      loadList();
    }).catch(e => {
      fail(errText(e));
      if (!e || !e.taMsg) showDiagBanner('শিক্ষক হাজিরা সংরক্ষণ এরর: ' + ((e && (e.code || '')) + ' ' + (e && e.message)));
    });
  };

  // ================= অ্যাডমিন: আজকের তালিকা =================
  function loadList() {
    const box = el('taList');
    if (!box || !myTeacherIsAdmin) return;
    const c = cfg();
    db.collection(COL).where('madrasaId', '==', madrasaId).where('date', '==', todayLocal()).get()
      .then(snap => {
        const rows = snap.docs.map(d => d.data()).sort((a, b) =>
          ((a.checkInAt && a.checkInAt.seconds) || 0) - ((b.checkInAt && b.checkInAt.seconds) || 0));
        if (!rows.length) { box.innerHTML = '<p class="muted">আজ এখনো কেউ হাজিরা দেননি</p>'; return; }
        box.innerHTML = rows.map(r => `
          <div class="student-row" style="display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <b>${esc(r.teacherName || '-')}</b>${lateBadge(r.checkInAt, c ? c.late : '')}
            </div>
            <div class="muted">আগমন: ${esc(fmtTime(r.checkInAt))} &nbsp; প্রস্থান: ${r.checkOutAt ? esc(fmtTime(r.checkOutAt)) : '—'}</div>
          </div>`).join('');
      })
      .catch(e => {
        box.innerHTML = '<p class="muted" style="color:#dc2626;">লোড করা যায়নি: ' + esc(errText(e)) + '</p>';
        showDiagBanner('শিক্ষক হাজিরা তালিকা এরর: ' + (e.code || '') + ' ' + e.message);
      });
  }

  // ================= সেটিংস পাতায় অ্যাডমিনের কার্ড =================
  function settingsCardHtml() {
    const s = appSettings || {};
    const c = cfg();
    return `
    <div class="card" id="taSettingsCard">
      <h2>শিক্ষকের হাজিরা: অবস্থান ও সময়</h2>
      <p class="muted">শিক্ষক শুধু মাদ্রাসার এরিয়ার ভেতরে থাকলেই হাজিরা ও প্রস্থান দিতে পারবেন।</p>
      <p style="margin:6px 0;">${c ? '✅ মাদ্রাসার অবস্থান সেট করা আছে' : '❌ মাদ্রাসার অবস্থান এখনো সেট করা হয়নি'}</p>
      <button class="secondary" onclick="taSetLocation()">📍 আমি এখন মাদ্রাসায় আছি, অবস্থান সেট করুন</button>
      <label style="margin-top:12px;">এরিয়ার সীমা (মিটার)</label>
      <input id="taRadius" type="number" inputmode="numeric" value="${esc(s.attGeoRadius || 100)}">
      <label>দেরির সময় (এর পরে এলে "দেরি" দেখাবে)</label>
      <input id="taLate" type="time" value="${esc(s.attLateTime || '')}">
      <p id="taSetErr" class="muted" style="color:#dc2626;"></p>
      <button onclick="taSaveSettings()">সীমা ও সময় সংরক্ষণ করুন</button>
    </div>`;
  }

  const origSettings = window.renderSettingsScreen;
  if (typeof origSettings === 'function') {
    window.renderSettingsScreen = function () {
      const r = origSettings.apply(this, arguments);
      if (myTeacherIsAdmin) {
        const app = el('app');
        if (app) app.insertAdjacentHTML('beforeend', settingsCardHtml());
      }
      return r;
    };
  }

  function radiusValue() {
    const r = Number((el('taRadius') || {}).value);
    return (r >= 30 && r <= 1000) ? r : null;
  }

  window.taSetLocation = function () {
    const err = el('taSetErr');
    if (err) err.textContent = '';
    const r = radiusValue();
    if (r === null) { if (err) err.textContent = 'এরিয়ার সীমা ৩০ থেকে ১০০০ মিটারের মধ্যে দিন'; return; }
    if (!confirm('আপনি কি এখন মাদ্রাসার ভেতরে (মাঝামাঝি জায়গায়) আছেন? এই অবস্থানকেই মাদ্রাসার কেন্দ্র ধরা হবে।')) return;
    if (err) { err.style.color = ''; err.textContent = 'অবস্থান নেওয়া হচ্ছে...'; }
    getPos().then(pos => {
      const acc = Math.round(pos.coords.accuracy || 0);
      if (acc > 60 && !confirm('GPS নির্ভুলতা ±' + acc + ' মিটার, খুব ভালো নয়। খোলা জায়গায় গিয়ে আবার চেষ্টা করা ভালো। তবুও এটি সংরক্ষণ করবেন?')) {
        if (err) err.textContent = '';
        return;
      }
      return db.collection('madrasas').doc(madrasaId).set({
        attGeoLat: pos.coords.latitude, attGeoLng: pos.coords.longitude, attGeoRadius: r
      }, { merge: true }).then(() => { alert('মাদ্রাসার অবস্থান সংরক্ষণ করা হয়েছে'); renderSettingsScreen(); });
    }).catch(e => {
      if (err) { err.style.color = '#dc2626'; err.textContent = errText(e); }
      if (!e || !e.taMsg) showDiagBanner('অবস্থান সেট এরর: ' + ((e && (e.code || '')) + ' ' + (e && e.message)));
    });
  };

  window.taSaveSettings = function () {
    const err = el('taSetErr');
    if (err) { err.style.color = '#dc2626'; err.textContent = ''; }
    const r = radiusValue();
    if (r === null) { if (err) err.textContent = 'এরিয়ার সীমা ৩০ থেকে ১০০০ মিটারের মধ্যে দিন'; return; }
    const late = (el('taLate') || {}).value || '';
    db.collection('madrasas').doc(madrasaId).set({ attGeoRadius: r, attLateTime: late }, { merge: true })
      .then(() => { alert('সংরক্ষণ করা হয়েছে'); renderSettingsScreen(); })
      .catch(e => { if (err) err.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message; showDiagBanner('শিক্ষক হাজিরা সেটিংস ব্যর্থ: ' + e.message); });
  };

  // ================= ট্যাব জোড়া লাগানো =================
  const origTeacherTab = window.teacherTab;
  window.teacherTab = function (tab) {
    if (tab === 'tattendance') {
      if (typeof window.stopTeacherDashboard === 'function') window.stopTeacherDashboard();
      renderTeacherNav('tattendance');
      renderScreen();
      return;
    }
    return origTeacherTab.apply(this, arguments);
  };
})();
