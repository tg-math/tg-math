// chat.js - Simplified Global Chat System for TG-Math

class SimpleChatSystem {
    constructor() {
        this.messages = [];
        this.userName = this.generateUsername();
        this.messageLimit = 100;
        
        // Initialize chat
        this.loadMessages();
        this.setupEventListeners();
    }
    
    generateUsername() {
        const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Brave', 'Wise', 'Funny', 'Kind'];
        const nouns = ['Player', 'Gamer', 'Explorer', 'Hero', 'Master', 'Champion', 'Wizard', 'Ninja'];
        const num = Math.floor(Math.random() * 999) + 1;
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adj}${noun}${num}`;
    }
    
    setupEventListeners() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendMessage');
        
        if (chatInput && sendButton) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
            
            sendButton.addEventListener('click', () => this.sendMessage());
        }
    }
    
    sendMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !chatInput.value.trim()) return;
        
        const message = chatInput.value.trim().substring(0, 200);
        this.addMessage(this.userName, message, true);
        
        // Clear input
        chatInput.value = '';
        chatInput.focus();
        
        // Simulate response after delay
        setTimeout(() => {
            const responses = [
                "Hello there!",
                "Nice to see you!",
                "How's your day going?",
                "Anyone playing games?",
                "This chat is cool!",
                "Welcome to TG-Math!"
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            this.addMessage("ChatBot", randomResponse, false);
        }, 1000 + Math.random() * 2000);
    }
    
    addMessage(user, message, isUser = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser ? 'chat-message user-message' : 'chat-message';
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-user" style="color: ${isUser ? '#42f5a7' : '#4287f5'}">${user}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Save message
        this.messages.push({
            user,
            message,
            time: new Date().toISOString(),
            isUser
        });
        
        // Keep only last 100 messages
        if (this.messages.length > this.messageLimit) {
            this.messages = this.messages.slice(-this.messageLimit);
        }
        
        this.saveMessages();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    saveMessages() {
        try {
            const chatData = {
                messages: this.messages.slice(-50),
                lastSave: Date.now()
            };
            localStorage.setItem('tgmath_simple_chat', JSON.stringify(chatData));
        } catch (error) {
            console.error('Error saving messages:', error);
        }
    }
    
    loadMessages() {
        try {
            const saved = localStorage.getItem('tgmath_simple_chat');
            if (saved) {
                const chatData = JSON.parse(saved);
                if (chatData.messages && Array.isArray(chatData.messages)) {
                    // Add old messages
                    chatData.messages.forEach(msg => {
                        this.addMessage(msg.user, msg.message, msg.isUser);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    clearMessages() {
        this.messages = [];
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="system-message">Welcome to TG-Math Global Chat! Be respectful to others.</div>';
        }
        
        try {
            localStorage.removeItem('tgmath_simple_chat');
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.chatSystem = new SimpleChatSystem();
    
    // Update online count with random number
    setTimeout(() => {
        const onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            const randomCount = Math.floor(Math.random() * 50) + 10;
            onlineElement.textContent = `Online: ~${randomCount}`;
        }
    }, 2000);
});

// Global functions
function toggleChat() {
    const chat = document.getElementById('globalChat');
    if (chat) {
        chat.classList.toggle('chat-open');
        
        if (chat.classList.contains('chat-open')) {
            setTimeout(() => {
                document.getElementById('chatInput')?.focus();
            }, 100);
        }
    }
}

function sendChatMessage() {
    if (window.chatSystem) {
        window.chatSystem.sendMessage();
    }
}

function clearChat() {
    if (confirm('Clear all chat messages?')) {
        if (window.chatSystem) {
            window.chatSystem.clearMessages();
        }
    }
}
