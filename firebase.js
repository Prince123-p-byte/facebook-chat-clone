import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  GithubAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import { getMessaging, onMessage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUK0HY6MAFMh_4QoinLFjyc91p2Ds65XA",
  authDomain: "sharepostapp-b04c4.firebaseapp.com",
  projectId: "sharepostapp-b04c4",
  storageBucket: "sharepostapp-b04c4.appspot.com",
  messagingSenderId: "739870970679",
  appId: "1:739870970679:web:3c877919d634b96e9740b2",
  measurementId: "G-MBXY84LFNZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);

// Auth Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const githubProvider = new GithubAuthProvider();

// Handle incoming messages
onMessage(messaging, (payload) => {
  console.log('Message received. ', payload);
  const { title, body } = payload.notification;
  showToast(`${title}: ${body}`);
});

export { 
  auth, 
  db, 
  storage, 
  messaging,
  googleProvider,
  facebookProvider,
  githubProvider
};