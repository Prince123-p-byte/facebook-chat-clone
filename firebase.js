import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import { getMessaging, isSupported as isMessagingSupported } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js";
import { getPerformance } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-performance.js";

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

// Initialize Performance Monitoring
const perf = typeof window !== 'undefined' ? getPerformance(app) : null;

// Initialize providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const githubProvider = new GithubAuthProvider();

// Configure persistence
const setupPersistence = async () => {
  try {
    await enableIndexedDbPersistence(db, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    });
    console.log("Offline persistence enabled");
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn("Offline persistence can only be enabled in one tab at a time.");
    } else if (err.code === 'unimplemented') {
      console.warn("The current browser does not support offline persistence.");
    } else {
      console.error("Error enabling offline persistence:", err);
    }
  }
};

// Initialize messaging if supported
let messaging = null;
(async () => {
  if (await isMessagingSupported()) {
    messaging = getMessaging(app);
    console.log("Firebase Messaging supported");
  } else {
    console.warn("Firebase Messaging not supported in this browser");
  }
})();

// Add scope for providers
googleProvider.addScope('profile');
googleProvider.addScope('email');
facebookProvider.addScope('public_profile');
facebookProvider.addScope('email');
githubProvider.addScope('user:email');

// Auth state observer
const onAuthChanged = (callback) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in
      callback(user);
    } else {
      // User is signed out
      callback(null);
    }
  });
};

// Enhanced error handling for auth
const handleAuthError = (error) => {
  let errorMessage = "An error occurred during authentication.";
  
  switch (error.code) {
    case 'auth/popup-closed-by-user':
      errorMessage = "The sign-in popup was closed before completing.";
      break;
    case 'auth/cancelled-popup-request':
      errorMessage = "Only one sign-in popup can be shown at a time.";
      break;
    case 'auth/account-exists-with-different-credential':
      errorMessage = "An account already exists with a different credential.";
      break;
    case 'auth/email-already-in-use':
      errorMessage = "The email address is already in use.";
      break;
    case 'auth/operation-not-allowed':
      errorMessage = "This operation is not allowed.";
      break;
    case 'auth/weak-password':
      errorMessage = "The password is too weak.";
      break;
    case 'auth/invalid-email':
      errorMessage = "The email address is invalid.";
      break;
    case 'auth/user-disabled':
      errorMessage = "This user account has been disabled.";
      break;
    case 'auth/user-not-found':
      errorMessage = "No user found with this email address.";
      break;
    case 'auth/wrong-password':
      errorMessage = "Incorrect password.";
      break;
    case 'auth/too-many-requests':
      errorMessage = "Too many requests. Try again later.";
      break;
    default:
      console.error("Auth error:", error);
  }
  
  return errorMessage;
};

// Initialize the app
const initFirebase = async () => {
  await setupPersistence();
  return { app, auth, db, storage, messaging };
};

export { 
  initFirebase,
  auth,
  db,
  storage,
  messaging,
  googleProvider,
  facebookProvider,
  githubProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthChanged,
  handleAuthError,
  perf
};