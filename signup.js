// signup.js
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const auth = getAuth();

function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  // Validate email and password
  if (!email || !password) {
    alert("Please fill in both email and password.");
    return;
  }

  if (password.length < 6) {
    alert("Password should be at least 6 characters.");
    return;
  }

  // Sign up with Firebase Authentication
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed up successfully
      const user = userCredential.user;
      console.log("User created:", user);
      window.location.href = "chat.html"; // Redirect to chat page
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.error("Error creating user:", errorCode, errorMessage);
      alert("Error: " + errorMessage);
    });
}
