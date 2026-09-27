// usage-tracker.js
// স্বাধীন patch script — Firestore-এর reads/writes/deletes আনুমানিকভাবে গুনে রাখে
// এবং সুপার-অ্যাডমিনের জন্য একটা ফ্লোটিং বাটনে (📊) আজকের ব্যবহার দেখায়।
//
// গুরুত্বপূর্ণ: index.html-এ এই স্ক্রিপ্টটা firebase-config.js এর ঠিক পরে,
// কিন্তু app.js/dashboard.js এর আগে লোড করবেন — যাতে শুরু থেকেই সব read/write গোনা যায়।
// <script src="firebase-config.js"></script>
// <script src="usage-tracker.js"></script>   <-- এখানে
// <script src="app.js"></script>
// ...

(function () {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('usage-tracker: firebase not found, skipping');
    return;
  }

  var LIMITS = { reads: 50000, writes: 20000, deletes: 20000 };
  var SUPER_ADMIN_EMAIL = 'mdfakhrul395@gmail.com';

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // এই ডিভাইসে এখনো Firestore-এ পাঠানো হয়নি এমন হিসাব
  var pendingDelta = { reads: 0, writes: 0, deletes: 0, day: todayKey() };

  function bump(type, n) {
    n = n || 1;
    if (pendingDelta.day !== todayKey()) {
      pendingDelta = { reads: 0, writes: 0, deletes: 0, day: todayKey() };
    }
    pendingDelta[type] += n;
  }

  function syncToFirestore() {
    if (!pendingDelta.reads && !pendingDelta.writes && !pendingDelta.deletes) return;
    var delta = { reads: pendingDelta.reads, writes: pendingDelta.writes, deletes: pendingDelta.deletes };
    var day = pendingDelta.day;
    pendingDelta.reads = 0; pendingDelta.writes = 0; pendingDelta.deletes = 0;

    var db = firebase.firestore();
    var inc = firebase.firestore.FieldValue.increment;
    db.collection('usage_stats').doc(day).set({
      reads: inc(delta.reads),
      writes: inc(delta.writes),
      deletes: inc(delta.deletes),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function (err) {
      // ব্যর্থ হলে পরের বার আবার চেষ্টা করার জন্য ফেরত রাখা
      pendingDelta.reads += delta.reads;
      pendingDelta.writes += delta.writes;
      pendingDelta.deletes += delta.deletes;
      console.warn('usage-tracker sync failed', err);
    });
  }

  setInterval(syncToFirestore, 30000); // প্রতি ৩০ সেকেন্ডে সিঙ্ক
  window.addEventListener('beforeunload', syncToFirestore);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') syncToFirestore();
  });

  // ---------- Firestore মেথড patch ----------
  var QP = firebase.firestore.Query.prototype;           // CollectionReference এটা extend করে
  var DRP = firebase.firestore.DocumentReference.prototype;
  var CRP = firebase.firestore.CollectionReference.prototype;

  var origQueryGet = QP.get;
  QP.get = function () {
    return origQueryGet.apply(this, arguments).then(function (snap) {
      bump('reads', snap.size || 0);
      return snap;
    });
  };

  var origQuerySnapshot = QP.onSnapshot;
  QP.onSnapshot = function () {
    var args = Array.prototype.slice.call(arguments);
    var cbIndex = -1;
    for (var i = 0; i < args.length; i++) { if (typeof args[i] === 'function') { cbIndex = i; break; } }
    if (cbIndex === -1) return origQuerySnapshot.apply(this, args);
    var originalCb = args[cbIndex];
    args[cbIndex] = function (snap) {
      var changes = snap.docChanges ? snap.docChanges() : [];
      bump('reads', changes.length || snap.size || 0);
      return originalCb.apply(this, arguments);
    };
    return origQuerySnapshot.apply(this, args);
  };

  var origDocGet = DRP.get;
  DRP.get = function () {
    return origDocGet.apply(this, arguments).then(function (snap) {
      bump('reads', 1);
      return snap;
    });
  };

  var origDocSnapshot = DRP.onSnapshot;
  DRP.onSnapshot = function () {
    var args = Array.prototype.slice.call(arguments);
    var cbIndex = -1;
    for (var i = 0; i < args.length; i++) { if (typeof args[i] === 'function') { cbIndex = i; break; } }
    if (cbIndex === -1) return origDocSnapshot.apply(this, args);
    var originalCb = args[cbIndex];
    args[cbIndex] = function (snap) {
      bump('reads', 1);
      return originalCb.apply(this, arguments);
    };
    return origDocSnapshot.apply(this, args);
  };

  ['set', 'update', 'delete'].forEach(function (method) {
    var orig = DRP[method];
    DRP[method] = function () {
      bump(method === 'delete' ? 'deletes' : 'writes', 1);
      return orig.apply(this, arguments);
    };
  });

  var origAdd = CRP.add;
  CRP.add = function () {
    bump('writes', 1);
    return origAdd.apply(this, arguments);
  };

  // ---------- সুপার-অ্যাডমিন ফ্লোটিং উইজেট ----------
  function isSuperAdmin() {
    try {
      return firebase.auth().currentUser && firebase.auth().currentUser.email === SUPER_ADMIN_EMAIL;
    } catch (e) { return false; }
  }

  function injectWidget() {
    if (document.getElementById('usageTrackerBtn')) return;
    if (!isSuperAdmin()) return;

    var btn = document.createElement('button');
    btn.id = 'usageTrackerBtn';
    btn.textContent = '📊';
    btn.title = 'ব্যবহারের হিসাব (Free Plan Limit)';
    btn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:9998;width:48px;height:48px;' +
      'border-radius:50%;border:none;background:#1d4ed8;color:#fff;font-size:20px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;';
    btn.onclick = openModal;
    document.body.appendChild(btn);
  }

  function openModal() {
    var modal = document.getElementById('usageTrackerModal');
    if (modal) { modal.style.display = 'flex'; return; }

    modal = document.createElement('div');
    modal.id = 'usageTrackerModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:20px;max-width:360px;width:100%;font-family:sans-serif;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<strong style="font-size:16px;">আজকের ব্যবহার (আনুমানিক)</strong>' +
      '<span id="usageTrackerClose" style="cursor:pointer;font-size:20px;">✕</span></div>' +
      '<div id="usageTrackerBars">লোড হচ্ছে...</div>' +
      '<p style="font-size:12px;color:#666;margin-top:12px;line-height:1.5;">' +
      'এই সংখ্যাগুলো অ্যাপ নিজে গুনে রাখে — Google-এর প্রকৃত বিলিং হিসাবের সাথে সামান্য পার্থক্য থাকতে পারে। ' +
      'সঠিক সংখ্যা যাচাই করতে Firebase Console → Usage and billing দেখুন।</p>' +
      '</div>';
    document.body.appendChild(modal);
    document.getElementById('usageTrackerClose').onclick = function () { modal.style.display = 'none'; };
    modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };

    var db = firebase.firestore();
    db.collection('usage_stats').doc(todayKey()).onSnapshot(function (doc) {
      renderBars(doc.exists ? doc.data() : {});
    }, function (err) {
      var el = document.getElementById('usageTrackerBars');
      if (el) el.textContent = 'ডেটা লোড করা যায়নি: ' + err.message;
    });
  }

  function renderBars(data) {
    var container = document.getElementById('usageTrackerBars');
    if (!container) return;
    var rows = [
      { label: 'Reads', key: 'reads', color: '#2563eb' },
      { label: 'Writes', key: 'writes', color: '#16a34a' },
      { label: 'Deletes', key: 'deletes', color: '#dc2626' }
    ];
    container.innerHTML = rows.map(function (r) {
      var synced = data[r.key] || 0;
      var unsynced = (pendingDelta.day === todayKey()) ? (pendingDelta[r.key] || 0) : 0;
      var used = synced + unsynced;
      var limit = LIMITS[r.key];
      var pct = Math.min(100, Math.round((used / limit) * 100));
      return '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">' +
        '<span>' + r.label + '</span><span>' + used.toLocaleString() + ' / ' + limit.toLocaleString() + '</span></div>' +
        '<div style="background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden;">' +
        '<div style="width:' + pct + '%;background:' + r.color + ';height:100%;"></div></div></div>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () { setTimeout(injectWidget, 1500); });
  if (firebase.auth) {
    firebase.auth().onAuthStateChanged(function () { setTimeout(injectWidget, 500); });
  }
})();
