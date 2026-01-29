// chat.js - Global Chat System for TG-Math

class ChatSystem {
    constructor() {
        this.messages = [];
        this.users = new Map();
        this.userId = this.generateUserId();
        this.userName = this.generateUsername();
        this.socket = null;
        this.isConnected = false;
        this.messageLimit = 100;
        this.chatEnabled = true;
        this.lastActivity = Date.now();
        
        // Load saved messages from localStorage
        this.loadMessages();
        
        // Auto-save messages every 30 seconds
        setInterval(() => this.saveMessages(), 30000);
        
        // Check for inactivity every minute
        setInterval(() => this.checkInactivity(), 60000);
    }
    
    generateUserId() {
        // Generate a unique user ID based on browser fingerprint
        const browserInfo = navigator.userAgent + navigator.language + 
                          screen.width + screen.height + 
                          (navigator.platform || '');
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < browserInfo.length; i++) {
            const char = browserInfo.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return 'user_' + Math.abs(hash).toString(16).substring(0, 8);
    }
    
    generateUsername() {
        const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Brave', 'Wise', 'Funny', 'Kind'];
        const nouns = ['Player', 'Gamer', 'Explorer', 'Hero', 'Master', 'Champion', 'Wizard', 'Ninja'];
        const num = Math.floor(Math.random() * 999) + 1;
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adj}${noun}${num}`;
    }
    
    async connect() {
        if (!this.chatEnabled) return;
        
        try {
            // Try to connect to WebSocket server
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('Chat connected');
                this.isConnected = true;
                this.sendSystemMessage('Connected to chat');
                this.updateOnlineCount();
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleIncomingMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.socket.onclose = () => {
                console.log('Chat disconnected');
                this.isConnected = false;
                this.sendSystemMessage('Disconnected from chat');
                // Try to reconnect after 5 seconds
                setTimeout(() => this.connect(), 5000);
            };
            
            this.socket.onerror = (error) => {
                console.error('Chat error:', error);
                this.isConnected = false;
            };
            
        } catch (error) {
            console.log('WebSocket not available, using local chat');
            this.useLocalChat();
        }
    }
    
    useLocalChat() {
        // Fallback to localStorage-based chat
        console.log('Using local chat storage');
        this.sendSystemMessage('Using local chat (no server connection)');
        
        // Simulate other users by loading old messages
        this.loadOldMessages();
        
        // Periodically check for new messages from other tabs
        setInterval(() => this.checkForNewMessages(), 2000);
    }
    
    async handleIncomingMessage(data) {
        if (data.type === 'message') {
            this.addMessage({
                id: data.id || Date.now(),
                userId: data.userId,
                userName: data.userName,
                message: data.message,
                timestamp: data.timestamp || Date.now(),
                color: data.color || this.getUserColor(data.userId)
            });
            
            this.updateOnlineCount(data.onlineCount);
            
        } else if (data.type === 'user_join') {
            this.sendSystemMessage(`${data.userName} joined the chat`);
            this.updateOnlineCount(data.onlineCount);
            
        } else if (data.type === 'user_leave') {
            this.sendSystemMessage(`${data.userName} left the chat`);
            this.updateOnlineCount(data.onlineCount);
            
        } else if (data.type === 'users_list') {
            this.updateOnlineCount(data.count);
            
        } else if (data.type === 'clear_chat') {
            this.clearMessages();
            this.sendSystemMessage('Chat was cleared by admin');
        }
    }
    
    sendMessage(message) {
        if (!this.chatEnabled || !message.trim()) return;
        
        message = message.trim().substring(0, 200); // Limit message length
        
        const chatData = {
            type: 'message',
            id: Date.now(),
            userId: this.userId,
            userName: this.userName,
            message: message,
            timestamp: Date.now(),
            color: this.getUserColor(this.userId)
        };
        
        // Add to local messages
        this.addMessage(chatData);
        
        // Send to server if connected
        if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(chatData));
        } else {
            // Save to localStorage for other tabs
            this.saveMessageToStorage(chatData);
        }
        
        this.lastActivity = Date.now();
        return chatData.id;
    }
    
    addMessage(chatData) {
        this.messages.push(chatData);
        
        // Keep only the last N messages
        if (this.messages.length > this.messageLimit) {
            this.messages = this.messages.slice(-this.messageLimit);
        }
        
        this.displayMessage(chatData);
        this.saveMessages();
    }
    
    displayMessage(chatData) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.dataset.id = chatData.id;
        
        const time = new Date(chatData.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-user" style="color: ${chatData.color}">${chatData.userName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(chatData.message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
    
    updateOnlineCount(count = null) {
        const onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            if (count !== null) {
                onlineElement.textContent = `Online: ${count}`;
            } else {
                // Estimate based on recent activity
                const recentMessages = this.messages.filter(m => 
                    Date.now() - m.timestamp < 300000 && m.userId !== 'system'
                );
                const uniqueUsers = new Set(recentMessages.map(m => m.userId));
                onlineElement.textContent = `Online: ~${uniqueUsers.size}`;
            }
        }
    }
    
    getUserColor(userId) {
        // Generate consistent color based on user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#4287f5', '#42f5a7', '#f54242', '#f5a742',
            '#a742f5', '#42f5e8', '#f542a7', '#7bf542',
            '#f57b42', '#42a7f5', '#f542e8', '#a7f542'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    saveMessages() {
        try {
            const chatData = {
                messages: this.messages.slice(-50), // Save last 50 messages
                lastSave: Date.now()
            };
            localStorage.setItem('tgmath_chat_data', JSON.stringify(chatData));
        } catch (error) {
            console.error('Error saving messages:', error);
        }
    }
    
    loadMessages() {
        try {
            const saved = localStorage.getItem('tgmath_chat_data');
            if (saved) {
                const chatData = JSON.parse(saved);
                if (chatData.messages && Array.isArray(chatData.messages)) {
                    this.messages = chatData.messages;
                    this.displayAllMessages();
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    saveMessageToStorage(message) {
        try {
            const key = `tgmath_chat_msg_${message.id}`;
            localStorage.setItem(key, JSON.stringify(message));
            
            // Set expiration for 24 hours
            setTimeout(() => {
                localStorage.removeItem(key);
            }, 24 * 60 * 60 * 1000);
        } catch (error) {
            console.error('Error saving message to storage:', error);
        }
    }
    
    loadOldMessages() {
        try {
            const messages = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('tgmath_chat_msg_')) {
                    try {
                        const message = JSON.parse(localStorage.getItem(key));
                        if (message && message.timestamp) {
                            messages.push(message);
                        }
                    } catch (e) {
                        // Skip invalid messages
                    }
                }
            }
            
            // Sort by timestamp and add to messages
            messages.sort((a, b) => a.timestamp - b.timestamp);
            const recentMessages = messages.slice(-20); // Get last 20 messages
            
            recentMessages.forEach(msg => {
                if (!this.messages.some(m => m.id === msg.id)) {
                    this.addMessage(msg);
                }
            });
            
        } catch (error) {
            console.error('Error loading old messages:', error);
        }
    }
    
    checkForNewMessages() {
        this.loadOldMessages();
    }
    
    displayAllMessages() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        
        // Add welcome message
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'system-message';
        welcomeMsg.textContent = 'Welcome to TG-Math Global Chat! Be respectful to others.';
        chatMessages.appendChild(welcomeMsg);
        
        // Display all messages
        this.messages.forEach(msg => this.displayMessage(msg));
    }
    
    clearMessages() {
        this.messages = [];
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            this.sendSystemMessage('Chat cleared');
        }
        
        // Clear localStorage
        try {
            localStorage.removeItem('tgmath_chat_data');
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith('tgmath_chat_msg_')) {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.error('Error clearing chat storage:', error);
        }
    }
    
    checkInactivity() {
        // If no activity for 30 minutes, send a ping
        if (Date.now() - this.lastActivity > 30 * 60 * 1000) {
            this.sendSystemMessage('Chat is active');
            this.lastActivity = Date.now();
        }
    }
}

// Global chat instance
let chatSystem = null;

// Initialize chat system
function initChat() {
    chatSystem = new ChatSystem();
    chatSystem.connect();
    
    // Setup event listeners
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    
    if (chatInput && sendButton) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
        
        sendButton.addEventListener('click', sendChatMessage);
    }
    
    // Load any pending messages
    setTimeout(() => chatSystem.loadOldMessages(), 1000);
}

// Toggle chat visibility
function toggleChat() {
    const chatContainer = document.getElementById('globalChat');
    if (chatContainer) {
        chatContainer.classList.toggle('chat-open');
        
        if (chatContainer.classList.contains('chat-open')) {
            // Scroll to bottom when opening
            setTimeout(() => {
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 100);
        }
    }
}

// Send chat message
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

// Clear chat
function clearChat() {
    if (confirm('Clear all chat messages? This cannot be undone.')) {
        if (chatSystem) {
            chatSystem.clearMessages();
        }
    }
}

// Update username
function updateUsername() {
    if (!chatSystem) return;
    
    const newName = prompt('Enter your new username (max 20 characters):', chatSystem.userName);
    if (newName && newName.trim() && newName.trim().length <= 20) {
        const oldName = chatSystem.userName;
        chatSystem.userName = newName.trim();
        chatSystem.sendSystemMessage(`${oldName} is now known as ${chatSystem.userName}`);
    }
}

// Export chat data
function exportChat() {
    if (!chatSystem) return;
    
    const chatData = {
        exportDate: new Date().toISOString(),
        messages: chatSystem.messages,
        userCount: chatSystem.users.size
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `tgmath_chat_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if chat is disabled by admin
    const chatEnabled = localStorage.getItem('tgmath_chat_enabled') !== 'false';
    
    if (chatEnabled) {
        setTimeout(initChat, 1500);
    } else {
        // Hide chat button if disabled
        const chatButton = document.getElementById('chat-button');
        if (chatButton) {
            chatButton.style.display = 'none';
        }
    }
});
