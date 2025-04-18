// Import necessary Firebase services
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDUK0HY6MAFMh_4QoinLFjyc91p2Ds65XA",
  authDomain: "sharepostapp-b04c4.firebaseapp.com",
  projectId: "sharepostapp-b04c4",
  storageBucket: "sharepostapp-b04c4.firebasestorage.app",
  messagingSenderId: "739870970679",
  appId: "1:739870970679:web:3c877919d634b96e9740b2",
  measurementId: "G-MBXY84LFNZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);  // Authentication service
const db = getFirestore(app);  // Firestore database
const analytics = getAnalytics(app);  // Analytics (optional)

// You can now use `auth`, `db`, and `analytics` in your app
