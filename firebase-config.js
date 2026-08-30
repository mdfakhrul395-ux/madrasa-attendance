// ==========================================================
// এখানে আপনার Firebase প্রজেক্টের config বসান
// Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
// ==========================================================
const firebaseConfig = {
  apiKey: "AIzaSyC3zTM6hab8LRyj_noG6_-MpfsgUIWtPF0",
  authDomain: "madrasah-attendance-117b9.firebaseapp.com",
  projectId: "madrasah-attendance-117b9",
  storageBucket: "madrasah-attendance-117b9.firebasestorage.app",
  messagingSenderId: "40894975816",
  appId: "1:40894975816:web:52eea5afb845dc908e2d7d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
