ShikkhaOS - পিতার নাম ও মাতার নাম (যোগ করা + তালিকা + মার্কশিট + মাসিক রিপোর্ট + সম্পাদনা)

১) parent-names.js GitHub repo-তে আপলোড করুন (পুরনো থাকলে প্রতিস্থাপন করুন)।
২) index.html-এ সবার শেষে (final-result.js / ui-polish.js এর পরে) যোগ করুন (আগে না করে থাকলে):
   <script src="parent-names.js"></script>
৩) firestore.rules ফাইলটি প্রতিস্থাপন করুন (বা Firebase Console > Firestore > Rules-এ পুরো লেখা পেস্ট করুন) এবং Publish করুন।
   শুধু student_contacts ব্লকে একটি নতুন allow update লাইন যোগ হয়েছে, বাকি সব আগের মতোই।
৪) service-worker.js-এর CACHE_NAME-এর সংস্করণ বাড়াতে ভুলবেন না।
৫) parent-names.js অবশ্যই student-edit.js এর পরে লোড হতে হবে (index.html-এ সবার শেষে রাখলে ঠিক থাকবে)। এতে অ্যাডমিনের ✏️ সম্পাদনা ফর্মে পিতা-মাতার নাম বদলানো যাবে।
