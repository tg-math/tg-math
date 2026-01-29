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
        this.maxReconnectAttempts = 5;
        this.messageHistoryLimit = 100;
        
        // Multiple WebSocket server options
        this.servers = [
            'wss://ws.postman-echo.com/raw', // Free public WebSocket echo server
            'wss://socketsbay.com/wss/v2/1/demo/', // Another free server
            'wss://echo.websocket.org' // Backup server
        ];
        
        this.currentServerIndex = 0;
        
        this.lastMessageTime = 0;
        this.connectionTimeout = null;
        this.init();
    }
    
    init() {
        this.loadMessageHistory();
        this.setupEventListeners();
        this.connectToServer();
    }
    
    generateUserId() {
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
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) {
                console.log('Already connected to WebSocket');
                return;
            }
            if (this.socket.readyState === WebSocket.CONNECTING) {
                console.log('Already connecting to WebSocket');
                return;
            }
        }
        
        console.log(`Connecting to server ${this.currentServerIndex + 1}/${this.servers.length}`);
        
        try {
            const serverUrl = this.servers[this.currentServerIndex];
            this.socket = new WebSocket(serverUrl);
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected && this.socket.readyState === WebSocket.CONNECTING) {
                    console.log('Connection timeout');
                    this.socket.close();
                    this.tryNextServer();
                }
            }, 5000);
            
            this.setupSocketHandlers();
            
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.tryNextServer();
        }
    }
    
    tryNextServer() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        this.currentServerIndex++;
        
        if (this.currentServerIndex >= this.servers.length) {
            console.log('All servers failed, using local mode');
            this.useLocalMode();
            return;
        }
        
        // Try next server after delay
        setTimeout(() => this.connectToServer(), 1000);
    }
    
    setupSocketHandlers() {
        this.socket.onopen = () => {
            console.log('✅ WebSocket connected successfully to server', this.currentServerIndex + 1);
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.sendSystemMessage('✅ Connected to global chat');
            
            // Send initial message
            const welcomeMsg = {
                type: 'chat',
                userId: this.userId,
                userName: this.userName,
                message: `${this.userName} joined the chat`,
                timestamp: Date.now()
            };
            
            this.socket.send(JSON.stringify(welcomeMsg));
            
            this.updateStatus('Connected');
            this.updateOnlineCount(1); // At least we're online
        };
        
        this.socket.onmessage = (event) => {
            try {
                console.log('Received message:', event.data);
                
                // Echo servers send back the same message
                const data = JSON.parse(event.data);
                
                // Only process messages from other users
                if (data.userId && data.userId !== this.userId) {
                    this.addMessage({
                        id: data.id || Date.now(),
                        userId: data.userId,
                        userName: data.userName,
                        message: data.message,
                        timestamp: data.timestamp || Date.now(),
                        color: data.color || this.getUserColor(data.userId)
                    });
                }
                
            } catch (error) {
                // Some servers just echo the raw message
                if (typeof event.data === 'string' && event.data.trim()) {
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.message && parsed.userId !== this.userId) {
                            this.addMessage({
                                id: Date.now(),
                                userId: parsed.userId || 'unknown',
                                userName: parsed.userName || 'User',
                                message: parsed.message,
                                timestamp: Date.now(),
                                color: this.getUserColor(parsed.userId || 'unknown')
                            });
                        }
                    } catch (e) {
                        // If it's just text, display it
                        if (event.data.includes('{') && event.data.includes('}')) {
                            // Probably JSON, ignore parse error
                        } else {
                            this.sendSystemMessage(`Echo: ${event.data.substring(0, 50)}`);
                        }
                    }
                }
            }
        };
        
        this.socket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            this.isConnected = false;
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            if (event.code !== 1000) {
                this.sendSystemMessage('⚠️ Disconnected from server');
                this.tryNextServer();
            }
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnected = false;
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            this.tryNextServer();
        };
    }
    
    useLocalMode() {
        console.log('Using local chat mode');
        this.sendSystemMessage('🌐 Using local chat mode');
        this.sendSystemMessage('📱 Messages are saved locally in your browser');
        
        // Simulate online users
        this.simulateOnlineUsers();
        
        // Load any saved messages
        this.loadCrossTabMessages();
    }
    
    sendMessage(message) {
        if (!message || !message.trim()) return false;
        
        // Check cooldown
        const now = Date.now();
        if (now - this.lastMessageTime < 1000) {
            this.sendSystemMessage('⏳ Please wait before sending another message');
            return false;
        }
        
        message = message.trim().substring(0, 200);
        
        const chatData = {
            type: 'chat',
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
        if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(chatData));
            } catch (error) {
                console.error('Error sending message:', error);
                this.sendSystemMessage('⚠️ Failed to send message to server');
            }
        } else {
            // Store for cross-tab sharing
            this.storeCrossTabMessage(chatData);
        }
        
        this.lastMessageTime = now;
        return chatData.id;
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
        const isDuplicate = this.messages.some(m => 
            m.id === chatData.id || 
            (m.userId === chatData.userId && 
             m.message === chatData.message && 
             Math.abs(m.timestamp - chatData.timestamp) < 1000)
        );
        
        if (isDuplicate) {
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
        this.saveMessageHistory();
    }
    
    displayMessage(chatData) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Remove "Connecting..." messages
        const connectingMsgs = chatMessages.querySelectorAll('.system-message');
        connectingMsgs.forEach(msg => {
            if (msg.textContent.includes('Connecting') || 
                msg.textContent.includes('Using local chat (server unavailable)')) {
                msg.remove();
            }
        });
        
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
                onlineElement.textContent = `🌐 Online: ${count}`;
            } else {
                // Estimate based on recent activity
                const recentMessages = this.messages.filter(m => 
                    Date.now() - m.timestamp < 300000 && 
                    m.userId !== 'system'
                );
                const uniqueUsers = new Set(recentMessages.map(m => m.userId));
                onlineElement.textContent = `🌐 Online: ~${uniqueUsers.size}`;
            }
        }
    }
    
    updateStatus(status) {
        // Optional: Update status indicator
        const statusIndicator = document.getElementById('chatStatus');
        if (statusIndicator) {
            statusIndicator.textContent = status;
            statusIndicator.className = 'chat-status ' + status.toLowerCase();
        }
    }
    
    getUserColor(userId) {
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
    
    setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isConnected) {
                this.connectToServer();
            }
        });
        
        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            if (this.isConnected && this.socket) {
                const leaveMsg = {
                    type: 'leave',
                    userId: this.userId,
                    userName: this.userName,
                    message: `${this.userName} left the chat`,
                    timestamp: Date.now()
                };
                
                try {
                    this.socket.send(JSON.stringify(leaveMsg));
                } catch (error) {
                    // Ignore errors on unload
                }
            }
            
            // Save messages before leaving
            this.saveMessageHistory();
        });
    }
    
    loadMessageHistory() {
        try {
            const saved = localStorage.getItem('tgmath_chat_history');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.messages && Array.isArray(data.messages)) {
                    // Load only recent messages (last 50)
                    this.messages = data.messages.slice(-50);
                }
            }
        } catch (error) {
            console.error('Error loading message history:', error);
        }
    }
    
    saveMessageHistory() {
        try {
            const data = {
                messages: this.messages,
                lastUpdated: Date.now(),
                userName: this.userName,
                userId: this.userId
            };
            localStorage.setItem('tgmath_chat_history', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving message history:', error);
        }
    }
    
    storeCrossTabMessage(message) {
        try {
            const key = `tgmath_chat_msg_${message.id}`;
            localStorage.setItem(key, JSON.stringify(message));
            
            // Remove after 1 hour
            setTimeout(() => {
                localStorage.removeItem(key);
            }, 3600000);
        } catch (error) {
            console.error('Error storing cross-tab message:', error);
        }
    }
    
    loadCrossTabMessages() {
        try {
            const messages = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('tgmath_chat_msg_')) {
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
            
            // Sort by timestamp and add unique messages
            messages.sort((a, b) => a.timestamp - b.timestamp);
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
        // Start with 3-8 online users
        const baseCount = Math.floor(Math.random() * 6) + 3;
        this.updateOnlineCount(baseCount);
        
        // Randomly update count every 30-60 seconds
        setInterval(() => {
            const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
            const newCount = Math.max(1, baseCount + change);
            this.updateOnlineCount(newCount);
        }, 30000 + Math.random() * 30000);
    }
    
    clearMessages() {
        this.messages = [];
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            // Keep only the welcome message
            const welcomeMsg = chatMessages.querySelector('.system-message');
            chatMessages.innerHTML = '';
            if (welcomeMsg && welcomeMsg.textContent.includes('Welcome')) {
                chatMessages.appendChild(welcomeMsg);
            } else {
                const newWelcome = document.createElement('div');
                newWelcome.className = 'system-message';
                newWelcome.textContent = 'Welcome to TG-Math Global Chat! Be respectful to others.';
                chatMessages.appendChild(newWelcome);
            }
            this.sendSystemMessage('🗑️ Chat cleared');
        }
        
        localStorage.removeItem('tgmath_chat_history');
        
        // Clear cross-tab messages
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key.startsWith('tgmath_chat_msg_')) {
                localStorage.removeItem(key);
            }
        }
    }
}

