এডমিট কার্ড সেটিংস সব ডিভাইসে একই রাখার আপডেট

ফাইল (তিনটিই GitHub-এ আগের ফাইলের উপর আপলোড করুন):
1. admit-card.js     — সেটিংস এখন Firestore-এ (admit_settings/{মাদ্রাসার আইডি}) জমা হয়
2. service-worker.js — CACHE_NAME v81 থেকে v82
3. firestore.rules   — নতুন admit_settings ব্লক যুক্ত (Firebase Console > Firestore > Rules-এ পুরোটা বসিয়ে Publish করুন)

নিয়ম: আগে rules Publish করুন, তারপর GitHub-এ ফাইল আপলোড করুন।
প্রথমবার: ফোনে একবার "এডমিট কার্ড" ট্যাব খুলুন (সেভ করা সেটিংস নিজে সার্ভারে চলে যাবে)। তারপর কম্পিউটারে রিফ্রেশ করে খুলুন।
