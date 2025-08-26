// firebase.js
import { getAnalytics, isSupported } from "firebase/analytics"; // Import isSupported
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCS7ahQ5cZXYwqgwmk4X8dDnnY8oszctsg",
  authDomain: "childwatch-91999.firebaseapp.com",
  databaseURL: "https://childwatch-91999-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "childwatch-91999",
  storageBucket: "childwatch-91999.firebasestorage.app",
  messagingSenderId: "358831250212",
  appId: "1:358831250212:web:2e725a779c974ab84771b1",
  measurementId: "G-WEXSZ672KJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only if supported)
let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
    console.log("Firebase Analytics initialized");
  } else {
    console.warn("Firebase Analytics is not supported in this environment.");
  }
}).catch((error) => {
  console.error("Error checking Firebase Analytics support:", error);
});

// Initialize Realtime Database
const db = getDatabase(app);

export { db, analytics };
