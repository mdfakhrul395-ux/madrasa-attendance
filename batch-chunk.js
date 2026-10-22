/* ShikkhaOS — batch-chunk.js
 *
 * সমস্যা: Firestore-এ একসাথে (batch) অনেক ডক লেখার সময় firestore.rules-এর ভেতরে মোট ২০টির বেশি
 * ডক দেখা (get/exists) যায় না। নিরাপত্তার জন্য rules প্রতিটি নতুন ডকের শিক্ষার্থী যাচাই করে,
 * তাই বড় ব্যাচ (যেমন পুরো শ্রেণির হাজিরা বা ফি) পুরোটাই বাতিল হয়ে যেত।
 *
 * সমাধান: এই ফাইল db.batch() কে এমনভাবে মুড়ে দেয় যে বড় ব্যাচ নিজে নিজে ১০টি করে ছোট ব্যাচে ভাগ
 * হয়ে পরপর যায়। app.js, fees-quick.js সহ কোনো ফাইলই বদলাতে হয় না, আর আগের সব ফাংশন
 * (সবাইকে উপস্থিত, সবাইকে পরিশোধিত, নতুন ফি চালু ইত্যাদি) আগের মতোই চলে।
 *
 * ১০টি বা তার কম লেখা থাকলে আগের মতোই একটি ব্যাচে যায় (সব হবে, নয়তো কিছুই না)।
 * ১০টির বেশি হলে ভাগ হয়: মাঝপথে নেটওয়ার্ক গেলে কিছু অংশ লেখা হতে পারে, আবার চাপলে বাকিটা হয়ে যায়।
 *
 * index.html এ এটি firebase-config.js এর ঠিক পরে এবং usage-tracker.js এর আগে লোড করুন।
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || typeof db.batch !== 'function') {
    console.error('[batch-chunk] firebase-config.js এর পরে এই ফাইলটি লোড করুন।');
    return;
  }
  if (db.__batchChunked) return;

  const CHUNK = 10;
  const realBatch = db.batch.bind(db);

  db.batch = function () {
    const ops = [];
    const api = {
      set: function (ref, data, options) { ops.push({ t: 'set', ref: ref, data: data, options: options }); return api; },
      update: function (ref) { ops.push({ t: 'update', ref: ref, args: Array.prototype.slice.call(arguments, 1) }); return api; },
      delete: function (ref) { ops.push({ t: 'delete', ref: ref }); return api; },
      commit: function () {
        if (ops.length === 0) return Promise.resolve();
        let chain = Promise.resolve();
        for (let i = 0; i < ops.length; i += CHUNK) {
          const part = ops.slice(i, i + CHUNK);
          chain = chain.then(function () {
            const b = realBatch();
            part.forEach(function (o) {
              if (o.t === 'set') {
                if (o.options !== undefined) b.set(o.ref, o.data, o.options); else b.set(o.ref, o.data);
              } else if (o.t === 'update') {
                b.update.apply(b, [o.ref].concat(o.args));
              } else {
                b.delete(o.ref);
              }
            });
            return b.commit();
          });
        }
        return chain;
      }
    };
    return api;
  };
  db.__batchChunked = true;
})();
