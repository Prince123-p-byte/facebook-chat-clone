import { auth, db } from './firebase.js';
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, updateDoc,
  getDocs, deleteField
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Global variables
let currentUser = null;
let chatPartner = null;
let currentChatId = null;
let editingMessageId = null;

// Get chat partner ID from URL
const urlParams = new URLSearchParams(window.location.search);
const partnerId = urlParams.get('userId');

// DOM elements
const messagesContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const chatPartnerName = document.getElementById('chat-partner-name');
const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
const onlineStatusElement = document.querySelector('.online-status');

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
    const partnerRef = doc(db, "users", partnerId);
    const partnerSnap = await getDoc(partnerRef);
    
    if (!partnerSnap.exists()) {
      throw new Error("User not found");
    }
    
    chatPartner = partnerSnap.data();
    chatPartnerName.textContent = chatPartner.displayName || chatPartner.email.split('@')[0];
    
    // Set avatar (using UI Avatars API as fallback)
    if (chatPartner.photoURL) {
      chatPartnerAvatar.src = chatPartner.photoURL;
    } else {
      const nameForAvatar = chatPartner.displayName || chatPartner.email.split('@')[0];
      chatPartnerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&background=random`;
    }
    
    // Set online status
    if (chatPartner.isOnline) {
      onlineStatusElement.innerHTML = '<span class="online-dot"></span> Online';
    } else {
      onlineStatusElement.innerHTML = '<span class="offline-dot"></span> Offline';
      onlineStatusElement.classList.add('offline');
    }
    
    // Find existing chat between users
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
    
    // Create new chat if none exists
    if (!chatExists) {
      const newChat = {
        participants: [currentUser.uid, partnerId],
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageTime: null,
        lastMessageSender: ""
      };
      
      const docRef = await addDoc(collection(db, "chats"), newChat);
      currentChatId = docRef.id;
    }
  } catch (error) {
    console.error("Chat initialization error:", error);
    showError("Failed to start chat: " + error.message);
  }
}

// Load and display messages in real-time
function loadMessages() {
  messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';
  
  const messagesQuery = query(
    collection(db, "chats", currentChatId, "messages"),
    orderBy("timestamp", "asc")
  );
  
  onSnapshot(messagesQuery, (snapshot) => {
    messagesContainer.innerHTML = '';
    
    snapshot.forEach((doc) => {
      const message = doc.data();
      if (!message.deleted) {
        displayMessage(message);
      }
    });
    
    // Scroll to latest message
    scrollToBottom();
  });
}

// Display a message in the chat UI
function displayMessage(message) {
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

// Send a new message
window.sendMessage = async function() {
  const content = messageInput.value.trim();
  
  if (!content) return;
  
  try {
    if (editingMessageId) {
      // Update existing message
      await updateDoc(doc(db, "chats", currentChatId, "messages", editingMessageId), {
        content: content,
        edited: true,
        lastUpdated: serverTimestamp()
      });
      cancelEditing();
    } else {
      // Send new message
      const newMessage = {
        id: Date.now().toString(),
        senderId: currentUser.uid,
        content: content,
        type: 'text',
        timestamp: serverTimestamp()
      };
      
      await addDoc(collection(db, "chats", currentChatId, "messages"), newMessage);
      
      // Update chat last message
      await updateDoc(doc(db, "chats", currentChatId), {
        lastMessage: content,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid
      });
    }
    
    messageInput.value = '';
  } catch (error) {
    console.error("Error sending message:", error);
    showError("Failed to send message");
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
    showError("Failed to delete message");
  }
};

// Start editing a message
window.startEditingMessage = function(messageId, currentContent) {
  editingMessageId = messageId;
  messageInput.value = currentContent;
  messageInput.focus();
  
  // Show editing indicator
  const indicator = document.createElement('div');
  indicator.className = 'editing-indicator';
  indicator.innerHTML = '<i class="fas fa-pencil-alt"></i> Editing message...';
  document.querySelector('.message-input-container').prepend(indicator);
};

// Cancel editing mode
function cancelEditing() {
  editingMessageId = null;
  messageInput.value = '';
  const indicator = document.querySelector('.editing-indicator');
  if (indicator) indicator.remove();
}

// Setup event listeners
function setupEventListeners() {
  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Cancel editing on Escape
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editingMessageId) {
      e.preventDefault();
      cancelEditing();
    }
  });
  
  // Typing indicator (simplified version)
  let typingTimeout;
  messageInput.addEventListener('input', () => {
    // In a real app, you would send a "typing" status to the other user
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      // Typing stopped
    }, 1000);
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

// Scroll to bottom of chat
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show error message
function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  messagesContainer.appendChild(errorElement);
  setTimeout(() => errorElement.remove(), 3000);
}

// Back to contacts list
window.goBack = function() {
  window.location.href = 'index.html';
};

// Show chat options menu
window.showChatOptions = function() {
  const menu = document.getElementById('chat-options-menu');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};

// Clear chat history
window.clearChatHistory = async function() {
  if (!confirm("Are you sure you want to clear all chat history?")) return;
  
  try {
    // Get all messages in the chat
    const messagesQuery = query(collection(db, "chats", currentChatId, "messages"));
    const querySnapshot = await getDocs(messagesQuery);
    
    // Mark all as deleted
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      const messageRef = doc.ref;
      batch.update(messageRef, {
        deleted: true,
        content: "[Message deleted]",
        lastUpdated: serverTimestamp()
      });
    });
    
    await batch.commit();
    
    // Update chat last message
    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: "[Chat cleared]",
      lastMessageTime: serverTimestamp(),
      lastMessageSender: ""
    });
    
    showChatOptions(); // Hide the menu
  } catch (error) {
    console.error("Error clearing chat:", error);
    showError("Failed to clear chat");
  }
};

// Mute chat notifications
window.muteChat = function() {
  alert("Chat notifications would be muted here");
  showChatOptions(); // Hide the menu
};

// Toggle emoji picker (placeholder)
window.toggleEmojiPicker = function() {
  alert("Emoji picker would appear here in a full implementation");
};