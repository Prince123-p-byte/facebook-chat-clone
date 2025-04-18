import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

window.login = async function() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'index.html';
  } catch (error) {
    console.error("Login error:", error);
    alert("Failed to login: " + error.message);
  }
};