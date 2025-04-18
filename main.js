import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Global variables
let currentUser = null;
let contacts = [];

// Initialize the app
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('current-user').textContent = user.email;
    await loadContacts();
  } else {
    window.location.href = 'login.html';
  }
});

// Load all contacts (other users)
async function loadContacts() {
  const contactsList = document.getElementById('contacts-list');
  contactsList.innerHTML = '<div class="loading">Loading contacts...</div>';
  
  try {
    const q = query(collection(db, "users"), where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);
    
    contacts = [];
    contactsList.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const user = doc.data();
      contacts.push(user);
      
      const contactElement = document.createElement('div');
      contactElement.className = 'contact';
      contactElement.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/50'}" alt="${user.displayName}">
        <div class="contact-info">
          <h3>${user.displayName || user.email}</h3>
          <p>${user.status || 'Hey there! I am using ChatApp'}</p>
        </div>
      `;
      
      contactElement.addEventListener('click', () => {
        window.location.href = `chat.html?userId=${user.uid}`;
      });
      
      contactsList.appendChild(contactElement);
    });
    
    if (contacts.length === 0) {
      contactsList.innerHTML = '<div class="no-contacts">No contacts found</div>';
    }
  } catch (error) {
    console.error("Error loading contacts:", error);
    contactsList.innerHTML = '<div class="error">Failed to load contacts</div>';
  }
}

// Search contacts
document.getElementById('search-contacts').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const filteredContacts = contacts.filter(contact => 
    (contact.displayName?.toLowerCase().includes(searchTerm) || 
     contact.email.toLowerCase().includes(searchTerm))
  );
  
  const contactsList = document.getElementById('contacts-list');
  contactsList.innerHTML = '';
  
  filteredContacts.forEach(user => {
    const contactElement = document.createElement('div');
    contactElement.className = 'contact';
    contactElement.innerHTML = `
      <img src="${user.photoURL || 'https://via.placeholder.com/50'}" alt="${user.displayName}">
      <div class="contact-info">
        <h3>${user.displayName || user.email}</h3>
        <p>${user.status || 'Hey there! I am using ChatApp'}</p>
      </div>
    `;
    
    contactElement.addEventListener('click', () => {
      window.location.href = `chat.html?userId=${user.uid}`;
    });
    
    contactsList.appendChild(contactElement);
  });
});

// Show modal for new chat
window.showNewChatModal = async function() {
  const modal = document.getElementById('new-chat-modal');
  const usersList = document.getElementById('available-users');
  
  usersList.innerHTML = '<div class="loading">Loading users...</div>';
  modal.style.display = 'block';
  
  try {
    const q = query(collection(db, "users"), where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);
    
    usersList.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const user = doc.data();
      
      const userElement = document.createElement('div');
      userElement.className = 'user-to-chat';
      userElement.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/50'}" alt="${user.displayName}">
        <span>${user.displayName || user.email}</span>
      `;
      
      userElement.addEventListener('click', () => {
        window.location.href = `chat.html?userId=${user.uid}`;
      });
      
      usersList.appendChild(userElement);
    });
  } catch (error) {
    console.error("Error loading users:", error);
    usersList.innerHTML = '<div class="error">Failed to load users</div>';
  }
};

// Hide modal
window.hideModal = function(modalId) {
  document.getElementById(modalId).style.display = 'none';
};

// Logout function
window.logout = function() {
  signOut(auth).then(() => {
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error("Logout error:", error);
    alert("Failed to logout: " + error.message);
  });
};