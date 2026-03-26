// ============================================================
// Chat History Manager
// ============================================================
// Each chat session: { id, keyword, messages: [{text, role, isImage}], createdAt }
// Stored in localStorage under key 'chat_history'

function getChatHistory() {
    try {
        return JSON.parse(localStorage.getItem('chat_history') || '[]');
    } catch { return []; }
}

function saveChatHistory(history) {
    localStorage.setItem('chat_history', JSON.stringify(history));
}

let currentChatId = null;

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createNewChat() {
    currentChatId = null;
    // Clear messages area and show welcome screen
    const container = document.getElementById('messages-container');
    container.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-icon glass"><i class="fas fa-robot"></i></div>
            <h2>How can I help you today?</h2>
            <p>Search by keyword above or start a new conversation below.</p>
        </div>`;
    renderHistory();
}

function startChatSession(keyword) {
    const history = getChatHistory();
    const newChat = {
        id: generateId(),
        keyword: keyword,
        messages: [],
        createdAt: new Date().toISOString()
    };
    history.unshift(newChat);
    saveChatHistory(history);
    currentChatId = newChat.id;
    renderHistory();
    return newChat;
}

function addMessageToChat(chatId, text, role, isImage = false) {
    const history = getChatHistory();
    const chat = history.find(c => c.id === chatId);
    if (chat) {
        chat.messages.push({ text, role, isImage });
        saveChatHistory(history);
    }
}

function deleteChat(chatId) {
    let history = getChatHistory();
    history = history.filter(c => c.id !== chatId);
    saveChatHistory(history);
    if (currentChatId === chatId) {
        createNewChat();
    } else {
        renderHistory();
    }
}

function loadChat(chatId) {
    const history = getChatHistory();
    const chat = history.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    // Hide welcome screen
    const welcome = document.querySelector('.welcome-screen');
    if (welcome) welcome.style.display = 'none';

    chat.messages.forEach(msg => {
        if (msg.isImage) {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'message assistant-message glass';
            imgDiv.innerHTML = msg.text;
            container.appendChild(imgDiv);
        } else {
            container.appendChild(createMessageElement(msg.text, msg.role));
        }
    });

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const history = getChatHistory();

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="far fa-comment-dots"></i>
                <span>No chat history yet</span>
            </div>`;
        return;
    }

    historyList.innerHTML = history.map(chat => `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" data-id="${chat.id}">
            <i class="far fa-message"></i>
            <span class="history-title">${escapeHTML(chat.keyword)}</span>
            <button class="delete-btn" data-delete-id="${chat.id}" title="Delete">
                <i class="fas fa-trash-can"></i>
            </button>
        </div>
    `).join('');

    // Attach click events
    historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't switch chat if delete button was clicked
            if (e.target.closest('.delete-btn')) return;
            loadChat(item.dataset.id);
        });
    });

    historyList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(btn.dataset.deleteId);
        });
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Helper to create a message DOM element (used by both live chat and history loading)
function createMessageElement(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message glass`;
    if (role === 'assistant') messageDiv.style.background = 'rgba(255,255,255,0.02)';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';

    if (role === 'assistant' && typeof marked !== 'undefined') {
        contentDiv.innerHTML = marked.parse(content);
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    return messageDiv;
}

// ============================================================
// Google OAuth Callback (Must be in global scope)
// ============================================================
function handleCredentialResponse(response) {
    try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        const email = payload.email || '';
        const displayName = payload.name || (email.includes('@') ? email.split('@')[0] : 'User');
        const picture = payload.picture;

        const userData = {
            name: displayName,
            picture: picture
        };

        localStorage.setItem('google_user', JSON.stringify(userData));
        displayUserProfile(userData);
    } catch (error) {
        console.error("Error parsing Google credential:", error);
    }
}

function displayUserProfile(userData) {
    document.getElementById('login-container').style.display = 'none';
    const userProfile = document.getElementById('user-profile');
    userProfile.style.display = 'flex';

    document.getElementById('user-name').textContent = userData.name;

    const avatar = document.getElementById('user-avatar');
    if (userData.picture) {
        avatar.innerHTML = `<img src="${userData.picture}" alt="Profile" style="width:100%; height:100%; border-radius:12px; object-fit: cover;">`;
        avatar.style.background = 'transparent';
    } else {
        avatar.textContent = userData.name.charAt(0).toUpperCase();
    }
}

function checkLoginState() {
    const savedUser = localStorage.getItem('google_user');
    if (savedUser) {
        try {
            displayUserProfile(JSON.parse(savedUser));
        } catch (e) {
            console.error("Error loading saved user:", e);
            localStorage.removeItem('google_user');
        }
    }
}

// ============================================================
// Main App Logic
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
    renderHistory();

    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const keywordInput = document.getElementById('keyword-input');
    const newChatBtn = document.querySelector('.new-chat-btn');

    const settingsModal = document.getElementById('settings-modal');
    const openSettings = document.querySelector('.settings-btn');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');

    // --- New Chat Button ---
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }

    // --- Modal Logic ---
    if (openSettings) openSettings.onclick = () => settingsModal.style.display = 'flex';
    if (closeSettings) closeSettings.onclick = () => settingsModal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    };
    if (saveSettings) {
        saveSettings.onclick = () => settingsModal.style.display = 'none';
    }

    // --- Message helpers ---
    function scrollBottom() {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    }

    function addMessage(text, role) {
        const welcome = document.querySelector('.welcome-screen');
        if (welcome) welcome.style.display = 'none';

        messagesContainer.appendChild(createMessageElement(text, role));
        scrollBottom();
    }

    // --- Keyword Search ---
    async function handleKeywordSearch() {
        const keyword = keywordInput.value.trim();
        if (!keyword) return;

        keywordInput.value = '';
        keywordInput.blur();

        // Start a new chat session for this keyword
        const chat = startChatSession(keyword);

        addMessage(`Searching for news about: ${keyword}`, 'user');
        addMessageToChat(chat.id, `Searching for news about: ${keyword}`, 'user');

        const loadingMsg = createMessageElement("Searching and summarizing news. Please wait...", 'assistant');
        messagesContainer.appendChild(loadingMsg);
        scrollBottom();

        try {
            const response = await fetch(`http://localhost:8000/news?keyword=${encodeURIComponent(keyword)}`);
            const text = await response.text();
            loadingMsg.remove();

            try {
                const data = JSON.parse(text);
                const summaryText = data.summary || data.error || "ไม่พบข้อมูล";

                addMessage(summaryText, 'assistant');
                addMessageToChat(chat.id, summaryText, 'assistant');

                // Show images
                const imgs = data.images || (data.image_url ? [data.image_url] : []);
                if (imgs.length > 0) {
                    let imgHtml = '<div class="news-images">';
                    imgs.forEach(src => {
                        imgHtml += `<img src="${src}" class="message-image" onerror="this.style.display='none'">`;
                    });
                    imgHtml += '</div>';

                    const imgDiv = document.createElement('div');
                    imgDiv.className = 'message assistant-message glass';
                    imgDiv.innerHTML = imgHtml;
                    messagesContainer.appendChild(imgDiv);
                    scrollBottom();

                    addMessageToChat(chat.id, imgHtml, 'assistant', true);
                }
            } catch (e) {
                addMessage(text, 'assistant');
                addMessageToChat(chat.id, text, 'assistant');
            }
        } catch (error) {
            loadingMsg.remove();
            const errMsg = `Error: Unable to reach the server. Make sure the FastAPI app is running.\n\nDetails: ${error.message}`;
            addMessage(errMsg, 'assistant');
            addMessageToChat(chat.id, errMsg, 'assistant');
        }
    }

    // --- Chat Message ---
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // If no active chat, create one with the message text as title
        if (!currentChatId) {
            const chatTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
            startChatSession(chatTitle);
        }

        addMessage(text, 'user');
        addMessageToChat(currentChatId, text, 'user');
        input.value = '';
        input.style.height = 'auto';

        const loadingMsg = createMessageElement("กำลังพิมพ์...", 'assistant');
        messagesContainer.appendChild(loadingMsg);
        scrollBottom();

        try {
            const response = await fetch(`http://localhost:8000/chat?message=${encodeURIComponent(text)}`);
            const responseText = await response.text();
            loadingMsg.remove();

            try {
                const data = JSON.parse(responseText);
                const reply = data.response || data.error || "ไม่พบข้อมูล";
                addMessage(reply, 'assistant');
                addMessageToChat(currentChatId, reply, 'assistant');
            } catch (e) {
                addMessage(responseText, 'assistant');
                addMessageToChat(currentChatId, responseText, 'assistant');
            }
        } catch (error) {
            loadingMsg.remove();
            const errMsg = `เกิดข้อผิดพลาด: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (${error.message})`;
            addMessage(errMsg, 'assistant');
            addMessageToChat(currentChatId, errMsg, 'assistant');
        }
    }

    // --- Event Listeners ---
    if (input) {
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 150) + 'px';
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (keywordInput) {
        keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleKeywordSearch();
            }
        });
    }
});