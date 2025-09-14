// firebase.js
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

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

let analytics;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.log("Analytics not available in this environment");
}

const db = getDatabase(app);
const auth = getAuth(app);

export { db, analytics, auth };
