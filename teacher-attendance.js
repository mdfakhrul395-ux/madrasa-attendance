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
 *   - অ্যাডমিন "আমার হাজিরা" পাতার নিচে যেকোনো তারিখের সব শিক্ষকের হাজিরা দেখেন এবং হাতে সংশোধন করেন
 *     (উপস্থিত / অনুপস্থিত / ছুটি চিহ্নিত, আগমন-প্রস্থানের সময় সম্পাদনা, রেকর্ড মোছা)
 *   - অ্যাডমিন মাসিক রিপোর্ট দেখেন ও প্রিন্ট করেন (উপস্থিত, দেরি, অনুপস্থিত, ছুটি, গড় আগমনের সময়)
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
    taTeachers = null;
    setScreen(`
      <div id="taScreen">
        <div class="card">
          <h2>আমার হাজিরা</h2>
          <p class="muted" id="taDate" style="margin-top:0;"></p>
          <div id="taBody">লোড হচ্ছে...</div>
          <p id="taMsg" class="muted" style="margin-top:10px;"></p>
        </div>
        ${myTeacherIsAdmin ? '<div class="card"><h2>সব শিক্ষকের হাজিরা</h2><input type="date" id="taListDate" value="' + todayLocal() + '" onchange="taLoadList()"><div id="taList" style="margin-top:8px;">লোড হচ্ছে...</div></div><div class="card no-print"><h2>মাসিক রিপোর্ট</h2><input type="month" id="taMonth" value="' + todayLocal().slice(0, 7) + '" onchange="taClearMonth()"><button onclick="taLoadMonth()" style="margin-top:8px;">রিপোর্ট দেখুন</button></div><div id="taMonthWrap"></div>' : ''}
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
    if (!d.checkInAt && (d.status === 'absent' || d.status === 'leave')) {
      body.innerHTML = holHtml + '<p>অ্যাডমিন আজ আপনাকে <b>' + (d.status === 'leave' ? 'ছুটি' : 'অনুপস্থিত') + '</b> চিহ্নিত করেছেন।</p><p class="muted">ভুল হলে অ্যাডমিনকে জানান।</p>';
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

  // ================= অ্যাডমিন: সব শিক্ষকের হাজিরা (যেকোনো তারিখ) ও হাতে সংশোধন =================
  let taTeachers = null;   // মাদ্রাসার সক্রিয় শিক্ষকদের তালিকা (একবার পড়া হয়)
  let taDayCache = {};     // নির্বাচিত তারিখের রেকর্ড, teacherUid অনুযায়ী

  function listDate() { const i = el('taListDate'); return (i && i.value) || todayLocal(); }

  function teacherList() {
    if (taTeachers) return Promise.resolve(taTeachers);
    return db.collection('teachers').where('madrasaId', '==', madrasaId).get().then(snap => {
      taTeachers = snap.docs
        .map(d => { const t = d.data(); return { uid: d.id, name: t.name || t.email || d.id, active: t.active !== false, pending: t.pending === true }; })
        .filter(t => t.active && !t.pending)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'bn'));
      return taTeachers;
    });
  }

  function toHM(ts) {
    const d = ts.toDate();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // "08:15" (বাংলা সংখ্যাও চলবে) → ওই তারিখের Timestamp; ভুল হলে null
  function parseHM(date, v) {
    const m = toEnglishDigits(String(v || '').trim()).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    const p = date.split('-').map(Number);
    return firebase.firestore.Timestamp.fromDate(new Date(p[0], p[1] - 1, p[2], h, mi));
  }

  function taFail(e) {
    alert('সংরক্ষণ ব্যর্থ: ' + errText(e));
    showDiagBanner('শিক্ষক হাজিরা সংশোধন এরর: ' + ((e && (e.code || '')) + ' ' + (e && e.message)));
  }

  function loadList() {
    const box = el('taList');
    if (!box || !myTeacherIsAdmin) return;
    const date = listDate();
    const c = cfg();
    box.innerHTML = 'লোড হচ্ছে...';
    Promise.all([
      teacherList(),
      db.collection(COL).where('madrasaId', '==', madrasaId).where('date', '==', date).get()
    ]).then(res => {
      if (listDate() !== date || !el('taList')) return; // এর মধ্যে তারিখ বদলে গেছে
      const list = res[0];
      const byUid = {};
      res[1].docs.forEach(d => { const x = d.data(); byUid[x.teacherUid] = x; });
      taDayCache = byUid;
      if (!list.length) { box.innerHTML = '<p class="muted">কোনো সক্রিয় শিক্ষক পাওয়া যায়নি</p>'; return; }

      let nPresent = 0, nLate = 0, nAbsent = 0, nLeave = 0, nNone = 0;
      const rows = list.map(t => {
        const r = byUid[t.uid];
        const id = jsq(t.uid);
        let badge, detail = '';
        if (r && r.checkInAt) {
          nPresent++;
          if (c && c.late && isLate(r.checkInAt, c.late)) nLate++;
          badge = lateBadge(r.checkInAt, c ? c.late : '') || '<span class="badge present">উপস্থিত</span>';
          detail = 'আগমন: ' + esc(fmtTime(r.checkInAt)) + ' &nbsp; প্রস্থান: ' + (r.checkOutAt ? esc(fmtTime(r.checkOutAt)) : '—');
        } else if (r && r.status === 'absent') { nAbsent++; badge = '<span class="badge absent">অনুপস্থিত</span>'; }
        else if (r && r.status === 'leave') { nLeave++; badge = '<span class="badge pending">ছুটি</span>'; }
        else { nNone++; badge = '<span class="badge pending">হাজিরা নেই</span>'; }
        const manual = r && r.manual ? ' <span class="muted" style="font-size:11px;">(অ্যাডমিন চিহ্নিত)</span>' : '';
        return `
          <div class="student-row" style="display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <b>${esc(t.name)}</b>${badge}
            </div>
            ${detail ? '<div class="muted">' + detail + manual + '</div>' : (manual ? '<div class="muted">' + manual + '</div>' : '')}
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">
              <button class="small secondary" onclick="taMark('${id}','present')">উপস্থিত</button>
              <button class="small secondary" onclick="taMark('${id}','absent')">অনুপস্থিত</button>
              <button class="small secondary" onclick="taMark('${id}','leave')">ছুটি</button>
              ${r && r.checkInAt ? `<button class="small secondary" onclick="taEditTimes('${id}')">✎ সময়</button>` : ''}
              ${r ? `<button class="small danger" onclick="taDelete('${id}')">মুছুন</button>` : ''}
            </div>
          </div>`;
      }).join('');

      const hol = (typeof holidayInfo === 'function') ? holidayInfo(date) : null;
      box.innerHTML = (hol ? '<p class="muted" style="color:#4f46e5;">🚫 এই দিন বন্ধের দিন (' + esc(hol.reason) + ')</p>' : '')
        + '<p style="margin:0 0 6px;">উপস্থিত <b>' + bn(nPresent) + '</b>'
        + (c && c.late ? ' (দেরি <b>' + bn(nLate) + '</b>)' : '')
        + ' &nbsp; অনুপস্থিত <b>' + bn(nAbsent) + '</b> &nbsp; ছুটি <b>' + bn(nLeave) + '</b> &nbsp; হাজিরা নেই <b>' + bn(nNone) + '</b></p>'
        + rows;
    }).catch(e => {
      if (!el('taList')) return;
      box.innerHTML = '<p class="muted" style="color:#dc2626;">লোড করা যায়নি: ' + esc(errText(e)) + '</p><button class="small secondary" onclick="taLoadList()">আবার চেষ্টা করুন</button>';
      showDiagBanner('শিক্ষক হাজিরা তালিকা এরর: ' + (e.code || '') + ' ' + e.message);
    });
  }
  window.taLoadList = loadList;

  // উপস্থিত / অনুপস্থিত / ছুটি চিহ্নিত
  window.taMark = function (uid, status) {
    if (!myTeacherIsAdmin) return;
    const date = listDate();
    const t = (taTeachers || []).find(x => x.uid === uid);
    if (!t) return;
    const cur = taDayCache[uid];
    const ref = db.collection(COL).doc(uid + '_' + date);
    const base = { madrasaId, teacherUid: uid, teacherName: String(t.name).slice(0, 80), date, status, manual: true };

    if (status === 'present') {
      const v = prompt('আগমনের সময় লিখুন (২৪ ঘণ্টার হিসাবে, যেমন 08:15):', cur && cur.checkInAt ? toHM(cur.checkInAt) : '');
      if (v === null) return;
      const ts = parseHM(date, v);
      if (!ts) return alert('সময় সঠিক নয়। এভাবে লিখুন: 08:15');
      base.checkInAt = ts;
      ref.set(base, { merge: true }).then(loadList).catch(taFail);
      return;
    }
    if (cur && cur.checkInAt && !confirm('এই শিক্ষকের আগমন-প্রস্থানের সময় মুছে গিয়ে "' + (status === 'leave' ? 'ছুটি' : 'অনুপস্থিত') + '" হবে। এগিয়ে যাবেন?')) return;
    ref.set(base).then(loadList).catch(taFail); // পুরো রেকর্ড বদলে যায়
  };

  // আগমন ও প্রস্থানের সময় সম্পাদনা
  window.taEditTimes = function (uid) {
    if (!myTeacherIsAdmin) return;
    const date = listDate();
    const cur = taDayCache[uid];
    if (!cur || !cur.checkInAt) return alert('আগে "উপস্থিত" চিহ্নিত করুন');
    const inV = prompt('আগমনের সময় (২৪ ঘণ্টার হিসাবে, যেমন 08:15):', toHM(cur.checkInAt));
    if (inV === null) return;
    const outV = prompt('প্রস্থানের সময় (যেমন 14:30)। প্রস্থান না হয়ে থাকলে ফাঁকা রাখুন:', cur.checkOutAt ? toHM(cur.checkOutAt) : '');
    if (outV === null) return;
    const inTs = parseHM(date, inV);
    if (!inTs) return alert('আগমনের সময় সঠিক নয়। এভাবে লিখুন: 08:15');
    const upd = { checkInAt: inTs, manual: true };
    if (String(outV).trim() === '') {
      const del = firebase.firestore.FieldValue.delete();
      upd.checkOutAt = del; upd.checkOutLat = del; upd.checkOutLng = del; upd.checkOutDist = del; upd.checkOutAcc = del;
    } else {
      const outTs = parseHM(date, outV);
      if (!outTs) return alert('প্রস্থানের সময় সঠিক নয়। এভাবে লিখুন: 14:30');
      if (outTs.toMillis() < inTs.toMillis()) return alert('প্রস্থানের সময় আগমনের আগে হতে পারে না');
      upd.checkOutAt = outTs;
    }
    db.collection(COL).doc(uid + '_' + date).update(upd).then(loadList).catch(taFail);
  };

  window.taDelete = function (uid) {
    if (!myTeacherIsAdmin) return;
    if (!confirm('এই শিক্ষকের এই তারিখের হাজিরার রেকর্ড মুছে ফেলবেন?')) return;
    db.collection(COL).doc(uid + '_' + listDate()).delete().then(loadList).catch(taFail);
  };

  // ================= অ্যাডমিন: মাসিক রিপোর্ট =================
  // কার্যদিবস = আজ পর্যন্ত মাসের বন্ধের দিন বাদে সব দিন।
  // অনুপস্থিত = কার্যদিবস − উপস্থিত − ছুটি (হাজিরা না দিলেও অনুপস্থিত ধরা হয়; ভুল হলে অ্যাডমিন সংশোধন করবেন)।
  // প্রতিটি কার্যদিবসের জন্য একটি করে কোয়েরি, তাই নতুন কোনো Firestore ইনডেক্স লাগে না।
  let taMonthTok = 0;

  if (!el('taPrintStyle')) {
    const st = document.createElement('style');
    st.id = 'taPrintStyle';
    st.textContent = '@media print { body * { visibility: hidden !important; } #taReport, #taReport * { visibility: visible !important; } #taReport { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } .no-print { display: none !important; } }';
    document.head.appendChild(st);
  }

  window.taClearMonth = function () {
    taMonthTok++;
    const w = el('taMonthWrap');
    if (w) w.innerHTML = '';
  };

  function fmtAvg(min) {
    return new Date(2000, 0, 1, Math.floor(min / 60), Math.round(min % 60)).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  window.taLoadMonth = function () {
    const wrap = el('taMonthWrap');
    if (!wrap || !myTeacherIsAdmin) return;
    const month = (el('taMonth') || {}).value;
    if (!/^\d{4}-\d{2}$/.test(month)) { wrap.innerHTML = '<div class="card"><p class="muted">মাস বাছাই করুন</p></div>'; return; }

    const tok = ++taMonthTok;
    wrap.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে...</p></div>';

    const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = todayLocal();
    const dates = [];
    let holCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = month + '-' + String(d).padStart(2, '0');
      if (ds > today) break;
      if (typeof holidayInfo === 'function' && holidayInfo(ds)) holCount++;
      else dates.push(ds);
    }
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' });
    if (!dates.length) {
      wrap.innerHTML = '<div class="card"><p class="muted">' + (holCount ? 'এই মাসে এখন পর্যন্ত সব দিনই বন্ধ ছিল' : 'এই মাস এখনো শুরু হয়নি') + '</p></div>';
      return;
    }

    const c = cfg();
    Promise.all([
      teacherList(),
      Promise.all(dates.map(ds => db.collection(COL).where('madrasaId', '==', madrasaId).where('date', '==', ds).get()))
    ]).then(res => {
      if (tok !== taMonthTok || !el('taMonthWrap')) return;
      const list = res[0];
      if (!list.length) { wrap.innerHTML = '<div class="card"><p class="muted">কোনো সক্রিয় শিক্ষক পাওয়া যায়নি</p></div>'; return; }

      const st = {};
      list.forEach(t => { st[t.uid] = { p: 0, late: 0, leave: 0, sumMin: 0 }; });
      res[1].forEach(snap => snap.docs.forEach(doc => {
        const x = doc.data();
        const r = st[x.teacherUid];
        if (!r) return;
        if (x.checkInAt) {
          r.p++;
          const d = x.checkInAt.toDate();
          r.sumMin += d.getHours() * 60 + d.getMinutes();
          if (c && c.late && isLate(x.checkInAt, c.late)) r.late++;
        } else if (x.status === 'leave') {
          r.leave++;
        }
      }));

      const inst = (appSettings && appSettings.madrasaName) ? appSettings.madrasaName : '';
      let totP = 0, totA = 0;
      const rows = list.map(t => {
        const r = st[t.uid];
        const absent = Math.max(0, dates.length - r.p - r.leave);
        totP += r.p; totA += absent;
        const cell = 'padding:6px;border:1px solid #ddd;text-align:center;';
        return `
          <tr>
            <td style="padding:6px;border:1px solid #ddd;">${esc(t.name)}</td>
            <td style="${cell}">${bn(r.p)}</td>
            <td style="${cell}">${c && c.late ? bn(r.late) : '-'}</td>
            <td style="${cell}${absent ? 'color:#b91c1c;font-weight:bold;' : ''}">${bn(absent)}</td>
            <td style="${cell}">${bn(r.leave)}</td>
            <td style="${cell}">${r.p ? esc(fmtAvg(r.sumMin / r.p)) : '-'}</td>
          </tr>`;
      }).join('');

      wrap.innerHTML = `
        <div class="card" id="taReport">
          <h2 style="text-align:center;margin-bottom:2px;">শিক্ষকদের মাসিক হাজিরা রিপোর্ট</h2>
          <p class="muted" style="text-align:center;margin:0;">${inst ? esc(inst) + ' | ' : ''}${esc(monthLabel)}</p>
          <p style="text-align:center;margin:6px 0;">কার্যদিবস: <b>${bn(dates.length)}</b>${holCount ? ' &nbsp; বন্ধের দিন: <b>' + bn(holCount) + '</b>' : ''} &nbsp; শিক্ষক: <b>${bn(list.length)}</b> জন</p>
          ${c && c.late ? '<p class="muted" style="text-align:center;font-size:12px;margin:0 0 6px;">দেরির সময়: ' + esc(bn(c.late)) + ' এর পরে আগমন</p>' : ''}
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;margin-top:8px;">
              <thead>
                <tr>
                  <th style="padding:6px;border:1px solid #ddd;">শিক্ষক</th>
                  <th style="padding:6px;border:1px solid #ddd;">উপস্থিত</th>
                  <th style="padding:6px;border:1px solid #ddd;">দেরি</th>
                  <th style="padding:6px;border:1px solid #ddd;">অনুপস্থিত</th>
                  <th style="padding:6px;border:1px solid #ddd;">ছুটি</th>
                  <th style="padding:6px;border:1px solid #ddd;">গড় আগমন</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p class="muted" style="font-size:12px;margin-top:8px;">অনুপস্থিত = কার্যদিবস − উপস্থিত − ছুটি। হাজিরা না দিলে অনুপস্থিত ধরা হয়। বন্ধের দিন কার্যদিবসে ধরা হয়নি।</p>
          <div class="no-print" style="margin-top:12px;text-align:center;">
            <button onclick="window.print()">🖨️ প্রিন্ট করুন</button>
          </div>
        </div>`;
    }).catch(e => {
      if (tok !== taMonthTok || !el('taMonthWrap')) return;
      wrap.innerHTML = '<div class="card"><p class="muted" style="color:#dc2626;">লোড করা যায়নি: ' + esc(errText(e)) + '</p><button class="small secondary" onclick="taLoadMonth()">আবার চেষ্টা করুন</button></div>';
      showDiagBanner('শিক্ষক মাসিক রিপোর্ট এরর: ' + (e.code || '') + ' ' + e.message);
    });
  };

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
