ShikkhaOS আপডেট: প্রশ্ন-উত্তর বক্স (শ্রেণির জন্য প্রকাশসহ) + রিড কমানো

ফাইল চারটি:
  qa.js              — প্রশ্ন-উত্তর বক্স (ব্যাজ + "শ্রেণির জন্য প্রকাশ" সহ)
  reads-cut.js       — রিড কমানোর স্তর
  firestore.rules    — questions ও public_qa ব্লকসহ পুরো রুলস ফাইল
  service-worker.js  — CACHE_NAME v54, নতুন ফাইল যোগ

আপলোডের ক্রম:
১) Firebase Console → Firestore → Rules: firestore.rules এর পুরো লেখা পেস্ট করে Publish করুন
   (public_qa এর পড়ার নিয়ম বদলেছে: শিক্ষার্থী শুধু নিজের শ্রেণির প্রকাশিত প্রশ্নোত্তর পড়বে)
২) GitHub রিপোর root-এ qa.js ও reads-cut.js আপলোড করুন (qa.js পুরোনোটার ওপর বদলান)
৩) index.html এ লাইন দুটি আছে কিনা দেখুন:
     <script defer src="qa.js"></script>
     <script defer src="reads-cut.js"></script>
৪) সবার শেষে service-worker.js আপলোড করুন
৫) অ্যাপ বন্ধ করে আবার খুলুন

ইনডেক্স (Firebase Console → Firestore → Indexes → Composite):
  questions   : madrasaId (Ascending) + createdAt (Descending)                      — আগেই তৈরি
  attendance  : studentId (Ascending) + date (Ascending)                            — শিক্ষার্থীর উপস্থিতির রিড কমাতে
  public_qa   : madrasaId (Ascending) + className (Ascending) + answeredAt (Descending) — "শ্রেণির প্রশ্নোত্তর" তালিকার জন্য
  (attendance ও public_qa এর ইনডেক্স না থাকলেও অ্যাপ ঠিক চলে)

শ্রেণির জন্য প্রকাশ: শিক্ষক উত্তর দেওয়া প্রশ্নে "শ্রেণির জন্য প্রকাশ করুন" চাপলে শিক্ষার্থীর নাম ছাড়া প্রশ্ন ও উত্তর
শুধু ওই শ্রেণির শিক্ষার্থীরা "শ্রেণির প্রশ্নোত্তর" ট্যাবে দেখতে পায়। "প্রকাশ বন্ধ করুন" চাপলে আর দেখায় না।
