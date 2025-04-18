import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

window.signup = async function() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const displayName = prompt("Enter your display name:", email.split('@')[0]);

  if (!email || !password) {
    alert("Please fill in both email and password.");
    return;
  }

  if (password.length < 6) {
    alert("Password should be at least 6 characters.");
    return;
  }

  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
      status: "Hey there! I am using ChatApp",
      createdAt: new Date()
    });
    
    window.location.href = 'index.html';
  } catch (error) {
    console.error("Signup error:", error);
    alert("Failed to sign up: " + error.message);
  }
};