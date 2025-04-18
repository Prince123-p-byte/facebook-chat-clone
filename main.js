// main.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  collection, addDoc, onSnapshot, orderBy, query, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("username").textContent = user.email;
    loadMessages();
  } else {
    window.location.href = "login.html";
  }
});

window.logout = function() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  }).catch((error) => {
    alert(error.message);
  });
};

window.sendMessage = async function() {
  const messageInput = document.getElementById("message");
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  try {
    await addDoc(collection(db, "messages"), {
      uid: currentUser.uid,
      username: currentUser.email,
      text: message,
      createdAt: serverTimestamp()
    });
    messageInput.value = "";
  } catch (error) {
    alert(error.message);
  }
};

function loadMessages() {
  const q = query(collection(db, "messages"), orderBy("createdAt"));
  
  onSnapshot(q, (snapshot) => {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const messageElement = document.createElement("div");
      messageElement.className = "chat-message";
      messageElement.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
      chatBox.appendChild(messageElement);
    });
    
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}