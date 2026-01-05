var currentUser = {
    id: parseInt("{{ session.get('user_id', 0) }}"),
    username: "{{ session.get('username', '') }}"
};
let chatList = [];
let currentChat = null;
let socket = null;
let currentChatMessages = {};
let messageOffsets = {};
let currentChatKey = '';
const currentUserId = "{{ session['employee_id'] if session.get('is_employee') else session['username'] }}";

// Handle login modal
function setupLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const closeBtn = document.querySelector('#loginModal .close');
    const loginBtn = document.querySelector('.openLoginModal');

    if (!loginModal || !loginForm || !loginBtn) return; // Exit if elements don't exist

    // Open modal
    loginBtn.addEventListener('click', () => {
        loginModal.style.display = 'block';
        if (loginError) loginError.textContent = '';
        loginForm.reset();
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });

    // Close when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            const formData = new URLSearchParams();
            formData.append('username', document.getElementById('username').value);
            formData.append('password', document.getElementById('password').value);

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                loginModal.style.display = 'none';
                if (data.role === 'employee') {
                    sessionStorage.setItem('is_employee', 'true');
                    sessionStorage.setItem('user_id', data.employee_id);  // required for socket
                    sessionStorage.setItem('username', data.username);
                } else if (data.role === 'admin') {
                    sessionStorage.setItem('is_admin', 'true');
                    sessionStorage.setItem('username', data.username);
                }
                window.location.href = window.location.pathname + '?login=' + Date.now();
            } else {
                if (loginError) {
                    loginError.textContent = data.message || 'Login failed';

                    // Add shake effect
                    loginForm.classList.add('shake');
                    setTimeout(() => loginForm.classList.remove('shake'), 500);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            if (loginError) {
                loginError.textContent = 'Network error. Please try again.';

                // Add shake effect on network error too
                loginForm.classList.add('shake');
                setTimeout(() => loginForm.classList.remove('shake'), 500);
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Handle logout
function setupLogout() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('logoutBtn')) {
            fetch('/api/logout', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) window.location.reload();
                });
        }
    });
}
function setupProfileModal() {
    const profileModal = document.getElementById('profileModal');
    const profileForm = document.getElementById('profileForm');
    const profilePictureInput = document.getElementById('profilePicture');
    const profilePreview = document.getElementById('profilePreview');
    const profileUsername = document.getElementById('profileUsername');
    const profileError = document.getElementById('profileError');
    const profileSuccess = document.getElementById('profileSuccess');
    const openProfileModalBtn = document.querySelector('.openProfileModal');
    const closeProfileModalBtn = profileModal?.querySelector('.close');
    let cachedProfileData = null;

    if (!profileModal || !profileForm || !openProfileModalBtn) return;

    // Open profile modal
    openProfileModalBtn.addEventListener('click', async function() {
        try {
            // Only fetch if we don't have cached data
            if (!cachedProfileData) {
                const response = await fetch('/api/employee/profile', {
                    credentials: 'include'
                });
                cachedProfileData = await response.json();
            }

            if (cachedProfileData.success) {
                profileUsername.value = cachedProfileData.username || '';
                if (cachedProfileData.profile_picture) {
                    profilePreview.src = cachedProfileData.profile_picture;
                    // No need to update navbar here as it's already loaded
                }
            }
            profileModal.style.display = 'block';
        } catch (error) {
            console.error('Error loading profile:', error);
            profileModal.style.display = 'block';
        }
    });

    // Close profile modal
    closeProfileModalBtn.addEventListener('click', function() {
        profileModal.style.display = 'none';
    });

    // Profile picture preview
    profilePictureInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                profilePreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Save profile changes
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        profileError.textContent = '';
        profileSuccess.style.display = 'none';

        const formData = new FormData();
        formData.append('username', profileUsername.value);
        if (profilePictureInput.files[0]) {
            formData.append('profile_picture', profilePictureInput.files[0]);
        }

        const submitBtn = profileForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        fetch('/api/employee/profile', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                cachedProfileData = data;
                profileSuccess.textContent = 'Profile updated successfully!';
                profileSuccess.style.display = 'block';
                // Update profile pic in navbar
                if (data.profile_picture) {
                    document.getElementById('profilePic').src = data.profile_picture;
                }
                // Hide success message after 3 seconds
                setTimeout(() => {
                    profileSuccess.style.display = 'none';
                    profileModal.style.display = 'none';
                }, 3000);
            } else {
                profileError.textContent = data.message || 'Error updating profile';
                profileForm.classList.add('shake');
                setTimeout(() => profileForm.classList.remove('shake'), 500);
            }
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            profileError.textContent = 'Error updating profile';
            profileForm.classList.add('shake');
            setTimeout(() => profileForm.classList.remove('shake'), 500);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === profileModal) {
            profileModal.style.display = 'none';
        }
    });
}

