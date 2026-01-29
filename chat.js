// chat.js - Real-time Global Chat System for TG-Math

class ChatSystem {
    constructor() {
        this.messages = [];
        this.onlineUsers = new Set();
        this.userId = this.generateUserId();
        this.userName = this.getStoredUsername() || this.generateUsername();
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.messageHistoryLimit = 100;
        
        // Chat configuration
        this.config = {
            serverUrl: 'wss://tg-math-chat.glitch.me', // Free WebSocket server
            fallbackServer: 'wss://socketsbay.com/wss/v2/1/demo/', // Alternative
            useLocalStorage: true,
            autoReconnect: true,
            showTimestamps: true,
            messageCooldown: 1000 // 1 second between messages
        };
        
        this.lastMessageTime = 0;
        this.init();
    }
    
    init() {
        this.loadMessageHistory();
        this.setupEventListeners();
        this.connectToServer();
    }
    
    generateUserId() {
        // Create a unique but consistent ID for this user
        if (!localStorage.getItem('tgmath_user_id')) {
            const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('tgmath_user_id', id);
        }
        return localStorage.getItem('tgmath_user_id');
    }
    
    generateUsername() {
        const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Brave', 'Wise', 'Funny', 'Kind', 'Epic', 'Mega'];
        const animals = ['Fox', 'Wolf', 'Tiger', 'Eagle', 'Shark', 'Dragon', 'Phoenix', 'Lion', 'Panda', 'Bear'];
        const numbers = Math.floor(Math.random() * 999) + 1;
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const animal = animals[Math.floor(Math.random() * animals.length)];
        
        return `${adj}${animal}${numbers}`;
    }
    
    getStoredUsername() {
        return localStorage.getItem('tgmath_username');
    }
    
    storeUsername(username) {
        localStorage.setItem('tgmath_username', username);
    }
    
