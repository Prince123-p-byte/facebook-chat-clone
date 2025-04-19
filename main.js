import { auth, db } from './firebase.js';
import { 
  onAuthStateChanged, 
  signOut,
  updateProfile
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
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// DOM Elements
const contactsList = document.getElementById('contacts-list');
const searchContactsInput = document.getElementById('search-contacts');
const currentUserEmail = document.getElementById('current-user-email');
const currentUserName = document.getElementById('current-user-name');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const newChatModal = document.getElementById('new-chat-modal');
const availableUsersList = document.getElementById('available-users');
const backToContactsBtn = document.getElementById('back-to-contacts');
const chatPartnerName = document.getElementById('chat-partner-name');
const chatPartnerStatus = document.getElementById('chat-partner-status');
const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatUI = document.querySelector('.chat-ui');
const chatPlaceholder = document.querySelector('.chat-placeholder');
const appContainer = document.querySelector('.app-container');
const profileModal = document.getElementById('profile-modal');
const profileModalClose = document.getElementById('profile-modal-close');
const profileNameInput = document.getElementById('profile-name-input');
const profileSaveBtn = document.getElementById('profile-save-btn');
const profileAvatar = document.getElementById('profile-avatar');
const profileAvatarInput = document.getElementById('profile-avatar-input');
const typingIndicator = document.getElementById('typing-indicator');
const onlineStatusIndicator = document.getElementById('online-status-indicator');
const lastSeenIndicator = document.getElementById('last-seen-indicator');

// Global variables
let currentUser = null;
let contacts = [];
let currentChatPartner = null;
let unsubscribeMessages = null;
let unsubscribeStatus = null;
let isTyping = false;
let typingTimeout = null;

// Track unread messages and typing status
const unreadMessages = {};
const typingStatus = {};

// Initialize the app
function initApp() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      currentUserEmail.textContent = user.email;
      currentUserName.textContent = user.displayName || user.email.split('@')[0];
      userAvatar.src = user.photoURL || generateAvatar(user.email);
      profileAvatar.src = user.photoURL || generateAvatar(user.email);
      profileNameInput.value = user.displayName || '';
      
      // Set user as online
      await updateUserStatus(true);
      
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

// Generate avatar from email
function generateAvatar(email) {
  const name = email.split('@')[0];
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff`;
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
  // Unsubscribe from previous chat's messages and status
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeStatus) unsubscribeStatus();
  
  currentChatPartner = partner;
  chatPartnerName.textContent = partner.displayName || partner.email;
  chatPartnerAvatar.src = partner.photoURL || generateAvatar(partner.email);
  
  // WhatsApp-like behavior
  if (window.innerWidth <= 768) {
    appContainer.classList.add('chat-open');
  } else {
    chatUI.style.display = 'flex';
    chatPlaceholder.style.display = 'none';
  }
  
  // Load chat messages
  loadChatMessages(partner.uid);
  
  // Subscribe to partner's status
  subscribeToPartnerStatus(partner.uid);
  
  // Clear unread messages
  clearUnreadMessages(partner.uid);
  
  // Update last seen
  updateUserStatus(true);
}

function closeChat() {
  // Unsubscribe from messages and status when closing chat
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeStatus) unsubscribeStatus();
  
  currentChatPartner = null;
  updateUserStatus(false);
  
  if (window.innerWidth <= 768) {
    appContainer.classList.remove('chat-open');
  } else {
    chatUI.style.display = 'none';
    chatPlaceholder.style.display = 'flex';
  }
}

// Subscribe to partner's online status
function subscribeToPartnerStatus(partnerId) {
  const partnerRef = doc(db, "users", partnerId);
  
  unsubscribeStatus = onSnapshot(partnerRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const isOnline = data.isOnline;
      const lastSeen = data.lastSeen;
      
      if (isOnline) {
        chatPartnerStatus.textContent = 'Online';
        onlineStatusIndicator.style.display = 'inline-block';
        lastSeenIndicator.style.display = 'none';
      } else {
        chatPartnerStatus.textContent = `Last seen ${formatLastSeen(lastSeen)}`;
        onlineStatusIndicator.style.display = 'none';
        lastSeenIndicator.style.display = 'inline-block';
      }
      
      // Update typing indicator
      if (data.typingTo === currentUser.uid) {
        showTypingIndicator();
      } else {
        hideTypingIndicator();
      }
    }
  });
}

// Show typing indicator
function showTypingIndicator() {
  typingIndicator.style.display = 'block';
  typingIndicator.textContent = `${currentChatPartner.displayName || currentChatPartner.email.split('@')[0]} is typing...`;
}

// Hide typing indicator
function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

// Update user's online status and typing status
async function updateUserStatus(isOnline) {
  if (!currentUser) return;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      isOnline: isOnline,
      lastSeen: serverTimestamp(),
      ...(currentChatPartner && isOnline ? { typingTo: null } : {})
    });
  } catch (error) {
    console.error("Error updating user status:", error);
  }
}

// Update typing status
async function updateTypingStatus(isTyping) {
  if (!currentUser || !currentChatPartner) return;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      typingTo: isTyping ? currentChatPartner.uid : null
    });
  } catch (error) {
    console.error("Error updating typing status:", error);
  }
}

// Handle typing events
function handleTyping() {
  if (!isTyping) {
    isTyping = true;
    updateTypingStatus(true);
  }
  
  // Clear previous timeout
  if (typingTimeout) clearTimeout(typingTimeout);
  
  // Set new timeout
  typingTimeout = setTimeout(() => {
    isTyping = false;
    updateTypingStatus(false);
  }, 2000);
}

// Load contacts from Firestore
async function loadContacts() {
  contactsList.innerHTML = '<div class="loading">Loading contacts...</div>';

  try {
    // Get all users except current user
    const q = query(collection(db, "users"), where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);

    contacts = [];
    contactsList.innerHTML = '';

    querySnapshot.forEach((userDoc) => {
      const user = { ...userDoc.data(), uid: userDoc.id };

      // Fetch the last message for this contact
      const chatRoomId = generateChatRoomId(currentUser.uid, user.uid);
      const chatRef = doc(db, "chats", chatRoomId);

      getDoc(chatRef).then((chatSnap) => {
        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          user.lastMessage = chatData.lastMessage || 'No messages yet';
          user.lastMessageTime = chatData.lastMessageTime;
        } else {
          user.lastMessage = 'No messages yet';
          user.lastMessageTime = null;
        }
        renderContact(user);
      });

      contacts.push(user);
    });

    if (contacts.length === 0) {
      contactsList.innerHTML = '<div class="no-contacts">No contacts found</div>';
    }
  } catch (error) {
    console.error("Error loading contacts:", error);
    contactsList.innerHTML = '<div class="error">Failed to load contacts</div>';
  }
}

// Generate chat room ID
function generateChatRoomId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

// Render a contact in the sidebar
function renderContact(user) {
  const contactElement = document.createElement('div');
  contactElement.className = 'contact';
  contactElement.dataset.uid = user.uid;
  
  const lastMessageTime = user.lastMessageTime 
    ? formatMessageTime(user.lastMessageTime.toDate())
    : '';
  
  contactElement.innerHTML = `
    <img src="${user.photoURL || generateAvatar(user.email)}" alt="${user.displayName || user.email}">
    <div class="contact-info">
      <h3>${user.displayName || user.email}</h3>
      <p id="last-message-${user.uid}">${user.lastMessage || 'No messages yet'}</p>
    </div>
    <div class="contact-meta">
      <span class="message-time">${lastMessageTime}</span>
      <span id="unread-badge-${user.uid}" class="unread-badge" style="display: none;"></span>
    </div>
  `;

  contactElement.addEventListener('click', () => {
    openChat(user);
    clearUnreadMessages(user.uid);
  });
  contactsList.appendChild(contactElement);

  // Initialize unread badge
  updateUnreadBadge(user.uid);
}

// Format message time
function formatMessageTime(date) {
  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
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

// Function to load chat messages
function loadChatMessages(partnerId) {
  // Clear existing messages with a fade-out effect
  chatMessagesContainer.style.opacity = '0';
  setTimeout(() => {
    chatMessagesContainer.innerHTML = '';
    chatMessagesContainer.style.opacity = '1';
  }, 150);

  const chatRoomId = generateChatRoomId(currentUser.uid, partnerId);
  const messagesRef = collection(db, "chats", chatRoomId, "messages");
  const q = query(messagesRef, orderBy("timestamp"));

  // Use a flag to prevent duplicate renders
  let isRendering = false;

  unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
    if (isRendering) return;
    isRendering = true;

    const changes = querySnapshot.docChanges();
    changes.forEach((change) => {
      if (change.type === 'added') {
        renderMessage(change.doc.data(), change.doc.data().senderId === currentUser.uid);
      }
    });

    scrollToBottom();
    isRendering = false;
  });
}

// Enhanced renderMessage function
function renderMessage(message, isSent) {
  // Use requestAnimationFrame for smoother rendering
  requestAnimationFrame(() => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    // Use document fragment to minimize reflows
    const fragment = document.createDocumentFragment();
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Batch DOM updates
    const messageText = document.createElement('p');
    messageText.textContent = message.text;
    
    const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
    messageTime.textContent = message.timestamp?.toDate().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (isSent) {
      const readReceipt = document.createElement('span');
      readReceipt.textContent = message.read ? '✓✓' : '✓';
      messageTime.appendChild(readReceipt);
    }
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageTime);
    messageElement.appendChild(messageContent);
    fragment.appendChild(messageElement);
    
    chatMessagesContainer.appendChild(fragment);
  });
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
  const chatRoomId = generateChatRoomId(currentUser.uid, currentChatPartner.uid);
  
  try {
    // Ensure the chat room exists
    const chatRef = doc(db, "chats", chatRoomId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      // Create the chat room
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
    
    // Clear input and reset typing status
    messageInput.value = '';
    isTyping = false;
    updateTypingStatus(false);
    
    // Update last message in contact list
    updateLastMessageInContact(currentChatPartner.uid, messageText);
  } catch (error) {
    console.error("Error sending message:", error);
    showToast("Failed to send message. Please try again.");
  }
}

// Update last message in contact list
function updateLastMessageInContact(contactId, message) {
  const contactElement = contactsList.querySelector(`.contact[data-uid="${contactId}"]`);
  if (contactElement) {
    const lastMessageElement = contactElement.querySelector('.contact-info p');
    if (lastMessageElement) {
      lastMessageElement.textContent = message;
    }
    
    const messageTimeElement = contactElement.querySelector('.message-time');
    if (messageTimeElement) {
      messageTimeElement.textContent = formatMessageTime(new Date());
    }
  }
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Enhanced scrollToBottom function
function scrollToBottom() {
  requestAnimationFrame(() => {
    const container = chatMessagesContainer;
    const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
    
    if (isNearBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  });
}

// New chat modal functions
async function showNewChatModal() {
  availableUsersList.innerHTML = '<div class="loading">Loading users...</div>';
  newChatModal.style.display = 'flex';
  
  try {
    const q = query(collection(db, "users"), where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);
    
    availableUsersList.innerHTML = '';
    
    if (querySnapshot.empty) {
      availableUsersList.innerHTML = '<div class="no-users">No other users found</div>';
      return;
    }
    
    querySnapshot.forEach((doc) => {
      const user = { ...doc.data(), uid: doc.id };
      const userElement = document.createElement('div');
      userElement.className = 'user-to-chat';
      userElement.innerHTML = `
        <img src="${user.photoURL || generateAvatar(user.email)}" alt="${user.displayName || user.email}">
        <div class="user-info">
          <span>${user.displayName || user.email}</span>
          <span class="status ${user.isOnline ? 'online' : 'offline'}">
            ${user.isOnline ? 'Online' : formatLastSeen(user.lastSeen)}
          </span>
        </div>
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

// Profile modal functions
function showProfileModal() {
  profileModal.style.display = 'flex';
}

function closeProfileModal() {
  profileModal.style.display = 'none';
}

async function saveProfile() {
  const newName = profileNameInput.value.trim();
  
  try {
    // Update profile in Firebase Auth
    await updateProfile(auth.currentUser, {
      displayName: newName,
      photoURL: profileAvatar.src
    });
    
    // Update profile in Firestore
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      displayName: newName,
      photoURL: profileAvatar.src
    });
    
    // Update UI
    currentUserName.textContent = newName;
    userAvatar.src = profileAvatar.src;
    
    showToast("Profile updated successfully");
    closeProfileModal();
  } catch (error) {
    console.error("Error updating profile:", error);
    showToast("Failed to update profile");
  }
}