function setupChat() {
  const chatToggleBtn = document.querySelector('.chat-toggle-btn');
  const chatContainer = document.querySelector('.chat-container');
  const closeChatBtn = document.querySelector('.close-chat-btn');
  const chatMenuBtn = document.querySelector('.chat-menu-btn');
  const contactsModal = document.querySelector('.contacts-modal');
  const closeContactsModal = document.querySelector('.close-contacts-modal');
  const contacts = document.querySelectorAll('.contact');
  const chatTitle = document.querySelector('.chat-title');
  const chatInput = document.querySelector('.chat-input');
  const sendBtn = document.querySelector('.send-btn');
  const chatBody = document.querySelector('.chat-body');
  const body = document.body;

  // Toggle chat panel
  chatToggleBtn.addEventListener('click', function() {
    body.classList.toggle('chat-active');
    // Move toggle button with chat panel
    chatToggleBtn.style.right = body.classList.contains('chat-active')
      ? '430px'
      : '30px';
  });

  // Close chat panel
  closeChatBtn.addEventListener('click', function() {
    body.classList.remove('chat-active');
    chatToggleBtn.style.right = '30px';
  });

  // Open contacts modal
  chatMenuBtn.addEventListener('click', function() {
    contactsModal.classList.add('active');
  });

  // Close contacts modal
  closeContactsModal.addEventListener('click', function() {
    contactsModal.classList.remove('active');
  });

  // Close modal when clicking outside
  contactsModal.addEventListener('click', function(e) {
    if (e.target === contactsModal) {
      contactsModal.classList.remove('active');
    }
  });
  document.querySelector('.contacts-list').addEventListener('click', (e) => {
    const contact = e.target.closest('.contact');
    if (!contact) return;

    const chatKey = contact.dataset.chatKey;
    openChat(chatKey);
  });



  // Load chat history
  function loadChatHistory(chatId) {
    chatBody.innerHTML = '';
    addMessage(`This is the beginning of your conversation`, 'system');
  }

  // Event listeners
  sendBtn.addEventListener('click', sendUserMessage);
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendUserMessage();
  });
}