    async connectToServer() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }
        
        try {
            // Try primary server
            this.socket = new WebSocket(this.config.serverUrl);
            this.setupSocketHandlers();
            
        } catch (error) {
            console.error('Failed to connect to primary server:', error);
            this.useFallbackSystem();
        }
    }
    
    setupSocketHandlers() {
        this.socket.onopen = () => {
            console.log('WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.sendSystemMessage('Connected to global chat');
            
            // Send join message
            this.sendJoinMessage();
            
            // Request online users
            this.send({ type: 'get_users' });
            
            this.updateStatus('Connected');
        };
        
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        
        this.socket.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.updateStatus('Disconnected');
            
            if (event.code !== 1000 && this.config.autoReconnect) {
                this.attemptReconnect();
            }
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Error');
            
            if (this.config.autoReconnect) {
                this.attemptReconnect();
            }
        };
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            this.useFallbackSystem();
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connectToServer();
            }
        }, delay);
    }
    
    useFallbackSystem() {
        console.log('Using fallback chat system');
        this.sendSystemMessage('Using local chat (server unavailable)');
        this.updateStatus('Local Mode');
        
        // Load any saved messages from other tabs
        this.loadCrossTabMessages();
        
        // Simulate online users
        this.simulateOnlineUsers();
    }
    
    handleServerMessage(data) {
        switch (data.type) {
            case 'message':
                this.addMessage({
                    id: data.id || Date.now(),
                    userId: data.userId,
                    userName: data.userName,
                    message: data.message,
                    timestamp: data.timestamp || Date.now(),
                    color: data.color || this.getUserColor(data.userId)
                });
                break;
                
            case 'user_join':
                this.onlineUsers.add(data.userId);
                this.sendSystemMessage(`${data.userName} joined the chat`);
                this.updateOnlineCount();
                break;
                
            case 'user_leave':
                this.onlineUsers.delete(data.userId);
                this.sendSystemMessage(`${data.userName} left the chat`);
                this.updateOnlineCount();
                break;
                
            case 'users_list':
                this.onlineUsers = new Set(data.users || []);
                this.updateOnlineCount();
                break;
                
            case 'online_count':
                this.onlineUsers = new Set(data.users || []);
                this.updateOnlineCount(data.count);
                break;
                
            case 'clear_chat':
                this.clearMessages();
                this.sendSystemMessage('Chat was cleared by admin');
                break;
                
            case 'error':
                console.error('Server error:', data.message);
                this.sendSystemMessage(`Error: ${data.message}`);
                break;
        }
    }
    
    send(data) {
        if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }
    
    sendMessage(message) {
        if (!message || !message.trim()) return false;
        
        // Check cooldown
        const now = Date.now();
        if (now - this.lastMessageTime < this.config.messageCooldown) {
            this.sendSystemMessage('Please wait before sending another message');
            return false;
        }
        
        message = message.trim().substring(0, 200);
        
        const chatData = {
            type: 'message',
            id: Date.now(),
            userId: this.userId,
            userName: this.userName,
            message: message,
            timestamp: now,
            color: this.getUserColor(this.userId)
        };
        
        // Add to local messages
        this.addMessage(chatData);
        
        // Send to server if connected
        if (this.isConnected) {
            this.send(chatData);
        } else {
            // Store for cross-tab sharing
            this.storeCrossTabMessage(chatData);
        }
        
        this.lastMessageTime = now;
        return chatData.id;
    }
    
    sendJoinMessage() {
        this.send({
            type: 'user_join',
            userId: this.userId,
            userName: this.userName
        });
    }
    
    sendSystemMessage(text) {
        const systemMessage = {
            id: Date.now(),
            userId: 'system',
            userName: 'System',
            message: text,
            timestamp: Date.now(),
            color: '#ff9900',
            isSystem: true
        };
        
        this.addMessage(systemMessage);
    }
    
    addMessage(chatData) {
        // Check for duplicate messages
        if (this.messages.some(m => m.id === chatData.id)) {
            return;
        }
        
        this.messages.push(chatData);
        
        // Keep message history within limit
        if (this.messages.length > this.messageHistoryLimit) {
            this.messages = this.messages.slice(-this.messageHistoryLimit);
        }
        
        // Display the message
        this.displayMessage(chatData);
        
        // Save to history
        if (this.config.useLocalStorage) {
            this.saveMessageHistory();
        }
    }
    
    displayMessage(chatData) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Remove "Connecting..." message if it exists
        const connectingMsg = chatMessages.querySelector('.system-message:last-child');
        if (connectingMsg && connectingMsg.textContent.includes('Connecting')) {
            connectingMsg.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = chatData.isSystem ? 'system-message' : 'chat-message';
        messageDiv.dataset.id = chatData.id;
        
        if (chatData.isSystem) {
            messageDiv.textContent = chatData.message;
        } else {
            const time = new Date(chatData.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-user" style="color: ${chatData.color}">
                        ${this.escapeHtml(chatData.userName)}
                    </span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.escapeHtml(chatData.message)}</div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    updateOnlineCount(count) {
        const onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            if (count !== undefined) {
                onlineElement.textContent = `Online: ${count}`;
            } else {
                onlineElement.textContent = `Online: ${this.onlineUsers.size}`;
            }
        }
    }
    
    updateStatus(status) {
        // You can add status indicator if needed
        console.log('Chat status:', status);
    }
    
    getUserColor(userId) {
        // Generate consistent color from user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 60%)`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden
            } else {
                // Page is visible again, check connection
                if (!this.isConnected) {
                    this.connectToServer();
                }
            }
        });
        
        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            if (this.isConnected) {
                this.send({ type: 'user_leave', userId: this.userId });
            }
        });
    }
    
    loadMessageHistory() {
        try {
            const saved = localStorage.getItem('tgmath_chat_history');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.messages && Array.isArray(data.messages)) {
                    // Load only recent messages (last 24 hours)
                    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                    this.messages = data.messages.filter(msg => msg.timestamp > oneDayAgo);
                    
                    // Display loaded messages
                    this.displayMessageHistory();
                }
            }
        } catch (error) {
            console.error('Error loading message history:', error);
        }
    }
    
    displayMessageHistory() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Clear existing messages except system messages
        const systemMessages = chatMessages.querySelectorAll('.system-message');
        chatMessages.innerHTML = '';
        systemMessages.forEach(msg => chatMessages.appendChild(msg.cloneNode(true)));
        
        // Display history
        this.messages.forEach(msg => this.displayMessage(msg));
    }
    
    saveMessageHistory() {
        try {
            const data = {
                messages: this.messages,
                lastUpdated: Date.now()
            };
            localStorage.setItem('tgmath_chat_history', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving message history:', error);
        }
    }
    
    storeCrossTabMessage(message) {
        try {
            const key = `tgmath_cross_tab_${message.id}`;
            localStorage.setItem(key, JSON.stringify(message));
            
            // Set expiration
            setTimeout(() => {
                localStorage.removeItem(key);
            }, 60000); // 1 minute
        } catch (error) {
            console.error('Error storing cross-tab message:', error);
        }
    }
    
    loadCrossTabMessages() {
        try {
            const messages = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('tgmath_cross_tab_')) {
                    try {
                        const message = JSON.parse(localStorage.getItem(key));
                        if (message && message.userId !== this.userId) {
                            messages.push(message);
                        }
                    } catch (e) {
                        // Skip invalid messages
                    }
                }
            }
            
            // Add unique messages
            messages.forEach(msg => {
                if (!this.messages.some(m => m.id === msg.id)) {
                    this.addMessage(msg);
                }
            });
            
        } catch (error) {
            console.error('Error loading cross-tab messages:', error);
        }
    }
    
    simulateOnlineUsers() {
        // Simulate 5-15 online users in local mode
        const onlineCount = Math.floor(Math.random() * 10) + 5;
        this.updateOnlineCount(onlineCount);
        
        // Update count every 30 seconds
        setInterval(() => {
            const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
            const newCount = Math.max(1, onlineCount + change);
            this.updateOnlineCount(newCount);
        }, 30000);
    }
    
    clearMessages() {
        if (!confirm('Clear all chat messages? This cannot be undone.')) {
            return;
        }
        
        this.messages = [];
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            // Keep only the welcome message
            const welcomeMsg = chatMessages.querySelector('.system-message:first-child');
            chatMessages.innerHTML = '';
            if (welcomeMsg) {
                chatMessages.appendChild(welcomeMsg);
            }
            this.sendSystemMessage('Chat cleared');
        }
        
        // Clear local storage
        localStorage.removeItem('tgmath_chat_history');
        
        // Send clear command to server
        if (this.isConnected) {
            this.send({ type: 'clear_chat' });
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'User disconnected');
        }
    }
}

