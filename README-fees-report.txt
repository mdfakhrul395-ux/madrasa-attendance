দৈনিক আদায় রিপোর্ট (ধাপ ১) — আপলোডের নিয়ম

১) GitHub রিপোজিটরির রুটে fees-report.js ফাইলটি আপলোড করুন।
২) index.html-এ fees-quick.js লাইনের ঠিক পরে (সবার শেষ স্ক্রিপ্ট হিসেবে) এই লাইন যোগ করুন:
   <script src="fees-report.js"></script>
৩) service-worker.js-এ CACHE_NAME-এর ভার্সন নম্বর এক বাড়ান (এবং ফাইল-তালিকা থাকলে তাতে fees-report.js যোগ করুন)।
৪) অ্যাপ খুলে বেতন → "আদায় রিপোর্ট" চাপুন।

কোনো Firestore rules বদলাতে হবে না।
বন্ধ করতে: index.html থেকে ওই লাইনটি মুছে দিন।
