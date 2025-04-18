import { auth, db } from './firebase.js';
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, updateDoc,
  arrayUnion, arrayRemove, deleteField
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Global variables
let currentUser = null;
let chatPartner = null;
let currentChatId = null;
let editingMessageId = null;

// Get chat partner ID from URL
const urlParams = new URLSearchParams(window.location.search);
const partnerId = urlParams.get('userId');

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await initializeChat();
      loadMessages();
      setupEventListeners();
    } else {
      window.location.href = 'login.html';
    }
  });
});

// Initialize chat with selected partner
async function initializeChat() {
  try {
    // Get partner info
    const partnerDoc = await getDoc(doc(db, "users", partnerId));
    if (!partnerDoc.exists()) {
      throw new Error("User not found");
    }
    
    chatPartner = partnerDoc.data();
    document.getElementById('chat-partner-name').textContent = chatPartner.displayName || chatPartner.email;
    
    // Find existing chat or create new one
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );
    
    const querySnapshot = await getDocs(chatsQuery);
    let chatExists = false;
    
    querySnapshot.forEach((doc) => {
      const chat = doc.data();
      if (chat.participants.includes(partnerId)) {
        currentChatId = doc.id;
        chatExists = true;
      }
    });
    
    if (!chatExists) {
      const newChat = {
        participants: [currentUser.uid, partnerId],
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageTime: null
      };
      
      const docRef = await addDoc(collection(db, "chats"), newChat);
      currentChatId = docRef.id;
    }
  } catch (error) {
    console.error("Chat initialization error:", error);
    alert("Failed to start chat: " + error.message);
  }
}

// Load and display messages
function loadMessages() {
  const messagesContainer = document.getElementById('chat-container');
  messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';
  
  const messagesQuery = query(
    collection(db, "chats", currentChatId, "messages"),
    orderBy("timestamp", "asc")
  );
  
  onSnapshot(messagesQuery, (snapshot) => {
    messagesContainer.innerHTML = '';
    
    snapshot.forEach((doc) => {
      const message = doc.data();
      if (!message.deleted) { // Skip deleted messages
        displayMessage(message);
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
  messageElement.dataset.messageId = message.id;
  
  let contentHTML = '';
  if (message.type === 'text') {
    contentHTML = `
      <div class="message-content">
        <p>${message.content}</p>
        <span class="message-time">
          ${formatTime(message.timestamp?.toDate())}
          ${message.edited ? ' (edited)' : ''}
        </span>
      </div>
    `;
  } else if (message.type === 'image') {
    contentHTML = `
      <div class="message-content">
        <img src="${message.content}" class="message-image" alt="Sent image">
        <span class="message-time">${formatTime(message.timestamp?.toDate())}</span>
      </div>
    `;
  }
  
  // Add action buttons for user's own messages
  if (isCurrentUser) {
    contentHTML += `
      <div class="message-actions">
        <button class="btn-icon" onclick="deleteMessage('${message.id}')">
          <i class="fas fa-trash"></i>
        </button>
        <button class="btn-icon" onclick="startEditingMessage('${message.id}', '${escapeHtml(message.content)}')">
          <i class="fas fa-edit"></i>
        </button>
      </div>
    `;
  }
  
  messageElement.innerHTML = contentHTML;
  messagesContainer.appendChild(messageElement);
}

// Send a new text message
window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  
  if (!content) return;
  
  try {
    if (editingMessageId) {
      // Update existing message
      await updateDoc(doc(db, "chats", currentChatId, "messages", editingMessageId), {
        content: content,
        edited: true,
        lastUpdated: serverTimestamp()
      });
      editingMessageId = null;
      input.value = '';
      document.querySelector('.editing-indicator')?.remove();
    } else {
      // Send new message
      const messageRef = await addDoc(collection(db, "chats", currentChatId, "messages"), {
        id: Date.now().toString(),
        senderId: currentUser.uid,
        content: content,
        type: 'text',
        timestamp: serverTimestamp()
      });
      
      // Update chat last message
      await updateDoc(doc(db, "chats", currentChatId), {
        lastMessage: content,
        lastMessageTime: serverTimestamp()
      });
    }
    
    input.value = '';
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message: " + error.message);
  }
};

// Delete a message
window.deleteMessage = async function(messageId) {
  if (!confirm("Are you sure you want to delete this message?")) return;
  
  try {
    // Mark as deleted rather than actually deleting
    await updateDoc(doc(db, "chats", currentChatId, "messages", messageId), {
      deleted: true,
      content: "[Message deleted]",
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    alert("Failed to delete message: " + error.message);
  }
};

// Start editing a message
window.startEditingMessage = function(messageId, currentContent) {
  editingMessageId = messageId;
  const input = document.getElementById('message-input');
  input.value = currentContent;
  input.focus();
  
  // Add editing indicator
  if (!document.querySelector('.editing-indicator')) {
    const indicator = document.createElement('div');
    indicator.className = 'editing-indicator';
    indicator.textContent = 'Editing message...';
    document.querySelector('.message-input-container').prepend(indicator);
  }
};

// Setup event listeners
function setupEventListeners() {
  const input = document.getElementById('message-input');
  
  // Send message on Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Cancel editing on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editingMessageId) {
      e.preventDefault();
      editingMessageId = null;
      input.value = '';
      document.querySelector('.editing-indicator')?.remove();
    }
  });
}

// Format time as HH:MM
function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Back to contacts list
window.goBack = function() {
  window.location.href = 'index.html';
};