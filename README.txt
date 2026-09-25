পরিবর্তনের সারাংশ
==================

ফাইল: firestore.rules

কী পরিবর্তন হয়েছে:
- শুধু students/{studentId} অংশের "allow read" লাইনে পরিবর্তন হয়েছে।
- এখন থেকে একজন শিক্ষক (isTeacherAuth) students collection পড়তে গেলে
  বাধ্যতামূলকভাবে নিজের madrasaId মিলতে হবে। ফলে কোনো শিক্ষক অ্যাকাউন্ট দিয়ে
  সরাসরি ডেটাবেজ query করে অন্য মাদ্রাসার ছাত্র তালিকা (নাম/রোল/ক্লাস) আর
  টেনে আনা যাবে না।
- ছাত্র/anonymous auth দিয়ে পড়া আগের মতোই খোলা রাখা হয়েছে, কারণ
  "ক্লাস বেছে নাও তারপর নাম" লগইন picker স্ক্রিনটা session তৈরি হওয়ার
  আগেই এই collection পড়ে — তাই এটা বন্ধ করলে ছাত্রদের লগইন ভেঙে যেত।
  এই অংশ পুরোপুরি বন্ধ করতে custom auth claims (Firebase Blaze plan)
  লাগবে, যা আগে থেকেই ভবিষ্যতের কাজ হিসেবে রাখা আছে।
- create/update/delete rule অপরিবর্তিত।

করণীয়:
1. এই firestore.rules ফাইলটা আপনার GitHub repo-তে পুরনো ফাইলের জায়গায় আপলোড করুন।
2. Firebase Console থেকে (অথবা firebase deploy --only firestore:rules দিয়ে)
   নতুন rules publish করুন।
3. শিক্ষক ও ছাত্র উভয় লগইন স্বাভাবিকভাবে আগের মতোই কাজ করবে।
