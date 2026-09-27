firestore.rules — permission-denied সমস্যার সমাধান
=====================================================

সমস্যা: ড্যাশবোর্ডের ৫টি অংশ (আজকের হাজিরা, ছুটি, বেতন, নোটিশ, মেধাতালিকা)
একসাথে "permission-denied: Missing or insufficient permissions" দেখাচ্ছিল।

কারণ: firestore.rules-এর myMadrasaId() ফাংশন isTeacherAuth() true পেলেই
শর্তহীনভাবে get(teachers/{uid}) চালাত। কিন্তু isTeacherAuth() নতুন/এখনো
ডকুমেন্ট তৈরি না হওয়া টিচারের জন্যও true রিটার্ন করতে পারে (!exists(...)
শাখা)। তখন সেই get() ব্যর্থ ডকুমেন্টে এরর থ্রো করত, আর Firestore পুরো
কোয়েরিটাই permission-denied হিসেবে বাতিল করত — এই এররটা attendance,
leaves, fees_monthly, notices, results — এই পাঁচটা কালেকশনেই দেখা দিত,
কারণ শুধু এদের রুলসেই myMadrasaId() ব্যবহার হয়েছে।

সমাধান: myMadrasaId() (এবং সাথে isMadrasaActive, mySessionStudentId,
myClassName, isRequesterAdmin) এখন get() করার আগে exists() দিয়ে
ডকুমেন্ট আছে কিনা যাচাই করে নেয়। ডকুমেন্ট না থাকলে এরর থ্রো না করে
শুধু null রিটার্ন করে — ফলে অনুমতি স্বাভাবিকভাবে "না" হয়, কিন্তু পুরো
কোয়েরি ভেঙে যায় না।

করণীয়:
1. এই firestore.rules ফাইলটি Firebase Console → Firestore Database →
   Rules ট্যাবে গিয়ে বর্তমান রুলসের জায়গায় বসিয়ে Publish করুন।
   (অথবা লোকাল রিপোতে ফাইলটি বদলে firebase deploy --only firestore:rules)
2. Publish করার পর অ্যাপটি রিফ্রেশ করে আবার লগইন করে দেখুন
   ড্যাশবোর্ডের ৫টি অংশ ঠিকমতো লোড হয় কিনা।
3. তারপরও একই এরর থাকলে: Firebase Console → Firestore Database →
   Data → teachers কালেকশনে গিয়ে আপনার লগইন করা অ্যাকাউন্টের uid
   দিয়ে ডকুমেন্ট আছে কিনা, এবং তাতে madrasaId ফিল্ড ঠিকমতো আছে কিনা
   দেখুন (uid Firebase Console → Authentication ট্যাব থেকে পাবেন)।