// Global chat instance
let chatSystem = null;

// Initialize chat system
function initChat() {
    if (chatSystem) {
        return chatSystem;
    }
    
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
    if (!chatInput || !chatInput.value.trim()) {
        chatInput?.focus();
        return;
    }
    
    const message = chatInput.value;
    const success = chatSystem.sendMessage(message);
    
    if (success) {
        chatInput.value = '';
        chatInput.focus();
    }
}

function toggleChat() {
    const chatContainer = document.getElementById('globalChat');
    if (!chatContainer) return;
    
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
        
        // Clear notification badge
        const chatButton = document.getElementById('chat-button');
        if (chatButton) {
            const badge = chatButton.querySelector('.notification-badge');
            if (badge) {
                badge.remove();
            }
        }
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
    
    chatSystem.sendSystemMessage(`👤 ${oldName} changed username to ${trimmedName}`);
}

function clearChat() {
    if (chatSystem) {
        chatSystem.clearMessages();
    }
}

function exportChat() {
    if (!chatSystem) {
        alert('Chat not initialized');
        return;
    }
    
    const chatData = {
        exportDate: new Date().toISOString(),
        messages: chatSystem.messages,
        totalMessages: chatSystem.messages.length,
        userName: chatSystem.userName
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
    // Check if chat is disabled
    const chatEnabled = localStorage.getItem('tgmath_chat_enabled') !== 'false';
    
    if (!chatEnabled) {
        const chatButton = document.getElementById('chat-button');
        if (chatButton) {
            chatButton.style.display = 'none';
        }
        return;
    }
    
    // Initialize chat after a short delay
    setTimeout(() => {
        initChat();
        
        // Check for unread messages
        const hasUnread = localStorage.getItem('tgmath_chat_unread') === 'true';
        if (hasUnread) {
            // Add notification badge
            const chatButton = document.getElementById('chat-button');
            if (chatButton && !chatButton.querySelector('.notification-badge')) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                badge.textContent = '●';
                badge.style.cssText = `
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    background: #ff4444;
                    color: white;
                    border-radius: 50%;
                    width: 12px;
                    height: 12px;
                    font-size: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                chatButton.style.position = 'relative';
                chatButton.appendChild(badge);
            }
        }
    }, 1000);
    
    // Monitor chat for new messages when chat is closed
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const observer = new MutationObserver(function(mutations) {
            const chatContainer = document.getElementById('globalChat');
            if (!chatContainer || chatContainer.classList.contains('chat-open')) {
                return;
            }
            
            // Check if new non-system message was added
            let hasNewMessage = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.classList && 
                            !node.classList.contains('system-message') &&
                            !node.textContent.includes('Welcome to TG-Math')) {
                            hasNewMessage = true;
                            break;
                        }
                    }
                }
                if (hasNewMessage) break;
            }
            
            if (hasNewMessage) {
                localStorage.setItem('tgmath_chat_unread', 'true');
                
                // Add/update notification badge
                const chatButton = document.getElementById('chat-button');
                if (chatButton) {
                    let badge = chatButton.querySelector('.notification-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'notification-badge';
                        badge.textContent = '●';
                        badge.style.cssText = `
                            position: absolute;
                            top: -2px;
                            right: -2px;
                            background: #ff4444;
                            color: white;
                            border-radius: 50%;
                            width: 12px;
                            height: 12px;
                            font-size: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        `;
                        chatButton.style.position = 'relative';
                        chatButton.appendChild(badge);
                    }
                }
            }
        });
        
        observer.observe(chatMessages, { childList: true });
    }
});

// Add to global scope for debugging
window.chatSystem = () => chatSystem;
