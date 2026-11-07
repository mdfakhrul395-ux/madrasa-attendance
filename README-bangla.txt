রিড কমানোর স্তর — reads-cut.js

১) reads-cut.js রিপোর root-এ আপলোড করুন।
২) index.html এ reads-saver.js এর লাইনের ঠিক নিচে (icons.js এর আগে) যোগ করুন:
     <script defer src="reads-cut.js"></script>
৩) service-worker.js এ ফাইলের তালিকা থাকলে 'reads-cut.js' যোগ করুন এবং CACHE_NAME এক বাড়ান।
৪) (একবার, শিক্ষার্থীর উপস্থিতি হালকা করার জন্য) Firebase Console → Firestore → Indexes → Composite → Create index:
     Collection ID: attendance
     Field 1: studentId — Ascending
     Field 2: date — Ascending
     Query scope: Collection
   ইনডেক্স "Enabled" না হওয়া পর্যন্ত অ্যাপ নিজে থেকে আগের কোয়েরিতে চলবে, কিছু ভাঙবে না।

কোনো সমস্যা হলে index.html থেকে reads-cut.js এর লাইনটি মুছে দিলেই আগের অবস্থায় ফিরে যাবে।

যা বদলায় না: শিক্ষকের তালিকা পাতাগুলো (ছুটি, ডায়েরি, বেতন ইত্যাদি), রেজাল্ট ও মেধাক্রম হিসাব — হুবহু আগের মতো।
