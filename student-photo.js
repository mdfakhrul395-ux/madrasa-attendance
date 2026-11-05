/* ShikkhaOS — শিক্ষার্থীর ছবি
 *
 * index.html-এ সবার শেষে (parent-names.js এর পরে) লোড করুন:
 *   <script defer src="student-photo.js"></script>
 *
 * নিয়ম:
 *  - ছবি তোলা/বদলানো/মোছা: শুধু অ্যাডমিন শিক্ষক (শিক্ষার্থী তালিকার "📷 ছবি" বাটন)
 *  - ছবি দেখা: অ্যাডমিন এবং শিক্ষার্থী নিজে (শুধু নিজের ছবি, হোম পাতার গোল চিহ্নে)
 *  - শ্রেণি শিক্ষক বা অন্য কোনো শিক্ষক দেখতে পারবেন না (firestore.rules-এও আটকানো)
 *  - ছবি students কালেকশনে নয়, সুরক্ষিত student_photos কালেকশনে জমা হয়
 *  - ফোনেই ছবি ১৯২×১৯২ বর্গাকারে ছোট করে JPEG বানানো হয় (প্রায় ১০–২০KB)
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || typeof renderStudentsList !== 'function') {
    console.error('[student-photo] app.js ও বাকি প্যাচ ফাইলের নিচে এই ফাইলটি লোড করুন।');
    return;
  }

  const isAdmin = () => typeof myTeacherIsAdmin !== 'undefined' && myTeacherIsAdmin === true;
  const JPEG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  const okPhoto = p => typeof p === 'string' && p.length < 80000 && JPEG_RE.test(p);
  const cacheKey = id => 'stuPhoto_' + id;

  // ================= শিক্ষার্থীর হোম পাতার গোল চিহ্ন =================
  function paint(elm, p) {
    if (!elm) return;
    if (p && okPhoto(p)) {
      elm.style.backgroundImage = 'url("' + p + '")';
      elm.style.backgroundSize = 'cover';
      elm.style.backgroundPosition = 'center';
      elm.style.color = 'transparent'; // ভেতরের অক্ষর লুকানো (ড্যাশবোর্ড অক্ষর বসালেও ছবিই দেখা যায়)
    } else {
      elm.style.backgroundImage = '';
      elm.style.color = '';
    }
  }

  function applyStudentPhoto(elm) {
    elm.dataset.ph = '1';
    const id = myStudentId;
    let cached = null;
    try { cached = localStorage.getItem(cacheKey(id)); } catch (e) { /* ignore */ }
    if (cached) paint(elm, cached);
    db.collection('student_photos').doc(id).get().then(doc => {
      const p = doc.exists ? doc.data().photo : null;
      if (p && okPhoto(p)) {
        if (p !== cached) { try { localStorage.setItem(cacheKey(id), p); } catch (e) { /* ignore */ } }
        paint(elm, p);
      } else {
        try { localStorage.removeItem(cacheKey(id)); } catch (e) { /* ignore */ }
        paint(elm, null);
      }
    }).catch(() => { /* ছবি না এলে অক্ষরই থাকবে */ });
  }

  function scan() {
    if (typeof role === 'undefined' || role !== 'student' || typeof myStudentId === 'undefined' || !myStudentId) return;
    const a = document.getElementById('sdAvatar');
    if (a && !a.dataset.ph) applyStudentPhoto(a);
  }

  const appEl = document.getElementById('app');
  if (appEl && typeof MutationObserver !== 'undefined') {
    new MutationObserver(scan).observe(appEl, { childList: true, subtree: true });
  }

  // লগ-আউটে এই ডিভাইস থেকে ছবির কপি মুছে ফেলা
  if (typeof window.logout === 'function') {
    const prevLogout = window.logout;
    window.logout = function () {
      try { if (typeof myStudentId !== 'undefined' && myStudentId) localStorage.removeItem(cacheKey(myStudentId)); } catch (e) { /* ignore */ }
      return prevLogout.apply(this, arguments);
    };
  }

  // ================= অ্যাডমিনের জন্য: ছবি তোলা/দেখা/মোছা =================
  function closeModal() {
    const m = document.getElementById('stuPhotoModal');
    if (m) m.remove();
  }

  // ছবি বর্গাকারে কেটে ১৯২×১৯২ JPEG বানায়
  function resizeToJpeg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const S = 192;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        const m = Math.min(img.width, img.height);
        g.fillStyle = '#fff';
        g.fillRect(0, 0, S, S);
        g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
        URL.revokeObjectURL(url);
        let q = 0.8;
        let d = c.toDataURL('image/jpeg', q);
        while (d.length > 60000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
        if (d.length > 70000) reject(new Error('ছবিটি অনেক বড়, অন্য ছবি বাছুন'));
        else resolve(d);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ছবিটি পড়া যায়নি')); };
      img.src = url;
    });
  }

  window.studentPhoto = function (id) {
    if (!isAdmin()) { alert('শিক্ষার্থীর ছবি যোগ বা দেখা শুধু অ্যাডমিন শিক্ষক করতে পারেন'); return; }
    const s = (typeof studentsCache !== 'undefined' ? studentsCache : []).find(x => x.id === id);
    if (!s) { alert('শিক্ষার্থী খুঁজে পাওয়া যায়নি'); return; }
    closeModal();

    const ov = document.createElement('div');
    ov.id = 'stuPhotoModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;';
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px 16px 24px;max-height:90vh;overflow-y:auto;text-align:center;';
    box.innerHTML = `
      <h2 style="margin-top:0;">শিক্ষার্থীর ছবি</h2>
      <div id="spName" class="muted"></div>
      <div id="spCircle" style="width:160px;height:160px;border-radius:50%;margin:12px auto;background:#e3f3f0;color:#0f766e;display:grid;place-items:center;font-size:56px;font-weight:800;background-size:cover;background-position:center;"></div>
      <p id="spMsg" class="muted" style="font-size:13px;">লোড হচ্ছে...</p>
      <input type="file" id="spFile" accept="image/*" style="display:none">
      <button id="spPick">📷 ছবি তুলুন / গ্যালারি থেকে বাছুন</button>
      <button id="spSave" style="display:none;margin-top:8px;">✅ ছবি সংরক্ষণ করুন</button>
      <button id="spDel" class="danger" style="display:none;margin-top:8px;">ছবি মুছুন</button>
      <button id="spClose" class="secondary" style="margin-top:8px;">বন্ধ করুন</button>`;
    ov.appendChild(box);
    document.body.appendChild(ov);

    const circle = document.getElementById('spCircle');
    const msg = document.getElementById('spMsg');
    const pickBtn = document.getElementById('spPick');
    const saveBtn = document.getElementById('spSave');
    const delBtn = document.getElementById('spDel');
    const fileEl = document.getElementById('spFile');
    document.getElementById('spName').textContent = s.name || '';
    const letter = Array.from(s.name || '?')[0];
    let pending = null;
    let hasPhoto = false;

    const show = p => {
      if (p && okPhoto(p)) { circle.textContent = ''; circle.style.backgroundImage = 'url("' + p + '")'; }
      else { circle.style.backgroundImage = ''; circle.textContent = letter; }
    };
    show(null);

    db.collection('student_photos').doc(id).get().then(doc => {
      const p = doc.exists ? doc.data().photo : null;
      hasPhoto = !!(p && okPhoto(p));
      show(p);
      msg.textContent = hasPhoto ? 'বর্তমান ছবি। বদলাতে নিচের বাটন চাপুন।' : 'এখনো কোনো ছবি নেই।';
      delBtn.style.display = hasPhoto ? '' : 'none';
    }).catch(e => {
      msg.textContent = 'ছবি লোড করা যায়নি: ' + e.message;
      if (typeof showDiagBanner === 'function') showDiagBanner('ছবি লোড ব্যর্থ: ' + (e.code || '') + ' ' + e.message);
    });

    document.getElementById('spClose').onclick = closeModal;
    pickBtn.onclick = () => fileEl.click();
    fileEl.onchange = () => {
      const f = fileEl.files && fileEl.files[0];
      if (!f) return;
      msg.textContent = 'ছবি তৈরি হচ্ছে...';
      resizeToJpeg(f).then(d => {
        pending = d;
        show(d);
        msg.textContent = 'নতুন ছবি দেখুন, ঠিক থাকলে "সংরক্ষণ করুন" চাপুন।';
        saveBtn.style.display = '';
      }).catch(e => { msg.textContent = e.message; });
    };
    saveBtn.onclick = () => {
      if (!pending) return;
      saveBtn.disabled = true; saveBtn.textContent = 'সংরক্ষণ হচ্ছে...';
      db.collection('student_photos').doc(id)
        .set({ madrasaId: madrasaId, photo: pending, updatedAt: Date.now() })
        .then(() => { alert('ছবি সংরক্ষণ করা হয়েছে'); closeModal(); })
        .catch(e => {
          saveBtn.disabled = false; saveBtn.textContent = '✅ ছবি সংরক্ষণ করুন';
          msg.textContent = 'সংরক্ষণ ব্যর্থ: ' + e.message;
          if (typeof showDiagBanner === 'function') showDiagBanner('ছবি সংরক্ষণ ব্যর্থ: ' + (e.code || '') + ' ' + e.message);
        });
    };
    delBtn.onclick = () => {
      if (!confirm('এই শিক্ষার্থীর ছবি মুছতে চান?')) return;
      db.collection('student_photos').doc(id).delete()
        .then(() => { alert('ছবি মুছে ফেলা হয়েছে'); closeModal(); })
        .catch(e => { msg.textContent = 'মুছতে ব্যর্থ: ' + e.message; });
    };
  };

  // তালিকায় শুধু অ্যাডমিনের জন্য "📷 ছবি" বাটন
  const prevList = window.renderStudentsList;
  window.renderStudentsList = function () {
    const r = prevList.apply(this, arguments);
    if (isAdmin()) {
      const wrap = document.getElementById('studentsListWrap');
      if (wrap) {
        wrap.querySelectorAll('button').forEach(b => {
          const oc = b.getAttribute('onclick') || '';
          if (/^setStudentPin\(/.test(oc) && !b.parentNode.querySelector('[data-photo-btn]')) {
            const nb = document.createElement('button');
            nb.className = 'small secondary';
            nb.setAttribute('data-photo-btn', '1');
            nb.textContent = '📷 ছবি';
            nb.setAttribute('onclick', oc.replace(/^setStudentPin/, 'studentPhoto'));
            b.parentNode.insertBefore(nb, b);
          }
        });
      }
    }
    return r;
  };

  // শিক্ষার্থী মুছে ফেললে তার ছবিও মুছে ফেলা (নিশ্চিতকরণের পর তালিকা থেকে সরে গেলে)
  if (typeof window.deleteStudent === 'function') {
    const prevDelete = window.deleteStudent;
    window.deleteStudent = function (id) {
      const r = prevDelete.apply(this, arguments);
      if (isAdmin()) {
        let tries = 0;
        const t = setInterval(() => {
          tries++;
          const still = (typeof studentsCache !== 'undefined' ? studentsCache : []).some(x => x.id === id);
          if (!still) {
            clearInterval(t);
            db.collection('student_photos').doc(id).delete().catch(() => { /* ছবি ছিল না */ });
          } else if (tries >= 10) clearInterval(t);
        }, 1000);
      }
      return r;
    };
  }
})();
