ShikkhaOS - পিতার নাম ও মাতার নাম (ধাপ ১ + মার্কশিট/রিপোর্ট)

১) parent-names.js GitHub repo-তে আপলোড করুন (পুরনো থাকলে প্রতিস্থাপন করুন)।
২) index.html-এ সবার শেষে (final-result.js / ui-polish.js এর পরে) যোগ করুন:
   <script src="parent-names.js"></script>
৩) Firestore rules-এ student_contacts ব্লকে নতুন allow update লাইনটি যোগ করুন
   (firestore-rules-snippet.txt দেখুন), তারপর Publish করুন।
৪) service-worker.js-এর CACHE_NAME-এর সংস্করণ বাড়াতে ভুলবেন না।
