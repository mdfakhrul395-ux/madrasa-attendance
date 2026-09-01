# শিক্ষক লগইন আপডেট

এই zip-এ দুটো ফাইল আছে: **index.html** এবং **app.js**। এতে শিক্ষকের জন্য ইমেইল-পাসওয়ার্ড লগইন যোগ করা হয়েছে (নোটিশ ফিচারসহ)।

## ধাপ ১ — GitHub-এ দুটো ফাইল আপডেট করুন

### index.html
1. রিপোতে `index.html` ফাইলে ক্লিক করো
2. পেন্সিল (✏️ Edit) আইকনে ট্যাপ করো
3. পুরো পুরনো কনটেন্ট মুছে এই zip-এর `index.html`-এর কনটেন্ট পেস্ট করো
4. Commit changes

### app.js
একইভাবে `app.js` ফাইলটাও এই zip-এর `app.js` দিয়ে রিপ্লেস করো এবং Commit করো।

(দুটো ফাইল একসাথেও কমিট করতে পারো — GitHub-এ "Add file" → "Upload files"-এ গিয়ে দুটোই একসাথে ড্র্যাগ করলে)

## ধাপ ২ — Firestore Rules আপডেট করুন

Firebase Console → Firestore Database → Rules → Edit rules-এ গিয়ে বর্তমান rule-টা (যেটা সব কালেকশনের জন্য খোলা আছে) এভাবে বদলে দাও:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // শিক্ষার্থী, রেজাল্ট, নোটিশ — শুধু লগইন করা শিক্ষক লিখতে/মুছতে পারবে
    match /students/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /results/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /notices/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // উপস্থিতি ও ছুটি — ছাত্ররা লগইন ছাড়াই ব্যবহার করে, তাই খোলা থাকবে
    match /attendance/{id} {
      allow read, write: if true;
    }
    match /leaves/{id} {
      allow read, write: if true;
    }
  }
}
```

তারপর **Publish** চাপো।

## নতুন যা যোগ হলো

- শিক্ষক বাটনে চাপলে এখন ইমেইল-পাসওয়ার্ড দিয়ে লগইন করতে হবে (আগে তৈরি করা অ্যাকাউন্ট দিয়ে)
- ভুল ইমেইল/পাসওয়ার্ড দিলে বার্তা দেখাবে
- হোম আইকনে (🏠) চাপলে লগআউট হয়ে যাবে
- শিক্ষার্থী যোগ/মুছা, রেজাল্ট এন্ট্রি, নোটিশ পোস্ট/ডিলিট — এখন থেকে Firestore-এও লগইন ছাড়া করা যাবে না

## মনে রাখবেন

ছাত্রদের অংশে (উপস্থিতি, ছুটির আবেদন) এখনও কোনো লগইন লাগবে না — এগুলো আগের মতোই কাজ করবে।
