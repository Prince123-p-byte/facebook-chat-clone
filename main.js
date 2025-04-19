import { auth, db } from './firebase.js';
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// DOM Elements
const contactsList = document.getElementById('contacts-list');
const searchContactsInput = document.getElementById('search-contacts');
const currentUserEmail = document.getElementById('current-user-email');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const newChatModal = document.getElementById('new-chat-modal');
const availableUsersList = document.getElementById('available-users');
const backToContactsBtn = document.getElementById('back-to-contacts');
const chatPartnerName = document.getElementById('chat-partner-name');
const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatUI = document.querySelector('.chat-ui');
const chatPlaceholder = document.querySelector('.chat-placeholder');
const appContainer = document.querySelector('.app-container');

// Global variables
let currentUser = null;
let contacts = [];
let currentChatPartner = null;
let unsubscribeMessages = null;

// Initialize the app
function initApp() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      currentUserEmail.textContent = user.email;
      userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email.split('@')[0]}`;
      
      await loadContacts();
      setupEventListeners();
      
      // Handle responsive layout
      window.addEventListener('resize', handleLayoutChange);
      handleLayoutChange();
    } else {
      window.location.href = 'login.html';
    }
  });
}

// WhatsApp-like layout functions
function handleLayoutChange() {
  if (window.innerWidth <= 768) {
    // Mobile layout
    backToContactsBtn.style.display = 'flex';
    if (currentChatPartner) {
      appContainer.classList.add('chat-open');
    }
  } else {
    // Desktop layout
    backToContactsBtn.style.display = 'none';
    appContainer.classList.remove('chat-open');
    if (currentChatPartner) {
      chatUI.style.display = 'flex';
      chatPlaceholder.style.display = 'none';
    }
  }
}

function openChat(partner) {
  // Unsubscribe from previous chat's messages
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
  
  currentChatPartner = partner;
  chatPartnerName.textContent = partner.displayName || partner.email;
  chatPartnerAvatar.src = partner.photoURL || `https://ui-avatars.com/api/?name=${partner.email.split('@')[0]}`;
  
  // WhatsApp-like behavior
  if (window.innerWidth <= 768) {
    appContainer.classList.add('chat-open');
  } else {
    chatUI.style.display = 'flex';
    chatPlaceholder.style.display = 'none';
  }
  
  // Load chat messages
  loadChatMessages(partner.uid);
  
  // Update last seen or online status
  updateUserStatus(true);
}

function closeChat() {
  // Unsubscribe from messages when closing chat
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
  
  currentChatPartner = null;
  updateUserStatus(false);
  
  if (window.innerWidth <= 768) {
    appContainer.classList.remove('chat-open');
  } else {
    chatUI.style.display = 'none';
    chatPlaceholder.style.display = 'flex';
  }
}

// Update user's online status
async function updateUserStatus(isOnline) {
  if (!currentUser) return;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      isOnline: isOnline,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user status:", error);
  }
}

// Load contacts from Firestore
async function loadContacts() {
  contactsList.innerHTML = '<div class="loading">Loading contacts...</div>';
  
  try {
    const q = query(collection(db, "users"), where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);
    
    contacts = [];
    contactsList.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const user = { ...doc.data(), uid: doc.id };
      contacts.push(user);
      renderContact(user);
    });
    
    if (contacts.length === 0) {
      contactsList.innerHTML = '<div class="no-contacts">No contacts found</div>';
    }
  } catch (error) {
    console.error("Error loading contacts:", error);
    contactsList.innerHTML = '<div class="error">Failed to load contacts</div>';
  }
}

// Render a contact in the sidebar
function renderContact(user) {
  const contactElement = document.createElement('div');
  contactElement.className = 'contact';
  contactElement.innerHTML = `
    <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${user.email.split('@')[0]}`}" alt="${user.displayName || user.email}">
    <div class="contact-info">
      <h3>${user.displayName || user.email}</h3>
      <p>${user.status || 'Hey there! I am using ChatApp'}</p>
      <span class="status-indicator ${user.isOnline ? 'online' : 'offline'}">
        ${user.isOnline ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`}
      </span>
    </div>
  `;
  
  contactElement.addEventListener('click', () => openChat(user));
  contactsList.appendChild(contactElement);
}

// Format last seen timestamp
function formatLastSeen(timestamp) {
  if (!timestamp) return 'a long time ago';
  
  const now = new Date();
  const lastSeen = timestamp.toDate();
  const diffInSeconds = Math.floor((now - lastSeen) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Load messages for a specific chat
function loadChatMessages(partnerId) {
  chatMessagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';
  
  // Get the chat room ID (sorted user IDs to ensure consistency)
  const chatRoomId = [currentUser.uid, partnerId].sort().join('_');
  
  // Reference to the messages subcollection
  const messagesRef = collection(db, "chats", chatRoomId, "messages");
  
  // Query messages ordered by timestamp
  const q = query(messagesRef, orderBy("timestamp"));
  
  // Set up real-time listener
  unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
    chatMessagesContainer.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const message = doc.data();
      renderMessage(message, message.senderId === currentUser.uid);
    });
    
    scrollToBottom();
    
    // Mark messages as read
    markMessagesAsRead(chatRoomId);
  }, (error) => {
    console.error("Error loading messages:", error);
    chatMessagesContainer.innerHTML = '<div class="error">Failed to load messages</div>';
  });
}

