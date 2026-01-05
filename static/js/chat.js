// Chat Manager
class ChatManager {
  constructor() {
    this.currentChat = null;
    this.chats = [];
    this.page = 0;
    this.loading = false;
    this.hasMore = true;

    // Initialize Socket.IO
    this.socket = io();
    this.setupSocketEvents();

    // Initialize UI
    this.setupUI();
    this.loadChats();
  }

  setupSocketEvents() {
    this.socket.on('new_message', (data) => {
      if (data.chat_key === this.currentChat?.key) {
        this.addMessageToUI(data.sender, data.message, data.time, false);
      }
      this.updateChatList();
    });

    this.socket.on('connect', () => {
      if (this.currentChat) {
        this.socket.emit('join_chat', this.currentChat.key);
      }
    });
  }

  setupUI() {
    // Chat list elements
    this.chatList = document.querySelector('.contacts-list');
    this.chatBody = document.querySelector('.chat-body');
    this.chatInput = document.querySelector('.chat-input');
    this.sendBtn = document.querySelector('.send-btn');
    this.searchInput = document.querySelector('.contacts-search input');

    // Event listeners
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Infinite scroll for chat list
    this.chatList.addEventListener('scroll', () => {
      if (this.chatList.scrollTop + this.chatList.clientHeight >= this.chatList.scrollHeight - 100 &&
          !this.loading && this.hasMore) {
        this.page++;
        this.loadChats();
      }
    });
  }

  async loadChats() {
    this.loading = true;
    try {
      const response = await fetch(`/api/chats?page=${this.page}`);
      const data = await response.json();

      if (data.chats.length === 0) {
        this.hasMore = false;
      } else {
        this.chats = [...this.chats, ...data.chats];
        this.renderChatList();
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      this.loading = false;
    }
  }

  renderChatList() {
    this.chatList.innerHTML = '';

    // Always show AI chat first
    const aiChat = this.chats.find(chat => chat.type === 'ai');
    if (aiChat) {
      this.renderChatItem(aiChat);
    }

    // Render other chats
    this.chats
      .filter(chat => chat.type !== 'ai')
      .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity))
      .forEach(chat => this.renderChatItem(chat));
  }

  renderChatItem(chat) {
    const chatItem = document.createElement('div');
    chatItem.className = `contact ${chat.key === this.currentChat?.key ? 'active' : ''}`;
    chatItem.dataset.chatKey = chat.key;

    let name, avatar;
    if (chat.type === 'ai') {
      name = 'AI Assistant';
      avatar = '<i class="fas fa-robot"></i>';
    } else if (chat.type === 'individual') {
      const otherId = chat.participants.find(id => id !== session.user_id);
      const otherUser = this.getUserInfo(otherId);
      name = otherUser?.name || `User ${otherId}`;
      avatar = otherUser?.profile_pic
        ? `<img src="${otherUser.profile_pic}" alt="${name}">`
        : `<i class="fas fa-user"></i>`;
    } else {
      // Group chat
      name = chat.type[0] || 'Group Chat';
      avatar = chat.type[1]
        ? `<img src="${chat.type[1]}" alt="${name}">`
        : `<i class="fas fa-users"></i>`;
    }

    chatItem.innerHTML = `
      <div class="contact-avatar">${avatar}</div>
      <div class="contact-info">
        <h4>${name}</h4>
        <p>${new Date(chat.last_activity).toLocaleString()}</p>
      </div>
      ${chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : ''}
    `;

    chatItem.addEventListener('click', () => this.openChat(chat));
    this.chatList.appendChild(chatItem);
  }

  async openChat(chat) {
    this.currentChat = chat;
    this.socket.emit('join_chat', chat.key);

    // Update UI
    document.querySelectorAll('.contact').forEach(item => {
      item.classList.toggle('active', item.dataset.chatKey === chat.key);
    });

    // Load messages
    try {
      const response = await fetch(`/api/chats/messages?key=${encodeURIComponent(chat.key)}`);
      const data = await response.json();

      this.chatBody.innerHTML = '';
      data.messages.forEach(msg => {
        this.addMessageToUI(msg.sender, msg.content, msg.time, msg.is_me, msg.name, msg.profile_pic);
      });

      // Scroll to bottom
      this.chatBody.scrollTop = this.chatBody.scrollHeight;
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  addMessageToUI(senderId, message, time, isMe, senderName, senderAvatar) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isMe ? 'user-message' : 'ai-message'}`;

    if (!isMe && senderName) {
      // Group chat message from others
      messageDiv.innerHTML = `
        <div class="message-sender">
          ${senderAvatar ? `<img src="${senderAvatar}" alt="${senderName}" class="sender-avatar">` : ''}
          <span class="sender-name">${senderName}</span>
        </div>
        <div class="message-content">${message}</div>
        <div class="message-time">${new Date(time).toLocaleTimeString()}</div>
      `;
    } else {
      // Individual chat or my message
      messageDiv.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${new Date(time).toLocaleTimeString()}</div>
      `;
    }

    this.chatBody.appendChild(messageDiv);
    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || !this.currentChat) return;

    this.chatInput.value = '';
    this.addMessageToUI(session.user_id, message, new Date().toISOString(), true);

    try {
      this.socket.emit('send_message', {
        chat_key: this.currentChat.key,
        message: message
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  updateChatList() {
    // Refresh chat list to update unread counts and order
    this.page = 0;
    this.chats = [];
    this.hasMore = true;
    this.loadChats();
  }

  getUserInfo(userId) {
    // Implement based on your user database
    // This should fetch from your Admin database key "employees"
    return {}; // Return {name, profile_pic, etc.}
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chatManager = new ChatManager();
});