ShikkhaOS - পরীক্ষার রুটিন ফিচার

এই zip-এ আছে:
  exam-routine.js  - নতুন ফিচার
  firestore.rules  - আপনার বর্তমান রুলস + নতুন examRoutines ব্লক (আর কিছু বদলায়নি)

ধাপ ১: exam-routine.js GitHub রিপোর রুটে আপলোড করুন (index.html-এর পাশে)।

ধাপ ২: index.html-এ homework.js এর ঠিক নিচে এই লাইনটি যোগ করুন:
   <script src="exam-routine.js"></script>

ধাপ ৩: Firebase Console > Firestore Database > Rules-এ গিয়ে পুরোনো রুলস মুছে
   firestore.rules ফাইলের সব লেখা পেস্ট করুন, তারপর Publish করুন।

ধাপ ৪: service-worker.js-এ ফাইলের তালিকা থাকলে exam-routine.js যোগ করুন
   এবং CACHE_NAME এর ভার্সন বাড়ান।

নতুন Firestore index লাগবে না।
