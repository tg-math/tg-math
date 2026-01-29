// chat.js - P2P Chat System for TG-Math (No Backend Required)

class P2PChatSystem {
    constructor() {
        this.messages = [];
        this.activeUsers = new Map();
        this.userId = this.getOrCreateUserId();
        this.userName = this.getStoredUsername() || this.generateUsername();
        this.lastPollTime = 0;
        this.pollingInterval = 3000; // Check every 3 seconds
        this.maxMessages = 100;
        this.maxUsers = 50;
        
        // Storage keys
        this.chatStorageKey = 'tgmath_p2p_chat_v3';
        this.usersStorageKey = 'tgmath_chat_users_v3';
        this.syncStorageKey = 'tgmath_chat_sync_v3';
        
        this.init();
    }
    
    init() {
        console.log('Initializing P2P Chat System...');
        console.log('User ID:', this.userId);
        console.log('Username:', this.userName);
        
        this.loadMessages();
        this.setupEventListeners();
        this.startPolling();
        this.updateUserPresence();
        
        // Show welcome message
        setTimeout(() => {
            if (this.messages.length === 0) {
                this.addSystemMessage('Welcome to TG-Math P2P Chat!');
                this.addSystemMessage('This chat works without servers');
                this.addSystemMessage('Share the link with friends to chat together');
            }
        }, 1000);
    }
    
    getOrCreateUserId() {
        let userId = localStorage.getItem('tgmath_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('tgmath_user_id', userId);
            console.log('Created new user ID:', userId);
        }
        return userId;
    }
    
    generateUsername() {
        const colors = ['Red', 'Blue', 'Green', 'Purple', 'Orange', 'Pink', 'Cyan', 'Lime'];
        const animals = ['Fox', 'Wolf', 'Tiger', 'Eagle', 'Shark', 'Dragon', 'Phoenix', 'Lion'];
        const num = Math.floor(Math.random() * 999) + 1;
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        const animal = animals[Math.floor(Math.random() * animals.length)];
        
        const username = `${color}${animal}${num}`;
        this.storeUsername(username);
        return username;
    }
    
    storeUsername(username) {
        localStorage.setItem('tgmath_username', username);
    }
    
    getStoredUsername() {
        return localStorage.getItem('tgmath_username');
    }
    
    addSystemMessage(text) {
        const message = {
            id: 'sys_' + Date.now(),
            userId: 'system',
            userName: '💬 System',
            message: text,
            timestamp: Date.now(),
            color: '#ff9900',
            isSystem: true
        };
        
        this.messages.push(message);
        this.displayMessage(message);
        this.saveChatData();
    }
    
    sendMessage(text) {
        if (!text || !text.trim()) {
            console.log('Empty message, not sending');
            return false;
        }
        
        text = text.trim().substring(0, 200);
        
        // Check rate limiting (3 messages per 10 seconds)
        const recentMessages = this.messages.filter(m => 
            m.userId === this.userId && 
            Date.now() - m.timestamp < 10000
        );
        
        if (recentMessages.length >= 3) {
            this.addSystemMessage('⏳ Please wait before sending more messages');
            return false;
        }
        
        const message = {
            id: 'msg_' + Date.now() + '_' + this.userId,
            userId: this.userId,
            userName: this.userName,
            message: text,
            timestamp: Date.now(),
            color: this.getUserColor(this.userId),
            isSystem: false
        };
        
        console.log('Sending message:', message);
        
        // Add to local array
        this.messages.push(message);
        
        // Display immediately
        this.displayMessage(message);
        
        // Save to shared storage
        this.saveChatData();
        
        // Update presence
        this.updateUserPresence();
        
        // Trigger sync for other tabs
        this.triggerSync();
        
        return message.id;
    }
    
    saveChatData() {
        try {
            // Prepare chat data
            const chatData = {
                messages: this.messages.slice(-this.maxMessages),
                lastUpdated: Date.now(),
                updatedBy: this.userId,
                version: '3.0'
            };
            
            // Save to localStorage
            localStorage.setItem(this.chatStorageKey, JSON.stringify(chatData));
            
            // Also update sync timestamp
            localStorage.setItem(this.syncStorageKey, Date.now().toString());
            
            console.log('Chat data saved, total messages:', this.messages.length);
            
        } catch (error) {
            console.error('Error saving chat data:', error);
            
            // If storage is full, clear old messages
            if (error.name === 'QuotaExceededError') {
                this.clearOldMessages();
                this.saveChatData(); // Retry
            }
        }
    }
    