// Render a single message
function renderMessage(message, isSent) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
  messageElement.innerHTML = `
    <div class="message-content">
      <p>${message.text}</p>
      <span class="message-time">
        ${message.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        ${isSent ? (message.read ? '✓✓' : '✓') : ''}
      </span>
    </div>
  `;
  chatMessagesContainer.appendChild(messageElement);
}

// Mark messages as read
async function markMessagesAsRead(chatRoomId) {
  if (!currentChatPartner) return;
  
  try {
    const messagesRef = collection(db, "chats", chatRoomId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "==", currentChatPartner.uid),
      where("read", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (doc) => {
      await updateDoc(doc.ref, { read: true });
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

// Send a new message
async function sendMessage() {
  const messageText = messageInput.value.trim();
  if (!messageText || !currentChatPartner) return;
  
  // Get the chat room ID
  const chatRoomId = [currentUser.uid, currentChatPartner.uid].sort().join('_');
  
  try {
    // Ensure the chat room exists
    const chatRef = doc(db, "chats", chatRoomId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      // Create the chat room if it doesn't exist
      await setDoc(chatRef, {
        participants: [currentUser.uid, currentChatPartner.uid],
        createdAt: serverTimestamp(),
        lastMessage: messageText,
        lastMessageTime: serverTimestamp()
      });
      
      // Add the chat to both users' chat lists
      await updateDoc(doc(db, "users", currentUser.uid), {
        chats: arrayUnion(chatRoomId)
      });
      
      await updateDoc(doc(db, "users", currentChatPartner.uid), {
        chats: arrayUnion(chatRoomId)
      });
    } else {
      // Update last message info
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp()
      });
    }
    
    // Add the message to the subcollection
    await addDoc(collection(db, "chats", chatRoomId, "messages"), {
      text: messageText,
      senderId: currentUser.uid,
      receiverId: currentChatPartner.uid,
      timestamp: serverTimestamp(),
      read: false
    });
    
    messageInput.value = '';
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message. Please try again.");
  }
}

function scrollToBottom() {
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// New chat modal functions
async function showNewChatModal() {
  availableUsersList.innerHTML = '<div class="loading">Loading users...</div>';
  newChatModal.style.display = 'flex';
  
  try {
    const q = query(collection(db, "users"), where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);
    
    availableUsersList.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const user = { ...doc.data(), uid: doc.id };
      const userElement = document.createElement('div');
      userElement.className = 'user-to-chat';
      userElement.innerHTML = `
        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${user.email.split('@')[0]}`}" alt="${user.displayName || user.email}">
        <span>${user.displayName || user.email}</span>
        <span class="status-indicator ${user.isOnline ? 'online' : 'offline'}">
          ${user.isOnline ? 'Online' : 'Offline'}
        </span>
      `;
      userElement.addEventListener('click', () => {
        openChat(user);
        newChatModal.style.display = 'none';
      });
      availableUsersList.appendChild(userElement);
    });
  } catch (error) {
    console.error("Error loading users:", error);
    availableUsersList.innerHTML = '<div class="error">Failed to load users</div>';
  }
}

// Search contacts
function setupSearch() {
  searchContactsInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredContacts = contacts.filter(contact => 
      (contact.displayName?.toLowerCase().includes(searchTerm) || 
      contact.email.toLowerCase().includes(searchTerm))
    );
    
    contactsList.innerHTML = '';
    
    if (filteredContacts.length === 0) {
      contactsList.innerHTML = '<div class="no-contacts">No matching contacts found</div>';
      return;
    }
    
    filteredContacts.forEach(renderContact);
  });
}

// Event listeners
function setupEventListeners() {
  setupSearch();
  
  // Buttons
  newChatBtn.addEventListener('click', showNewChatModal);
  closeModalBtn.addEventListener('click', () => newChatModal.style.display = 'none');
  backToContactsBtn.addEventListener('click', closeChat);
  logoutBtn.addEventListener('click', logout);
  sendMessageBtn.addEventListener('click', sendMessage);
  
  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === newChatModal) {
      newChatModal.style.display = 'none';
    }
  });
}

// Logout function
async function logout() {
  try {
    // Update status before logging out
    await updateUserStatus(false);
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout error:", error);
    alert("Failed to logout: " + error.message);
  }
}

// Initialize the app
initApp();