function addMessage(content, senderId) {
    const chatBody = document.querySelector('.chat-body');
    if (!chatBody) {
        console.error('chat-body element not found');
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');

    if (parseInt(senderId) === parseInt(currentUser.id)) {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('other-message');
    }

    messageElement.innerHTML = `
      <div class="message-content">${content}</div>
      <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    chatBody.appendChild(messageElement);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function setupChatCreation() {
  console.log('Setting up chat creation...');

  const chatMenuBtn = document.querySelector('.chat-menu-btn');
  const createIndividualBtn = document.querySelector('.create-individual-chat');
  const createGroupBtn = document.querySelector('.create-group-chat');
  console.log('Individual button:', createIndividualBtn);
  console.log('Group button:', createGroupBtn);
  if (!createIndividualBtn || !createGroupBtn) {
      console.error('Chat creation buttons not found!');
      return;
  }
  // Get modal elements
  const individualModal = document.getElementById('individualChatModal');
  const groupModal = document.getElementById('groupChatModal');

  // Individual chat elements
  const userSearchInput = document.querySelector('#userSearchInput');
  const searchResults = individualModal.querySelector('.search-results');
  const selectedUser = individualModal.querySelector('.selected-user');

  // Group chat elements
  const groupUserSearch = document.querySelector('#groupUserSearch');
  const groupSearchResults = groupModal.querySelector('.group-search-results');
  const groupMembersContainer = groupModal.querySelector('.members-container');
  const groupNameInput = document.querySelector('#groupNameInput');

  // Group members set
  const groupMembers = new Set();

  // Open modals
  createIndividualBtn.addEventListener('click', () => {
    if (individualModal) {
        individualModal.style.display = 'block';
        // Clear previous selections
        selectedUser.innerHTML = '';
        userSearchInput.value = '';
        searchResults.innerHTML = '';
    }
  });

  createGroupBtn.addEventListener('click', () => {
        if (groupModal) {
            groupModal.style.display = 'block';
            // Clear previous selections
            groupMembers.clear();
            updateGroupMembersList();
            groupNameInput.value = '';
            groupUserSearch.value = '';
            groupSearchResults.innerHTML = '';
        }
  });

  // Close modals
  document.querySelectorAll('#individualChatModal .close, #groupChatModal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      this.closest('.modal').style.display = 'none';
    });
  });

  // Close when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === individualModal) {
      individualModal.style.display = 'none';
    }
    if (event.target === groupModal) {
      groupModal.style.display = 'none';
    }
  });
  async function searchUsers(query) {
        try {
            const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Search failed with status: ' + response.status);
            }

            return await response.json();
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }
  // Individual chat search
  userSearchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }

    try {
            const users = await searchUsers(query);
            console.log('Search results:', users);

            searchResults.innerHTML = users.map(user => `
                <div class="search-result" data-user-id="${user.id}">
                    <img src="${user.profile_pic || '/static/images/default_profile.png'}"
                         alt="${user.name}"
                         class="search-result-avatar">
                    <div class="search-result-info">
                        <div class="search-result-name">${user.name}</div>
                        <div class="search-result-type">${user.type}</div>
                    </div>
                </div>
            `).join('');

            // Add click handlers to search results - FIXED
            document.querySelectorAll('.search-result').forEach(result => {
                result.addEventListener('click', () => {
                    const userId = result.dataset.userId;
                    const userName = result.querySelector('.search-result-name').textContent;
                    const userPic = result.querySelector('img').src || '/static/images/default_profile.png';
                    const userType = result.querySelector('.search-result-type').textContent;

                    selectedUser.innerHTML = `
                        <div class="selected-user-card" data-user-id="${userId}">
                            <img src="${userPic}" alt="${userName}" class="selected-user-avatar">
                            <div class="selected-user-info">
                                <div class="selected-user-name">${userName}</div>
                                <div class="selected-user-type">${userType}</div>
                            </div>
                            <button class="remove-user">&times;</button>
                        </div>
                    `;

                    // Handle remove user
                    selectedUser.querySelector('.remove-user').addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectedUser.innerHTML = '';
                    });
                });
            });
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<div class="search-error">Failed to load results</div>';
        }
    }, 300));

  // Group chat user search
  groupUserSearch.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            groupSearchResults.innerHTML = '';
            return;
        }

        try {
            const users = await searchUsers(query);

            // Filter out already added members
            const filteredUsers = users.filter(user =>
                !groupMembers.has(user.id) && user.id !== currentUser.id
            );

            groupSearchResults.innerHTML = filteredUsers.map(user => `
                <div class="search-result" data-user-id="${user.id}">
                    <img src="${user.profile_pic || '/static/images/default_profile.png'}"
                         alt="${user.name}"
                         class="search-result-avatar">
                    <div class="search-result-info">
                        <div class="search-result-name">${user.name}</div>
                        <div class="search-result-type">${user.type}</div>
                    </div>
                    <button class="add-user">Add</button>
                </div>
            `).join('');

            // Add click handlers to "Add" buttons - FIXED
            document.querySelectorAll('.add-user').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const result = btn.closest('.search-result');
                    const userId = result.dataset.userId;
                    const userName = result.querySelector('.search-result-name').textContent;
                    const userPic = result.querySelector('img').src || '/static/images/default_profile.png';
                    const userType = result.querySelector('.search-result-type').textContent;

                    groupMembers.add(userId);
                    updateGroupMembersList();

                    // Clear search
                    groupUserSearch.value = '';
                    groupSearchResults.innerHTML = '';
                });
            });
        } catch (error) {
            console.error('Group search error:', error);
        }
    }, 300));

  // Update group members list
  function updateGroupMembersList() {
    groupMembersContainer.innerHTML = '';

    if (groupMembers.size === 0) {
      groupMembersContainer.innerHTML = '<p class="text-muted">No members added yet</p>';
      return;
    }

    // In a real app, you'd fetch user details from your database
    groupMembers.forEach(userId => {
      const memberElement = document.createElement('div');
      memberElement.className = 'group-member';
      memberElement.dataset.userId = userId;
      memberElement.innerHTML = `
        <span>User ${userId}</span>
        <button class="remove-member">&times;</button>
      `;

      memberElement.querySelector('.remove-member').addEventListener('click', () => {
        groupMembers.delete(userId);
        updateGroupMembersList();
      });

      groupMembersContainer.appendChild(memberElement);
    });
  }

  // Start 1-on-1 chat
  individualModal.querySelector('.start-chat-btn').addEventListener('click', async () => {
    const userId = parseInt(selectedUser.querySelector('.selected-user-card')?.dataset.userId);
    if (!userId || isNaN(userId)) {
        alert('Please select a valid user');
        return;
    }

    try {
      const response = await fetch('/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: [currentUser.id, userId],
          type: 'individual'
        }),
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok) {
        openChat(data.chat_key);
        individualModal.style.display = 'none';
        selectedUser.innerHTML = '';
        userSearchInput.value = '';
      } else {
        alert(data.error || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Error creating chat');
    }
  });

  // Create group chat
  groupModal.querySelector('.create-group-btn').addEventListener('click', async () => {
    if (groupMembers.size < 1) {
      alert('Please add at least one member');
      return;
    }

    const groupName = groupNameInput.value.trim() ||
                     `Group with ${groupMembers.size + 1} members`;

    try {
      const response = await fetch('/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          participants: [currentUser.id, ...groupMembers],
          type: 'group',
          group_name: groupName
        })
      });

      const text = await response.text();
      if (!response.ok) {
        console.error('Create group chat error response:', text);
        alert('Failed to create group chat: ' + text);
        return;
      }

      // Now parse JSON if ok
      const data = JSON.parse(text);

      openChat(data.chat_key);
      groupModal.style.display = 'none';
      groupMembers.clear();
      updateGroupMembersList();
      groupNameInput.value = '';
    } catch (error) {
      console.error('Error creating group chat:', error);
      alert('Error creating group chat');
    }
  });

  // Cancel buttons
  individualModal.querySelector('.cancel-chat-btn').addEventListener('click', () => {
    individualModal.style.display = 'none';
    selectedUser.innerHTML = '';
    userSearchInput.value = '';
  });

  groupModal.querySelector('.cancel-group-btn').addEventListener('click', () => {
    groupModal.style.display = 'none';
    groupMembers.clear();
    updateGroupMembersList();
    groupNameInput.value = '';
    groupUserSearch.value = '';
  });

  // Initialize empty members list
  updateGroupMembersList();
}

// Utility function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
// Chat Management

function initUserSession() {
    if (typeof currentUser === 'undefined') {
        currentUser = {
            id: parseInt("{{ session.get('user_id', 0) }}"),
            username: "{{ session.get('username', '') }}"
        };
    } else {
        // If already exists, just update it
        currentUser.id = parseInt("{{ session.get('user_id', 0) }}");
        currentUser.username = "{{ session.get('username', '') }}";
    }
}

// Initialize chat system
function initChatSystem() {
    setupSocketIO();
    loadChatList(); // Call your API to load chat list
    setupChatPanel(); // Manage click events, panel show/hide
    setupMessageSending(); // Send on button click or Enter
    setupReceiveMessages(); // WebSocket listener for 'new_message'
}

function setupChatPanel() {
    console.log("Chat panel setup placeholder — not implemented yet.");
}
function setupMessageSending() {
  // TODO: Add logic to handle sending messages via button or Enter key
  console.log('setupMessageSending called');
}

function setupReceiveMessages() {
  // TODO: Add WebSocket or polling logic to listen for new messages
  console.log('setupReceiveMessages called');
}

// Load chat list with pagination
function loadChatList(offset = 0, limit = 10) {
    fetch(`/api/chats?offset=${offset}&limit=${limit}`, {
        credentials: 'include'
    })
    .then(res => {
        if (res.status === 401) return { chats: [] };
        return res.json();
    })
    .then(data => {
        if (data && data.chats) {
            chatList = data.chats;
            renderChatList();
        }
    })
    .catch(error => console.error('Error loading chat list:', error));
}
function updateUnreadCounts() {
    document.querySelectorAll('.contact').forEach(contact => {
        const chatKey = contact.dataset.chatKey;
        const unreadBadge = contact.querySelector('.unread-badge') || document.createElement('div');

        if (currentChatMessages[chatKey]?.unread > 0) {
            unreadBadge.className = 'unread-badge';
            unreadBadge.textContent = currentChatMessages[chatKey].unread;
            if (!contact.contains(unreadBadge)) {
                contact.appendChild(unreadBadge);
            }
        } else if (contact.contains(unreadBadge)) {
            unreadBadge.remove();
        }
    });
}
function renderChatList() {
    const contactsList = document.querySelector('.contacts-list');
    contactsList.innerHTML = '';

    if (!chatList || chatList.length === 0) {
        contactsList.innerHTML = '<div class="no-chats">No chats available</div>';
        return;
    }

    // Render other chats
    chatList
        .filter(chat => chat.type !== 'ai')
        .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity))
        .forEach(chat => {
            const chatElement = createContactElement(chat); // ← this line must exist
            contactsList.appendChild(chatElement);
        });
    updateUnreadCounts();
    setInterval(updateUnreadCounts, 5000);
}

function createContactElement(chat) {
    const div = document.createElement('div');
    div.classList.add('contact');
    if (chat.type === 'group') {
        div.classList.add('group-chat');
    }
    div.dataset.chatKey = chat.key;
    div.dataset.chatName = chat.name || `Chat ${chat.key.slice(0, 6)}`;

    // Add group chat identifier if needed
    if (chat.type === 'group') {
        div.classList.add('group-chat');
    }

    const displayName = chat.name || (chat.type === 'individual' ?
        `User ${chat.other_id}` : `Group ${chat.key.slice(0, 6)}`);

    div.innerHTML = `
        <img src="${chat.picture}" alt="${displayName}" class="contact-avatar">
        <div class="contact-info">
            <div class="contact-name">${displayName}</div>
            <div class="contact-preview">${getLastMessagePreview(chat.key)}</div>
        </div>
        ${chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : ''}
    `;

    return div;
}

// Open a chat
// --- Helper: sanitize output
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Helper: render messages (canonical shape: { sender, content, time })
function renderMessagesFromArray(messages, chatType = 'individual') {
  const chatBody = document.querySelector('.chat-body');
  if (!chatBody) return;

  chatBody.innerHTML = '';
  let lastSender = null;
  let lastDateLabel = null;

  const msgs = Array.isArray(messages) ? messages : [];
  const isGroup = chatType === 'group';

  const sessionUserId = String(sessionStorage.getItem('user_id') ?? currentUser?.id ?? '');

  msgs.forEach((m, idx) => {
    const content = m.content ?? m.text ?? m.message ?? '';
    const time = m.time ?? m.timestamp ?? '';
    const username = (m.username ?? '').toString();
    const senderId = String(m.sender ?? '');
    const isMe = Boolean(m.is_me) || senderId === sessionUserId;

    // date separator
    const msgDate = time ? new Date(time) : null;
    const dateLabel = msgDate ? formatMessageDate(msgDate) : '';
    if (dateLabel && dateLabel !== lastDateLabel) {
      const dateSeparator = document.createElement('div');
      dateSeparator.className = 'date-separator';
      dateSeparator.textContent = dateLabel;
      chatBody.appendChild(dateSeparator);
      lastDateLabel = dateLabel;
      lastSender = null;
    }

    // container
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', isMe ? 'user-message' : 'other-message');

    // --- show username above first message in a block (group chats only) ---
    if (isGroup && !isMe && senderId !== lastSender && username) {
      const usernameDiv = document.createElement('div');
      usernameDiv.className = 'message-username';
      usernameDiv.textContent = username;
      msgDiv.appendChild(usernameDiv);
    }

    // message text
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    msgDiv.appendChild(contentDiv);

    // timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = time ? new Date(time).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit'
    }) : '';
    msgDiv.appendChild(timeDiv);

    chatBody.appendChild(msgDiv);

    lastSender = senderId;
  });

  chatBody.scrollTop = chatBody.scrollHeight;
}



// --- Helper functions ---
function formatMessageDate(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  const daysDiff = (today - date) / (1000 * 60 * 60 * 24);
  if (daysDiff < 7 && daysDiff > 1) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}


// --- Unified openChat (fetch + normalize + render + join socket)
async function openChat(chatKey, fallbackName = "Chat") {
  console.groupCollapsed(`[openChat] Loading chat ${chatKey}`);
  try {
    // Debug current state
    console.log("Current user:", {
      id: currentUser?.id,
      sessionId: sessionStorage.getItem('user_id')
    });
    console.log("Current chat key:", chatKey);

    currentChat = chatKey;
    messageOffsets[chatKey] = 0;

    const chatBody = document.querySelector('.chat-body');
    if (!chatBody) {
      console.error("Chat body element not found!");
      return;
    }

    // Show loading state
    chatBody.innerHTML = '<div class="loading">Loading messages...</div>';
    document.querySelector('.contacts-modal')?.classList.remove('active');
    document.querySelector('.chat-title').textContent = fallbackName;

    // Fetch messages with cache busting
    const url = `/api/chats/${encodeURIComponent(chatKey)}/messages?_=${Date.now()}`;
    console.log("Fetching:", url);

    const startTime = performance.now();
    const response = await fetch(url, { credentials: 'include' });
    const fetchTime = performance.now() - startTime;

    console.log(`Response received in ${fetchTime.toFixed(1)}ms`, response);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("Response data:", data);
    const chatType = data.chat_type || (chatKey.startsWith('group_') ? 'group' : 'individual');
    console.log("Rendering messages with chatType:", chatType);
    // Normalize messages with better error handling
    const rawMessages = data.messages ?? data ?? [];
    const normalized = [];

    const sessionUserId = String(sessionStorage.getItem('user_id') ?? currentUser?.id ?? '');
    for (const m of rawMessages) {
      try {
        const senderRaw = m.sender ?? m.sender_id ?? m.from ?? m.user ?? '';
        const sender = String(senderRaw);
        const content = m.content ?? m.text ?? m.message ?? '';
        const time = m.time ?? m.timestamp ?? m.ts ?? new Date().toISOString();

        // prefer server-provided username, fall back to empty
        const username = m.username ?? m.user_name ?? m.name ?? '';

        // determine is_me robustly
        const is_me = Boolean(m.is_me) || (sender !== '' && sender === sessionUserId);

        normalized.push({
          sender: sender,
          content: content,
          time: time,
          username: username,
          is_me: is_me,
          _raw: JSON.stringify(m)
        });
      } catch (e) {
        console.warn("Failed to normalize message:", m, e);
      }
    }

    console.log(`Normalized ${normalized.length} messages`, normalized.slice(0, 3));

    // Update state and render
    currentChatMessages[chatKey] = normalized;
    renderMessagesFromArray(normalized, chatType);

    // Socket.io connection
    if (socket?.connected) {
      console.log("Joining socket room:", chatKey);
      socket.emit('join_chat', chatKey, (ack) => {
        console.log("Socket join acknowledgement:", ack);
      });
    }

    // Update chat list if needed
    if (!chatList.some(c => c.key === chatKey)) {
      console.log("Adding new chat to list");
      chatList.push({
        key: chatKey,
        name: fallbackName,
        last_activity: normalized[normalized.length - 1]?.time
      });
      renderChatList();
    }

  } catch (error) {
    console.error("Chat load failed:", error);
    const chatBody = document.querySelector('.chat-body');
    if (chatBody) {
      chatBody.innerHTML = `
        <div class="error-message">
          Failed to load chat<br>
          <small>${error.message}</small>
        </div>
      `;
    }
  } finally {
    console.groupEnd();
  }
}

async function loadMessages(chatKey, offset, limit, prepend = false) {
    try {
        const response = await fetch(
            `/api/chats/${encodeURIComponent(chatKey)}/messages?offset=${offset}&limit=${limit}`,
            { credentials: 'include' }
        );

        const data = await response.json();
        if (data.error) return;

        // Initialize if new chat
        if (!currentChatMessages[chatKey]) {
            currentChatMessages[chatKey] = [];
        }

        if (prepend) {
            // Add older messages to the top
            currentChatMessages[chatKey] = [...data.messages, ...currentChatMessages[chatKey]];
        } else {
            // New chat or first load
            currentChatMessages[chatKey] = data.messages;
        }

        renderMessages(chatKey, data.chat_type);
        messageOffsets[chatKey] = offset + data.messages.length;
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

// Render messages in chat
function renderMessages(chatKey, chatType) {
    const chatBody = document.querySelector('.chat-body');
    const wasAtBottom = isScrolledToBottom(chatBody);

    // Save scroll position
    const oldScrollHeight = chatBody.scrollHeight;
    const oldScrollTop = chatBody.scrollTop;

    // Clear only if not prepending
    if (messageOffsets[chatKey] === currentChatMessages[chatKey].length) {
        chatBody.innerHTML = '';
    }

    // Set class for group/individual styling
    chatBody.className = 'chat-body ' + (chatType === 'group' ? 'group-chat' : 'individual-chat');

    // Create message elements
    const fragment = document.createDocumentFragment();
    currentChatMessages[chatKey].forEach(msg => {
        const messageElement = createMessageElement(msg, chatType);
        fragment.appendChild(messageElement);
    });

    // Add to chat body
    chatBody.appendChild(fragment);

    // Restore scroll position if prepending
    if (messageOffsets[chatKey] > 20) {
        const newScrollHeight = chatBody.scrollHeight;
        chatBody.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
    }
    // Scroll to bottom for new messages
    else if (wasAtBottom) {
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // Add infinite scroll handler
    chatBody.onscroll = () => {
        if (chatBody.scrollTop === 0 && currentChatMessages[chatKey]?.length >= messageOffsets[chatKey]) {
            loadMessages(chatKey, messageOffsets[chatKey], 20, true);
        }
    };
}
function isScrolledToBottom(element) {
    return element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
}
function createMessageElement(msg, chatType) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${msg.is_me ? 'outgoing' : 'incoming'}`;

    if (chatType === 'individual') {
        messageElement.innerHTML = `
            <div class="message-content">${msg.content}</div>
            <div class="message-time">${formatTime(msg.time)}</div>
        `;
    } else {
        messageElement.innerHTML = `
            <img src="${msg.picture}" alt="${msg.name}" class="message-avatar">
            <div class="message-details">
                <div class="message-sender">${msg.name}</div>
                <div class="message-content">${msg.content}</div>
                <div class="message-time">${formatTime(msg.time)}</div>
            </div>
        `;
    }

    return messageElement;
}
function setupChatSelection() {
    // Handle clicks from both contacts list and search results
    document.querySelector('.contacts-list').addEventListener('click', async (e) => {
        const contact = e.target.closest('.contact, .result-item');
        if (!contact) return;

        e.stopPropagation(); // Prevent event bubbling issues

        const chatKey = contact.dataset.chatKey;
        const chatName = contact.dataset.chatName || contact.dataset.name || "Chat";

        console.log(`[CHAT SELECTION] Opening chat: ${chatKey} (${chatName})`);

        // Close contacts modal if open
        document.querySelector('.contacts-modal')?.classList.remove('active');

        // Update active state
        document.querySelectorAll('.contact, .result-item').forEach(c => {
            c.classList.remove('active');
        });
        contact.classList.add('active');

        // Update chat title
        document.querySelector('.chat-title').textContent = chatName;

        // Open the chat
        await openChat(chatKey, chatName);
    });
}

// Setup WebSocket connection
// Setup WebSocket connection
function setupSocketIO() {
    const userId = sessionStorage.getItem('user_id');
    const username = sessionStorage.getItem('username');

    if (!userId) {
        console.error("No user_id in sessionStorage, cannot connect socket.");
        return;
    }

    socket = io(window.location.origin, {
        auth: {
            user_id: userId,
            username: username
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('Socket.IO connected');
        if (currentChat) {
            socket.emit('join_chat', currentChat);
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        setTimeout(() => socket.connect(), 2000);
    });

    socket.on('new_message', data => {
      if (data.chat_key === currentChat) {
        // For new messages, we need to determine if we should show the username
        const isMe = parseInt(data.sender) === parseInt(currentUser.id);
        const isGroup = currentChat.startsWith('group_'); // or however you identify group chats

        // Get the last message in the chat to check if same sender
        const messages = currentChatMessages[currentChat] || [];
        const lastMessage = messages[messages.length - 1];
        const showUsername = isGroup && !isMe &&
                             (!lastMessage || lastMessage.sender !== data.sender);

        // Create message element
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', isMe ? 'user-message' : 'other-message');

        if (showUsername) {
          const senderDiv = document.createElement('div');
          senderDiv.className = 'message-sender';
          senderDiv.textContent = data.username || 'Unknown';
          msgDiv.appendChild(senderDiv);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = data.message;
        msgDiv.appendChild(contentDiv);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        msgDiv.appendChild(timeDiv);

        document.querySelector('.chat-body').appendChild(msgDiv);
        document.querySelector('.chat-body').scrollTop = document.querySelector('.chat-body').scrollHeight;
      } else {
        const chatItem = chatList.find(c => c.key === data.chat_key);
        if (chatItem) {
          chatItem.unread = (chatItem.unread || 0) + 1;
          renderChatList();
        }
      }
    });
}

// Send message
function sendUserMessage() {
    const input = document.querySelector('.chat-input');
    const message = input.value.trim();

    if (message && currentChat && socket) {
        console.log("Sending message to:", currentChat);

        socket.emit('send_message', {
            chat_key: currentChat,
            message: message
        }, (ack) => {
            if (ack && ack.success) {
                console.log("Message saved successfully");
                input.value = '';
            } else {
                console.error("Failed to save message:", ack?.error || 'Unknown error');
                // Keep message in input field for retry
                alert('Message failed to send. Please try again.');
            }
        });
    }
}

// Setup infinite scroll for chat list
function setupInfiniteScroll() {
    const contactsList = document.querySelector('.contacts-list');

    contactsList.addEventListener('scroll', () => {
        if (contactsList.scrollTop + contactsList.clientHeight >= contactsList.scrollHeight - 100) {
            loadChatList(chatList.length, 10);
        }
    });
}

function switchChat(chatKey, displayName, profilePic = null) {
    currentChat = chatKey;

    // ✅ Join the socket room for real-time updates
    if (socket) {
        socket.emit('join_chat', chatKey);
    }
    const chatTitle = document.querySelector('.chat-title');
    const chatBody = document.querySelector('.chat-body');

    // 1. Update chat title
    chatTitle.textContent = displayName;

    // 2. Clear old messages
    chatBody.innerHTML = '<div class="loading">Loading messages...</div>';

    // 3. Fetch messages for this chat
    fetch(`/api/messages/${chatKey}`, {
        credentials: 'include'
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to load messages");
        return res.json();
    })
    .then(data => {
        chatBody.innerHTML = ''; // Clear loading text
        if (!data.messages || data.messages.length === 0) {
            chatBody.innerHTML = '<div class="no-messages">No messages yet</div>';
            return;
        }

        // 4. Render messages
        data.messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('chat-message');
            if (msg.sender_id === currentUser.id) {
                msgDiv.classList.add('my-message');
            } else {
                msgDiv.classList.add('their-message');
            }

            msgDiv.innerHTML = `
                <div class="message-content">${msg.content}</div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            `;
            chatBody.appendChild(msgDiv);
        });

        // 5. Scroll to bottom
        chatBody.scrollTop = chatBody.scrollHeight;
    })
    .catch(err => {
        console.error('Failed to switch chat:', err);
        chatBody.innerHTML = '<div class="error-message">Could not load chat.</div>';
    });
}

function loadChatMessages(chatKey) {
    fetch(`/api/chats/${chatKey}/messages`, {
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const chatBody = document.querySelector('.chat-body');
        chatBody.innerHTML = '';

        if (data.success && data.messages.length > 0) {
            data.messages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.classList.add('chat-message');
                msgDiv.classList.add(msg.sender === 'you' ? 'user-message' : 'ai-message');

                msgDiv.innerHTML = `
                    <div class="message-content">${msg.text}</div>
                    <div class="message-time">${msg.time}</div>
                `;
                chatBody.appendChild(msgDiv);
            });
        } else {
            chatBody.innerHTML = '<div class="no-messages">No messages yet</div>';
        }
    })
    .catch(err => {
        console.error('Failed to load messages:', err);
    });
}

