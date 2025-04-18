import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, getDoc, updateDoc,
  arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
  ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// Global variables
let currentUser = null;
let chatPartner = null;
let currentChatId = null;
const urlParams = new URLSearchParams(window.location.search);
const partnerId = urlParams.get('userId');

// Initialize the chat
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await initializeChat();
  } else {
    window.location.href = 'login.html';
  }
});

// Initialize chat with partner
async function initializeChat() {
  try {
    // Get chat partner info
    const partnerDoc = await getDoc(doc(db, "users", partnerId));
    if (!partnerDoc.exists()) {
      throw new Error("User not found");
    }
    
    chatPartner = partnerDoc.data();
    document.getElementById('chat-partner-name').textContent = chatPartner.displayName || chatPartner.email;
    document.getElementById('chat-partner-avatar').src = chatPartner.photoURL || 'https://via.placeholder.com/40';
    
    // Find or create a chat between these users
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );
    
    const querySnapshot = await getDocs(chatsQuery);
    let chatFound = false;
    
    querySnapshot.forEach((doc) => {
      const chat = doc.data();
      if (chat.participants.includes(partnerId)) {
        currentChatId = doc.id;
        chatFound = true;
        loadMessages();
      }
    });
    
    if (!chatFound) {
      // Create new chat
      const newChat = {
        participants: [currentUser.uid, partnerId],
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageTime: null
      };
      
      const docRef = await addDoc(collection(db, "chats"), newChat);
      currentChatId = docRef.id;
    }
  } catch (error) {
    console.error("Chat initialization error:", error);
    alert("Failed to initialize chat: " + error.message);
  }
}

// Load messages for current chat
function loadMessages() {
  const messagesContainer = document.getElementById('chat-container');
  messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';
  
  const messagesQuery = query(
    collection(db, "chats", currentChatId, "messages"),
    orderBy("timestamp", "asc")
  );
  
  onSnapshot(messagesQuery, (snapshot) => {
    messagesContainer.innerHTML = '';
    
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        displayMessage(change.doc.data());
      }
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// Display a message in the chat
function displayMessage(message) {
  const messagesContainer = document.getElementById('chat-container');
  const isCurrentUser = message.senderId === currentUser.uid;
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
  
  if (message.type === 'text') {
    messageElement.innerHTML = `
      <div class="message-content">
        <p>${message.content}</p>
        <span class="message-time">${formatTime(message.timestamp?.toDate())}</span>
      </div>
      ${isCurrentUser ? `
        <div class="message-actions">
          <button onclick="deleteMessage('${message.id}')"><i class="fas fa-trash"></i></button>
          <button onclick="editMessage('${message.id}', '${message.content}')"><i class="fas fa-edit"></i></button>
        </div>
      ` : ''}
    `;
  } else if (message.type === 'image') {
    messageElement.innerHTML = `
      <div class="message-content">
        <img src="${message.content}" alt="Sent image">
        <span class="message-time">${formatTime(message.timestamp?.toDate())}</span>
      </div>
      ${isCurrentUser ? `
        <div class="message-actions">
          <button onclick="deleteMessage('${message.id}')"><i class="fas fa-trash"></i></button>
        </div>
      ` : ''}
    `;
  } else if (message.type === 'file') {
    messageElement.innerHTML = `
      <div class="message-content">
        <a href="${message.content}" target="_blank" class="file-message">
          <i class="fas fa-file"></i>
          <span>Download File</span>
        </a>
        <span class="message-time">${formatTime(message.timestamp?.toDate())}</span>
      </div>
      ${isCurrentUser ? `
        <div class="message-actions">
          <button onclick="deleteMessage('${message.id}')"><i class="fas fa-trash"></i></button>
        </div>
      ` : ''}
    `;
  }
  
  messagesContainer.appendChild(messageElement);
}

// Send a new message
window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  
  if (!content) return;
  
  try {
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      id: Date.now().toString(),
      senderId: currentUser.uid,
      content: content,
      type: 'text',
      timestamp: serverTimestamp(),
      status: 'sent'
    });
    
    // Update last message in chat
    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: content,
      lastMessageTime: serverTimestamp()
    });
    
    input.value = '';
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message: " + error.message);
  }
};

// Upload media
window.openImageUpload = function() {
  document.getElementById('media-upload').accept = 'image/*';
  document.getElementById('media-upload').click();
};

window.openFileUpload = function() {
  document.getElementById('media-upload').accept = '.pdf,.doc,.docx,.txt';
  document.getElementById('media-upload').click();
};

document.getElementById('media-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    // Show loading state
    const messagesContainer = document.getElementById('chat-container');
    const loadingElement = document.createElement('div');
    loadingElement.className = 'message sent';
    loadingElement.innerHTML = '<div class="message-content"><p>Uploading file...</p></div>';
    messagesContainer.appendChild(loadingElement);
    
    // Upload file to storage
    const storageRef = ref(storage, `chats/${currentChatId}/${file.name}-${Date.now()}`);
    const uploadTask = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(uploadTask.ref);
    
    // Remove loading element
    messagesContainer.removeChild(loadingElement);
    
    // Create message with file
    const messageType = file.type.startsWith('image/') ? 'image' : 'file';
    
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      id: Date.now().toString(),
      senderId: currentUser.uid,
      content: downloadURL,
      type: messageType,
      timestamp: serverTimestamp(),
      status: 'sent',
      fileName: file.name
    });
    
    // Update last message in chat
    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: messageType === 'image' ? '📷 Image' : '📄 File',
      lastMessageTime: serverTimestamp()
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    alert("Failed to upload file: " + error.message);
  }
});

// Delete a message
window.deleteMessage = async function(messageId) {
  if (!confirm("Are you sure you want to delete this message?")) return;
  
  try {
    // In a real app, you would update a 'deleted' flag rather than actually deleting
    await updateDoc(doc(db, "chats", currentChatId, "messages", messageId), {
      deleted: true,
      content: 'This message was deleted',
      type: 'text'
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    alert("Failed to delete message: " + error.message);
  }
};

// Edit a message
window.editMessage = async function(messageId, currentContent) {
  const newContent = prompt("Edit your message:", currentContent);
  if (!newContent || newContent === currentContent) return;
  
  try {
    await updateDoc(doc(db, "chats", currentChatId, "messages", messageId), {
      content: newContent,
      edited: true
    });
  } catch (error) {
    console.error("Error editing message:", error);
    alert("Failed to edit message: " + error.message);
  }
};

// Show media options
window.showMediaOptions = function() {
  const options = document.getElementById('media-options');
  options.style.display = options.style.display === 'flex' ? 'none' : 'flex';
};

// Format time
function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}