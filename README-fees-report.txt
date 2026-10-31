আদায় রিপোর্ট (ধাপ ২: দৈনিক + মাসিক) — আপলোডের নিয়ম

ধাপ ১-এর fees-report.js আগে থেকেই আপলোড ও index.html-এ যোগ করা থাকলে নতুন কিছু যোগ করতে হবে না।
১) GitHub-এ আগের fees-report.js ফাইলটি এই নতুনটি দিয়ে বদলে দিন (Replace)।
২) service-worker.js-এর CACHE_NAME ভার্সন এক বাড়ান।
৩) অ্যাপ খুলে বেতন → "আদায় রিপোর্ট" → ওপরে "দৈনিক" / "মাসিক" বেছে নিন।

কোনো Firestore rules বদলাতে হবে না।
বন্ধ করতে: index.html থেকে <script src="fees-report.js"></script> লাইনটি মুছে দিন।
