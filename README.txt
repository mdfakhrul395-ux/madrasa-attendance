এডমিট কার্ড প্রিন্ট ফিক্স (কম্পিউটারে প্রিন্ট/PDF বাটন)

১) এই zip-এর admit-card.js GitHub-এ আগের admit-card.js-এর জায়গায় আপলোড করুন (replace)।
২) service-worker.js-এর CACHE_NAME এক ধাপ বাড়ান (যেমন v60 -> v61), নাহলে পুরোনো ফাইল চলবে।
৩) কম্পিউটারে অ্যাপ খুলে Ctrl + Shift + R চাপুন।
৪) এডমিট কার্ড পেজে শ্রেণি বেছে পরীক্ষার নাম লিখুন, তারপর "প্রিন্ট / PDF করুন" চাপুন।
   প্রিন্ট ডায়ালগে: A4, Landscape, Scale 100%, Background graphics টিক, Headers and footers টিক বাদ।

index.html বা অন্য কোনো ফাইল বদলাতে হবে না।
