import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

window.signup = async function signup() {
  const username = document.getElementById("signup-username").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Optional: Update display name
    await updateProfile(user, {
      displayName: username
    });

    // Save username to Firestore
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: email
    });

    alert("Signup successful! Redirecting to chat...");
    window.location.href = "index.html";
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}
