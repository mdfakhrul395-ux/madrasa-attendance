ছুটির আবেদনের ফরম্যাট ঠিক করার আপডেট
1. leave-format.js ফাইলটি GitHub রিপোজিটরির মূল ফোল্ডারে (index.html এর পাশে) আপলোড করুন।
2. index.html এ dashboard.js এর লাইনের ঠিক নিচে এই লাইন যোগ করুন:
   <script src="leave-format.js"></script>
3. service-worker.js এর CACHE_NAME এর ভার্সন একটি বাড়ান। ফাইল ক্যাশের তালিকা থাকলে তাতেও "./leave-format.js" যোগ করুন।