// Handle avatar upload
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    profileAvatar.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Search contacts
function setupSearch() {
  searchContactsInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredContacts = contacts.filter(contact => 
      (contact.displayName?.toLowerCase().includes(searchTerm) || 
      contact.email.toLowerCase().includes(searchTerm)
    ));
    
    contactsList.innerHTML = '';
    
    if (filteredContacts.length === 0) {
      contactsList.innerHTML = '<div class="no-contacts">No matching contacts found</div>';
      return;
    }
    
    filteredContacts.forEach(renderContact);
  });
}

// Track unread messages
function incrementUnreadMessages(contactId) {
  if (!unreadMessages[contactId]) {
    unreadMessages[contactId] = 0;
  }
  unreadMessages[contactId]++;
  updateUnreadBadge(contactId);
}

function clearUnreadMessages(contactId) {
  unreadMessages[contactId] = 0;
  updateUnreadBadge(contactId);
}

function updateUnreadBadge(contactId) {
  const badge = document.getElementById(`unread-badge-${contactId}`);
  if (unreadMessages[contactId] > 0) {
    badge.textContent = unreadMessages[contactId];
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
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
  userAvatar.addEventListener('click', showProfileModal);
  profileModalClose.addEventListener('click', closeProfileModal);
  profileSaveBtn.addEventListener('click', saveProfile);
  profileAvatarInput.addEventListener('change', handleAvatarUpload);
  
  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Typing indicator
  messageInput.addEventListener('input', () => {
    if (messageInput.value.trim().length > 0) {
      handleTyping();
    }
  });
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === newChatModal) newChatModal.style.display = 'none';
    if (e.target === profileModal) closeProfileModal();
  });
}

// Subscribe to messages
function subscribeToMessages(chatRoomId) {
  const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc')); // Order by timestamp

  onSnapshot(messagesQuery, (snapshot) => {
    chatMessagesContainer.innerHTML = ''; // Clear the container before rendering
    snapshot.forEach((doc) => {
      const message = doc.data();
      renderMessage(message); // Render each message
    });
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
    showToast("Failed to logout");
  }
}

// Initialize the app
initApp();