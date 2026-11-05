ShikkhaOS - শিক্ষার্থীর ছবি (শুধু অ্যাডমিন যোগ/দেখতে পারবে, শিক্ষার্থী নিজের ছবি দেখবে)

১) student-photo.js GitHub repo-তে আপলোড করুন।
২) index.html-এ parent-names.js এর নিচে যোগ করুন:
   <script defer src="student-photo.js"></script>
৩) firestore.rules ফাইলটি প্রতিস্থাপন করুন (এতে আগের পিতা-মাতার নামের rules-ও আছে) এবং Publish করুন।
   নতুন অংশ: match /student_photos/{studentId} ব্লক।
৪) service-worker.js-এর CACHE_NAME-এর সংস্করণ বাড়ান এবং ফাইল তালিকায় student-photo.js থাকলে যোগ করুন।

ব্যবহার: অ্যাডমিন > শিক্ষার্থী ট্যাব > শিক্ষার্থীর সারিতে "📷 ছবি" > ছবি তুলুন/বাছুন > সংরক্ষণ করুন।
