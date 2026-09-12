মার্কশিট (রেজাল্ট) ডিলিট ফিক্স
================================

সমস্যা কী ছিল
-------------
"results" কালেকশনের rule-এ একটাই allow write ছিল যা request.resource.data
ব্যবহার করত। কিন্তু ডিলিট করার সময় request.resource সবসময় null থাকে —
তাই request.resource.data.madrasaId এক্সেস করতে গিয়ে পুরো rule fail করত
এবং "Missing or insufficient permissions" error আসত।

কী পরিবর্তন করা হয়েছে
----------------------
শুধু "results" অংশটা ভাগ করা হয়েছে:
- allow create, update  → request.resource.data দিয়ে চেক (আগের মতোই)
- allow delete          → resource.data দিয়ে চেক (নতুন, শুধু ডিলিটের জন্য)

app.js-এ কোনো পরিবর্তন লাগেনি। শুধু firestore.rules আপডেট হয়েছে।

কীভাবে পাবলিশ করবেন
--------------------
1. Firebase Console-এ যান → আপনার প্রজেক্ট (madrasah-attendance-117b9)
2. বাম পাশের মেনু থেকে Firestore Database → Rules ট্যাব
3. এই ফোল্ডারের firestore.rules ফাইলের পুরো কনটেন্ট কপি করুন
4. Rules এডিটরে থাকা পুরনো কনটেন্ট মুছে নতুন কনটেন্ট পেস্ট করুন
5. উপরে ডান দিকে "Publish" বাটনে চাপুন

পরীক্ষা করুন
-------------
পাবলিশ হওয়ার পর অ্যাপে গিয়ে যেকোনো মার্কশিটের পাশে "মুছুন" বাটনে চাপুন —
এবার সেটা সফলভাবে ডিলিট হয়ে যাওয়ার কথা, আর লাল error banner আসবে না।