    loadMessages() {
        try {
            const saved = localStorage.getItem(this.chatStorageKey);
            if (saved) {
                const chatData = JSON.parse(saved);
                
                if (chatData.messages && Array.isArray(chatData.messages)) {
                    // Filter out very old messages (older than 7 days)
                    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                    const freshMessages = chatData.messages.filter(msg => 
                        msg.timestamp > sevenDaysAgo
                    );
                    
                    // Merge with existing messages, avoiding duplicates
                    const existingIds = new Set(this.messages.map(m => m.id));
                    const newMessages = freshMessages.filter(msg => !existingIds.has(msg.id));
                    
                    if (newMessages.length > 0) {
                        console.log('Loaded', newMessages.length, 'new messages');
                        this.messages.push(...newMessages);
                        
                        // Sort by timestamp
                        this.messages.sort((a, b) => a.timestamp - b.timestamp);
                        
                        // Keep within limit
                        if (this.messages.length > this.maxMessages * 2) {
                            this.messages = this.messages.slice(-this.maxMessages);
                        }
                        
                        // Display all loaded messages
                        this.displayAllMessages();
                    }
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            // Clear corrupted data
            localStorage.removeItem(this.chatStorageKey);
        }
    }
    
    startPolling() {
        // Initial poll
        setTimeout(() => this.pollForUpdates(), 1000);
        
        // Regular polling
        setInterval(() => this.pollForUpdates(), this.pollingInterval);
    }
    
    pollForUpdates() {
        try {
            // Check if chat data was updated by others
            const lastSync = parseInt(localStorage.getItem(this.syncStorageKey) || '0');
            
            if (lastSync > this.lastPollTime) {
                console.log('New data detected, loading...');
                this.loadMessages();
                this.lastPollTime = lastSync;
                
                // Update user presence
                this.updateUserPresence();
                
                // Show notification if chat is closed
                if (!this.isChatVisible()) {
                    this.showNotification();
                }
            }
            
            // Load users
            this.loadActiveUsers();
            
        } catch (error) {
            console.error('Error polling for updates:', error);
        }
    }
    
    loadActiveUsers() {
        try {
            const usersData = localStorage.getItem(this.usersStorageKey);
            if (usersData) {
                const users = JSON.parse(usersData);
                
                // Filter active users (last seen within 2 minutes)
                const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
                const activeUsers = Object.entries(users)
                    .filter(([_, user]) => user.lastSeen > twoMinutesAgo)
                    .map(([id, user]) => ({ id, ...user }));
                
                // Update UI
                this.updateOnlineCount(activeUsers.length);
                
                // Store active users
                this.activeUsers = new Map(activeUsers.map(user => [user.id, user]));
                
            }
        } catch (error) {
            console.error('Error loading active users:', error);
        }
    }
    
    updateUserPresence() {
        try {
            let users = {};
            
            // Load existing users
            const existingUsers = localStorage.getItem(this.usersStorageKey);
            if (existingUsers) {
                users = JSON.parse(existingUsers);
            }
            
            // Update current user
            users[this.userId] = {
                name: this.userName,
                lastSeen: Date.now(),
                color: this.getUserColor(this.userId)
            };
            
            // Clean up inactive users (older than 10 minutes)
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
            Object.keys(users).forEach(userId => {
                if (users[userId].lastSeen < tenMinutesAgo) {
                    delete users[userId];
                }
            });
            
            // Keep only max users
            const userEntries = Object.entries(users);
            if (userEntries.length > this.maxUsers) {
                const sorted = userEntries.sort((a, b) => b[1].lastSeen - a[1].lastSeen);
                users = Object.fromEntries(sorted.slice(0, this.maxUsers));
            }
            
            localStorage.setItem(this.usersStorageKey, JSON.stringify(users));
            
            // Update online count
            const activeCount = Object.values(users).filter(u => 
                u.lastSeen > Date.now() - (2 * 60 * 1000)
            ).length;
            
            this.updateOnlineCount(activeCount);
            
        } catch (error) {
            console.error('Error updating user presence:', error);
        }
    }
    
    updateOnlineCount(count) {
        const onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            if (count === 0) {
                onlineElement.textContent = 'Online: You';
            } else if (count === 1) {
                onlineElement.textContent = 'Online: You + 1 other';
            } else {
                onlineElement.textContent = `Online: You + ${count} others`;
            }
        }
    }
    
    displayAllMessages() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Clear except system messages
        const systemMessages = Array.from(chatMessages.querySelectorAll('.system-message'))
            .filter(msg => msg.textContent.includes('Welcome'));
        chatMessages.innerHTML = '';
        
        // Add welcome messages back
        systemMessages.forEach(msg => chatMessages.appendChild(msg));
        
        // Display all messages
        this.messages.forEach(msg => this.displayMessage(msg));
        
        // Scroll to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }
    
    displayMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Remove "Connecting..." messages
        const connectingMsgs = chatMessages.querySelectorAll('.system-message');
        connectingMsgs.forEach(msg => {
            if (msg.textContent.includes('Connecting') || 
                msg.textContent.includes('Using local chat')) {
                msg.remove();
            }
        });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = message.isSystem ? 'system-message' : 'chat-message';
        messageDiv.dataset.id = message.id;
        messageDiv.dataset.userId = message.userId;
        
        if (message.isSystem) {
            messageDiv.textContent = message.message;
        } else {
            const time = new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const isOwnMessage = message.userId === this.userId;
            
            messageDiv.className += isOwnMessage ? ' own-message' : '';
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-user" style="color: ${message.color}">
                        ${this.escapeHtml(message.userName)} ${isOwnMessage ? ' (You)' : ''}
                    </span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.message)}</div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Auto-scroll if at bottom
        const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
        if (isAtBottom) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 10);
        }
    }
    
    getUserColor(userId) {
        // Simple consistent color generation
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0',
            '#118AB2', '#EF476F', '#FFD166', '#06D6A0',
            '#118AB2', '#073B4C', '#FF9E6D', '#8AC926'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupEventListeners() {
        // Listen for storage events from other tabs
        window.addEventListener('storage', (event) => {
            if (event.key === this.chatStorageKey || event.key === this.syncStorageKey) {
                console.log('Storage event detected:', event.key);
                setTimeout(() => this.pollForUpdates(), 500);
            }
        });
        
        // Update presence on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateUserPresence();
                this.pollForUpdates();
            }
        });
        
        // Save before page unload
        window.addEventListener('beforeunload', () => {
            this.updateUserPresence();
        });
    }
    
    triggerSync() {
        // Update sync timestamp to notify other tabs
        localStorage.setItem(this.syncStorageKey, Date.now().toString());
    }
    
    isChatVisible() {
        const chatContainer = document.getElementById('globalChat');
        return chatContainer && chatContainer.classList.contains('chat-open');
    }
    
    showNotification() {
        const chatButton = document.getElementById('chat-button');
        if (chatButton && !this.isChatVisible()) {
            // Remove existing badge
            const existingBadge = chatButton.querySelector('.notification-badge');
            if (existingBadge) existingBadge.remove();
            
            // Add new badge
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = '●';
            badge.style.cssText = `
                position: absolute;
                top: -3px;
                right: -3px;
                background: var(--primary);
                color: white;
                border-radius: 50%;
                width: 10px;
                height: 10px;
                font-size: 0;
                border: 2px solid var(--bg);
                z-index: 1001;
            `;
            
            chatButton.style.position = 'relative';
            chatButton.appendChild(badge);
        }
    }
    
    clearOldMessages() {
        // Keep only last 50 messages
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(-50);
            this.saveChatData();
        }
    }
    
    clearChat() {
        if (!confirm('Clear all chat messages? This action cannot be undone.')) {
            return;
        }
        
        this.messages = [];
        localStorage.removeItem(this.chatStorageKey);
        
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            this.addSystemMessage('Chat cleared');
        }
        
        console.log('Chat cleared');
    }
    
    // Debug methods
    getStats() {
        return {
            totalMessages: this.messages.length,
            userId: this.userId,
            userName: this.userName,
            activeUsers: this.activeUsers.size,
            lastPoll: this.lastPollTime
        };
    }
}

