const chatBox = document.getElementById("chat-box");

function sendMessage() {
  const username = document.getElementById("username").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!username || !message) {
    alert("Please enter both your name and a message.");
    return;
  }

  db.collection("messages").add({
    username,
    message,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("message").value = "";
}

// Realtime listener
db.collection("messages").orderBy("timestamp", "asc").onSnapshot(snapshot => {
  chatBox.innerHTML = "";
  snapshot.forEach(doc => {
    const msg = doc.data();
    chatBox.innerHTML += `<div class="message"><span>${msg.username}:</span> ${msg.message}</div>`;
  });
  chatBox.scrollTop = chatBox.scrollHeight;
});
