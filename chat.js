// chat.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let currentUser = null;

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();
    document.getElementById("username").innerText = data?.username || "Anonymous";
    
    loadMessages();
  } else {
    window.location.href = "login.html";
  }
});

function logout() {
  signOut(auth).then(() => window.location.href = "login.html");
}

function sendMessage() {
  const message = document.getElementById("message").value;
  if (message.trim() === "") return;

  addDoc(collection(db, "messages"), {
    uid: currentUser.uid,
    username: document.getElementById("username").innerText,
    text: message,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("message").value = "";
}

function loadMessages() {
  const messagesQuery = query(collection(db, "messages"), orderBy("createdAt"));
  
  onSnapshot(messagesQuery, (snapshot) => {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "chat-message";
      div.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}