// Global chat instance
let chatSystem = null;

// Initialize chat system
function initChat() {
    if (chatSystem) {
        console.log('Chat already initialized');
        return chatSystem;
    }
    
    console.log('Initializing chat...');
    chatSystem = new P2PChatSystem();
    
    // Setup UI
    setupChatUI();
    
    console.log('Chat initialized successfully');
    return chatSystem;
}

function setupChatUI() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        
        chatInput.addEventListener('input', function() {
            const length = this.value.length;
            const maxLength = 200;
            
            if (length > maxLength - 20) {
                this.style.borderColor = length >= maxLength ? '#ff4444' : '#ffa726';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendChatMessage);
        sendButton.disabled = false;
    }
}

function sendChatMessage() {
    if (!chatSystem) {
        console.error('Chat system not initialized');
        return;
    }
    
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatInput.value.trim()) {
        chatInput?.focus();
        return;
    }
    
    const message = chatInput.value;
    const success = chatSystem.sendMessage(message);
    
    if (success) {
        chatInput.value = '';
        chatInput.focus();
        
        // Show sending indicator
        const sendButton = document.getElementById('sendMessage');
        if (sendButton) {
            const originalText = sendButton.innerHTML;
            sendButton.innerHTML = '✓';
            sendButton.disabled = true;
            
            setTimeout(() => {
                sendButton.innerHTML = originalText;
                sendButton.disabled = false;
            }, 500);
        }
    }
}