// Global chat instance
let chatSystem = null;

// Initialize chat system
function initChat() {
    chatSystem = new ChatSystem();
    
    // Setup UI event listeners
    setupChatUI();
    
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
            if (this.value.length > 190) {
                this.style.borderColor = '#ff4444';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendChatMessage);
    }
}

function sendChatMessage() {
    if (!chatSystem) return;
    
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatInput.value.trim()) return;
    
    const message = chatInput.value;
    chatSystem.sendMessage(message);
    
    // Clear input
    chatInput.value = '';
    chatInput.focus();
}

function toggleChat() {
    const chatContainer = document.getElementById('globalChat');
    if (chatContainer) {
        chatContainer.classList.toggle('chat-open');
        
        if (chatContainer.classList.contains('chat-open')) {
            // Focus input when opening
            setTimeout(() => {
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.focus();
                }
                
                // Scroll to bottom
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 100);
        }
    }
}

function updateUsername() {
    if (!chatSystem) return;
    
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
    
    chatSystem.sendSystemMessage(`${oldName} changed username to ${trimmedName}`);
    
    // Update on server if connected
    if (chatSystem.isConnected) {
        chatSystem.send({
            type: 'username_change',
            userId: chatSystem.userId,
            oldName: oldName,
            newName: trimmedName
        });
    }
}

function clearChat() {
    if (chatSystem) {
        chatSystem.clearMessages();
    }
}

function exportChat() {
    if (!chatSystem) return;
    
    const chatData = {
        exportDate: new Date().toISOString(),
        messages: chatSystem.messages,
        totalMessages: chatSystem.messages.length,
        userCount: chatSystem.onlineUsers.size,
        userName: chatSystem.userName,
        userId: chatSystem.userId
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `tgmath_chat_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if chat should be enabled
    const chatEnabled = localStorage.getItem('tgmath_chat_enabled') !== 'false';
    
    if (chatEnabled) {
        setTimeout(() => {
            initChat();
            
            // Auto-open chat if there are unread messages
            const hasUnread = localStorage.getItem('tgmath_chat_unread');
            if (hasUnread === 'true') {
                toggleChat();
                localStorage.removeItem('tgmath_chat_unread');
            }
        }, 1000);
    } else {
        // Hide chat button
        const chatButton = document.getElementById('chat-button');
        if (chatButton) {
            chatButton.style.display = 'none';
        }
    }
    
    // Mark chat as unread when receiving messages while chat is closed
    const observer = new MutationObserver(function(mutations) {
        const chatContainer = document.getElementById('globalChat');
        if (!chatContainer || chatContainer.classList.contains('chat-open')) {
            return;
        }
        
        localStorage.setItem('tgmath_chat_unread', 'true');
        
        // Optional: Add notification badge
        const chatButton = document.getElementById('chat-button');
        if (chatButton) {
            if (!chatButton.querySelector('.notification-badge')) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                badge.textContent = '!';
                chatButton.appendChild(badge);
            }
        }
    });
    
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        observer.observe(chatMessages, { childList: true });
    }
});