function setupContactSearch() {
    const searchInput = document.getElementById("contactsSearchInput");
    const resultsContainer = document.querySelector(".contacts-search-results");

    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener("input", async function () {
        const query = this.value.trim();

        if (!query) {
            resultsContainer.innerHTML = "";
            resultsContainer.style.display = "none";
            return;
        }

        try {
            const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
            const users = await response.json();

            resultsContainer.innerHTML = "";
            resultsContainer.style.display = "block";

            if (users.length === 0) {
                resultsContainer.innerHTML = "<p>No users found.</p>";
                return;
            }

            users.forEach(user => {
                const div = document.createElement("div");
                div.className = "search-result-item";
                div.innerHTML = `
                    <img src="${user.profile_pic}" alt="Profile" class="search-result-img">
                    <div class="search-result-info">
                        <strong>${user.name}</strong><br>
                        <small>${user.username}</small>
                        <span class="badge">${user.role}</span>
                    </div>
                `;

                div.addEventListener("click", () => {
                    openChatWith(user.id, user.role, user.name);
                    searchInput.value = "";
                    resultsContainer.innerHTML = "";
                    resultsContainer.style.display = "none";
                });

                resultsContainer.appendChild(div);
            });
        } catch (err) {
            console.error("Search error:", err);
        }
    });
}
async function openChatWith(userId, role, displayName) {
    try {
        // Call backend API to get or create a chat key for currentUser and userId
        const response = await fetch(`/api/chats/get-or-create?user_id=${userId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success && data.chat_key) {
            // Use your existing openChat function to switch UI to that chat
            currentChat = data.chat_key; // ✅ set active chat
            if (socket) {
                socket.emit('join_chat', currentChat); // ✅ join room
            }
            await openChat(data.chat_key, displayName);
        } else {
            console.error('Failed to get or create chat:', data.error || 'Unknown error');
        }
    } catch (err) {
        console.error('Error opening chat with user:', err);
    }
}

function setupBasicChatControls() {
    const chatToggleBtn = document.querySelector('.chat-toggle-btn');
    const closeChatBtn = document.querySelector('.close-chat-btn');
    const chatMenuBtn = document.querySelector('.chat-menu-btn');
    const closeContactsModal = document.querySelector('.close-contacts-modal');
    const chatInput = document.querySelector('.chat-input');
    const sendBtn = document.querySelector('.send-btn');
    const body = document.body;
    const contactsModal = document.querySelector('.contacts-modal');

    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', function() {
            body.classList.toggle('chat-active');
            chatToggleBtn.style.right = body.classList.contains('chat-active') ? '380px' : '20px';
        });
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', function() {
            body.classList.remove('chat-active');
            if (chatToggleBtn) chatToggleBtn.style.right = '20px';
        });
    }

    if (chatMenuBtn && contactsModal) {
        chatMenuBtn.addEventListener('click', function() {
            contactsModal.classList.add('active');
        });
    }

    if (closeContactsModal && contactsModal) {
        closeContactsModal.addEventListener('click', function() {
            contactsModal.classList.remove('active');
        });
    }

    if (chatInput && sendBtn) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendUserMessage();
        });

        sendBtn.addEventListener('click', sendUserMessage);
    }
}

// Helper functions
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getLastMessagePreview(chatKey) {
    // In a real implementation, you'd fetch or cache this
    return 'Last message preview...';
}

function searchUsers(query) {
    const resultsBox = document.querySelector('.contacts-search-results');
    const listBox = document.querySelector('.contacts-list');

    if (!query.trim()) {
        resultsBox.style.display = 'none';
        listBox.style.display = 'block';
        return;
    }

    // Detect user type from currentUser object
    const userType = currentUser.is_admin ? 'admin' : 'employee';

    fetch(`/api/search-users?q=${encodeURIComponent(query)}&user_type=${userType}`)
        .then(res => {
            if (!res.ok) throw new Error('Unauthorized or Server error');
            return res.json();
        })
        .then(users => {
            if (!Array.isArray(users)) throw new Error('Invalid response format');

            resultsBox.innerHTML = '';
            users.forEach(user => {
                const div = document.createElement('div');
                const label = user.username || user.id;
                div.className = 'contact';
                div.textContent = `${user.name} (${label})`;
                div.addEventListener('click', () => {
                    openChatWith(user.id || user.username);
                });
                resultsBox.appendChild(div);
            });

            resultsBox.style.display = 'block';
            listBox.style.display = 'none';
        })
        .catch(err => {
            console.error('Search error:', err);
            resultsBox.style.display = 'none';
            listBox.style.display = 'block';
        });
}

function selectUser(userId, name) {
    const selected = document.getElementById('selectedUser');
    selected.value = userId;
    document.getElementById('searchUserInput').value = name;
    document.getElementById('searchUserResults').innerHTML = '';
}


// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const profileResponse = await fetch('/api/employee/profile', {
            credentials: 'include'
        });
        const profileData = await profileResponse.json();

        if (profileData.success && profileData.profile_picture) {
            document.getElementById('profilePic').src = profileData.profile_picture;
        }
    } catch (error) {
        console.error('Initial profile load error:', error);
    }
    setupLoginModal();
    setupLogout();
    setupProfileModal();
    setupBasicChatControls();
    setupChatCreation();
    setupContactSearch();
    setupChatSelection();

    function setupPasswordReset() {
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const backToLoginLink = document.getElementById('backToLoginLink');
        const loginForm = document.getElementById('loginForm');
        const passwordResetForm = document.getElementById('passwordResetForm');
        const resetUsername = document.getElementById('resetUsername');
        const resetError = document.getElementById('resetError');
        const resetSuccess = document.getElementById('resetSuccess');

        if (!forgotPasswordLink || !backToLoginLink || !loginForm || !passwordResetForm) {
            console.warn('Password reset elements not found');
            return;
        }

        // Toggle between login and password reset forms
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            passwordResetForm.style.display = 'block';
            resetError.textContent = '';
            resetSuccess.textContent = '';
            resetUsername.focus();
        });

        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            passwordResetForm.style.display = 'none';
            loginForm.style.display = 'block';
            resetError.textContent = '';
            resetSuccess.textContent = '';
        });

        // Handle password reset form submission
        passwordResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('resetUsername');
            const username = usernameInput.value.trim();
            const resetError = document.getElementById('resetError');
            const resetSuccess = document.getElementById('resetSuccess');
            const submitBtn = e.target.querySelector('button[type="submit"]');

            // Reset UI state
            resetError.textContent = '';
            resetSuccess.textContent = '';
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';

            try {
                // Validate input
                if (!username) {
                    throw new Error('Employee ID is required');
                }
                if (!/^\d+$/.test(username)) {
                    throw new Error('Employee ID must be a number');
                }

                const response = await fetch('/reset_password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ username }),
                });

                // Handle HTTP errors
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Password reset failed');
                }

                // Success case
                resetSuccess.textContent = result.message;
                usernameInput.value = '';

            } catch (error) {
                console.error('Password reset error:', error);
                resetError.textContent = error.message;

                // Special handling for development
                if (error.response) {
                    console.debug('Full error response:', error.response);
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Initialize password reset
    setupPasswordReset();

    try {
        const response = await fetch('/api/check_session', {
            credentials: 'include'
        });
        const sessionData = await response.json();

        if (sessionData.is_employee || sessionData.is_admin) {
            // Save session data to sessionStorage for socket use
            sessionStorage.setItem('username', sessionData.username);

            if (sessionData.is_employee) {
                sessionStorage.setItem('user_id', sessionData.user_id);  // only employees have numeric ID
            } else {
                sessionStorage.setItem('user_id', sessionData.username); // fallback for admins
            }

            currentUser = {
              id: String(sessionData.user_id ?? sessionData.employee_id ?? sessionData.username ?? ''),
              username: String(sessionData.username ?? sessionData.user_id ?? ''),
              is_employee: !!sessionData.is_employee,
              is_admin: !!sessionData.is_admin
            };
            sessionStorage.setItem('user_id', String(currentUser.id));
            sessionStorage.setItem('username', currentUser.username);
            console.log('Normalized currentUser set:', currentUser);

            // Load profile if available
            if (sessionData.is_employee) {
                try {
                    const profileResponse = await fetch('/api/employee/profile', {
                        credentials: 'include'
                    });
                    const profileData = await profileResponse.json();

                    if (profileData.success && profileData.profile_picture) {
                        document.getElementById('profilePic').src = profileData.profile_picture;
                    }
                } catch (profileError) {
                    console.error('Profile load error:', profileError);
                }
            }

            // Initialize chat system if valid user
            if (currentUser.id > 0) {
                console.log('Initializing chat system for user:', currentUser);
                initChatSystem();
            }
        }
        if (currentUser === null) {
            currentUser = {
                id: 0,
                username: '',
                is_employee: false,
                is_admin: false
            };
        }
        // Update UI elements based on session
        const anyUserElement = document.querySelector('#any-user-message');
        const employeeElement = document.querySelector('#employee-message');

        if (sessionData.is_admin || sessionData.is_employee) {
            if (anyUserElement) anyUserElement.style.display = 'block';
            if (sessionData.is_employee && employeeElement) {
                employeeElement.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Failed to check login status:', error);
    }
    setTimeout(() => {
        console.log("All contact elements:", document.querySelectorAll('.contact'));
        document.querySelectorAll('.contact').forEach(contact => {
            console.log(`Contact ${contact.dataset.chatKey}:`, {
                key: contact.dataset.chatKey,
                name: contact.dataset.chatName,
                classes: contact.className,
                html: contact.outerHTML
            });
        });
    }, 1000);
});