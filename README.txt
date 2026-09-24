মার্কশিট সংরক্ষণ ব্যর্থ — সমাধান
================================

সমস্যা: নতুন মার্কশিট সেভ করার সময় "Missing or insufficient permissions" আসছিল।
কারণ: results collection-এর read rule ডকুমেন্ট না থাকলে (resource == null) ফেইল করত।
সমাধান: firestore.rules-এ results ব্লকে get ও list আলাদা করে get-এ `resource == null` যোগ করা হয়েছে।
        app.js-এ কোনো বদল লাগবে না।

করণীয় (দুটো ধাপই জরুরি):
1. GitHub রিপোজিটরিতে পুরনো firestore.rules ফাইলটা এই ফাইল দিয়ে বদলান।
2. Firebase Console → Firestore Database → Rules ট্যাবে গিয়ে পুরো লেখা মুছে
   এই ফাইলের লেখা বসান, তারপর "Publish" চাপুন।
   (শুধু GitHub-এ বদলালে Firebase-এ পৌঁছায় না।)
3. অ্যাপ রিফ্রেশ করে নতুন মার্কশিট সেভ করে দেখুন।
