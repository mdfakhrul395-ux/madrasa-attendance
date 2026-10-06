নোটিশ "মুছুন" বাটন ফিক্স
==========================

কারণ: firestore.rules-এ notices-এর "allow write" ডিলিটের সময় request.resource ব্যবহার করত,
যা ডিলিটে থাকে না — তাই ডিলিট ব্লক হতো। এখন create/update ও delete আলাদা করা হয়েছে।

ধাপ ১ (জরুরি): নিয়ম পাবলিশ
  1. Firebase Console -> Firestore Database -> Rules
  2. এই zip-এর firestore.rules ফাইলের পুরো লেখা কপি করে আগের লেখার জায়গায় বসান
  3. "Publish" চাপুন
  4. অ্যাপ রিফ্রেশ করে নোটিশ মুছে দেখুন

ধাপ ২ (ঐচ্ছিক): app.js-এ এরর দেখানো
  app.js-এ deleteNotice ফাংশনটি খুঁজে এভাবে বদলান:

  function deleteNotice(id) {
    if (!confirm('এই নোটিশ মুছতে চান?')) return;
    db.collection('notices').doc(id).delete()
      .catch(e => { alert('মুছতে ব্যর্থ: ' + e.message); showDiagBanner('নোটিশ মুছতে ব্যর্থ: ' + e.message); });
  }

  (এটা করলে service-worker.js-এর CACHE_NAME-এর ভার্সন বাড়াতে ভুলবেন না।)
