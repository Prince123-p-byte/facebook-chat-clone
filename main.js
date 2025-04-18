// main.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, orderBy, query, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("username").innerText = user.email;

    loadMessages();
  } else {
    window.location.href = "login.html";
  }
});

function logout() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
}

window.logout = logout;

async function sendMessage() {
  const message = document.getElementById("message").value.trim();
  if (message === "") return;

  await addDoc(collection(db, "messages"), {
    uid: currentUser.uid,
    username: currentUser.email,
    text: message,
    createdAt: serverTimestamp()
  });

  document.getElementById("message").value = "";
}

window.sendMessage = sendMessage;

function loadMessages() {
  const q = query(collection(db, "messages"), orderBy("createdAt"));
  onSnapshot(q, (snapshot) => {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "chat-message";
      div.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}