function toggleChat() {
    const chatContainer = document.getElementById('globalChat');
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }
    
    const isOpening = !chatContainer.classList.contains('chat-open');
    chatContainer.classList.toggle('chat-open');
    
    if (isOpening) {
        // Focus input
        setTimeout(() => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.focus();
                chatInput.select();
            }
            
            // Scroll to bottom
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // Clear notification
            const chatButton = document.getElementById('chat-button');
            if (chatButton) {
                const badge = chatButton.querySelector('.notification-badge');
                if (badge) badge.remove();
            }
            
            // Update presence
            if (chatSystem) {
                chatSystem.updateUserPresence();
            }
        }, 100);
    }
}

function updateUsername() {
    if (!chatSystem) {
        alert('Please wait for chat to initialize');
        return;
    }
    
    const newName = prompt('Enter your new username (3-20 characters):', chatSystem.userName);
    if (!newName || !newName.trim()) return;
    
    const trimmedName = newName.trim();
    if (trimmedName.length < 3 || trimmedName.length > 20) {
        alert('Username must be between 3 and 20 characters.');
        return;
    }
    
    const oldName = chatSystem.userName;
    chatSystem.userName = trimmedName;
    chatSystem.storeUsername(trimmedName);
    
    chatSystem.addSystemMessage(`👤 ${oldName} changed username to ${trimmedName}`);
    chatSystem.updateUserPresence();
}

function clearChat() {
    if (chatSystem) {
        chatSystem.clearChat();
    }
}

function exportChat() {
    if (!chatSystem) {
        alert('Chat not initialized');
        return;
    }
    
    const chatData = {
        exportDate: new Date().toISOString(),
        exportType: 'TG-Math P2P Chat',
        version: '3.0',
        messages: chatSystem.messages,
        totalMessages: chatSystem.messages.length,
        userName: chatSystem.userName,
        userId: chatSystem.userId,
        stats: chatSystem.getStats()
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `tgmath_chat_${Date.now()}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    chatSystem.addSystemMessage('📥 Chat exported successfully');
}

// Debug function
function debugChat() {
    if (chatSystem) {
        console.log('Chat Debug Info:', chatSystem.getStats());
        console.log('All Messages:', chatSystem.messages);
        
        // Show in alert
        const stats = chatSystem.getStats();
        alert(`Chat Debug Info:\n
Total Messages: ${stats.totalMessages}
User: ${stats.userName}
Active Users: ${stats.activeUsers}
Your ID: ${stats.userId.substring(0, 20)}...
        `);
    } else {
        alert('Chat not initialized');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chat...');
    
    // Enable chat by default
    localStorage.setItem('tgmath_chat_enabled', 'true');
    
    // Initialize chat after short delay
    setTimeout(() => {
        try {
            initChat();
            
            // Check for unread messages
            const hasNotification = document.querySelector('#chat-button .notification-badge');
            if (hasNotification) {
                console.log('Found existing notification');
            }
            
            // Auto-open chat if URL has chat parameter
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('chat') === 'open') {
                setTimeout(toggleChat, 1000);
            }
            
        } catch (error) {
            console.error('Failed to initialize chat:', error);
            
            // Fallback: Show error message
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'system-message';
                errorMsg.style.color = '#ff4444';
                errorMsg.textContent = 'Failed to initialize chat. Please refresh the page.';
                chatMessages.appendChild(errorMsg);
            }
        }
    }, 800);
});

// Add debug function to window
window.debugChat = debugChat;
window.getChatSystem = () => chatSystem;
window.initChat = initChat;
