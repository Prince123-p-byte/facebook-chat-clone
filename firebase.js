const firebaseConfig = {
    apiKey: "AIzaSyDUK0HY6MAFMh_4QoinLFjyc91p2Ds65XA",
    authDomain: "sharepostapp-b04c4.firebaseapp.com",
    projectId: "sharepostapp-b04c4",
    storageBucket: "sharepostapp-b04c4.appspot.com",
    messagingSenderId: "739870970679",
    appId: "1:739870970679:web:3c877919d634b96e9740b2",
    measurementId: "G-MBXY84LFNZ"
  };
  
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();

  