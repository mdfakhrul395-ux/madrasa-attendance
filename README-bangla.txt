ShikkhaOS আপডেট: প্রশ্ন-উত্তর বক্স + রিড কমানো

ফাইল চারটি:
  qa.js              — প্রশ্ন-উত্তর বক্স (শিক্ষার্থী ও শিক্ষক দুই পাশ, দুই ধরনের ব্যাজসহ)
  reads-cut.js       — রিড কমানোর স্তর
  firestore.rules    — questions ব্লকসহ পুরো রুলস ফাইল
  service-worker.js  — নতুন দুই ফাইল যোগ, CACHE_NAME v54

আপলোডের ক্রম:
১) Firebase Console → Firestore → Rules: firestore.rules এর পুরো লেখা পেস্ট করে Publish করুন
   (প্রশ্ন-উত্তর আগে থেকেই চালু থাকলে এটি আগেই করা হয়ে থাকবে)
২) GitHub রিপোর root-এ qa.js ও reads-cut.js আপলোড করুন
৩) index.html এ লাইন দুটি আছে কিনা দেখুন:
     <script defer src="qa.js"></script>          (exam-routine.js এর নিচে)
     <script defer src="reads-cut.js"></script>   (reads-saver.js এর নিচে, icons.js এর আগে)
৪) সবার শেষে service-worker.js আপলোড করুন
৫) অ্যাপ বন্ধ করে আবার খুলুন (প্রথমবার পুরোনো দেখালে আরেকবার)

ইনডেক্স (Firebase Console → Firestore → Indexes → Composite):
  questions   : madrasaId (Ascending) + createdAt (Descending)   — আগেই তৈরি করা হয়েছে
  attendance  : studentId (Ascending) + date (Ascending)         — নতুন, শিক্ষার্থীর উপস্থিতির রিড কমাতে
  (attendance এর ইনডেক্স না থাকলেও অ্যাপ ঠিক চলে, শুধু ওই অংশে রিড কমে না)

সমস্যা হলে: index.html থেকে reads-cut.js এর লাইন মুছলে রিড-কমানো বন্ধ হয়ে আগের অবস্থা ফিরবে।
