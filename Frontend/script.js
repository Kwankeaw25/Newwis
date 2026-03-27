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
let activeTasks = new Map(); // Store active news fetch tasks: chatId -> { status, progress, element }


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

    // Re-show loading state if this chat has an active task
    if (activeTasks.has(chatId)) {
        const task = activeTasks.get(chatId);
        const loadingMsg = createMessageElement(task.message || "กำลังประมวลผล...", 'assistant');
        loadingMsg.id = `loading-${chatId}`;
        container.appendChild(loadingMsg);
        scrollBottom();
    }
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
    const logoutBtn = document.getElementById('logout-btn');
    const exportPdfBtn = document.getElementById('export-pdf');
    const copyAllBtn = document.getElementById('copy-all');


    const apiKeyInput = document.getElementById('setting-api-key');
    const modelInput = document.getElementById('setting-model');
    const validateBtn = document.getElementById('validate-btn');
    const validateStatus = document.getElementById('validate-status');
    const tokenNotice = document.getElementById('token-notice');

    // --- Settings Storage Helpers ---
    function getSettings() {
        return {
            apiKey: localStorage.getItem('app_api_key') || '',
            model: localStorage.getItem('app_model') || 'arcee-ai/trinity-large-preview:free'
        };
    }

    function loadSettingsToUI() {
        const settings = getSettings();
        if (apiKeyInput) apiKeyInput.value = settings.apiKey;
        if (modelInput) modelInput.value = settings.model;
        
        // Show/hide token notice
        if (tokenNotice) {
            if (settings.apiKey) {
                tokenNotice.classList.add('hidden');
            } else {
                tokenNotice.classList.remove('hidden');
            }
        }
    }

    // --- Modal Logic ---
    if (openSettings) {
        openSettings.onclick = () => {
            loadSettingsToUI();
            validateStatus.textContent = '';
            validateStatus.className = 'validate-status';
            settingsModal.style.display = 'flex';
        };
    }

    if (closeSettings) closeSettings.onclick = () => settingsModal.style.display = 'none';

    window.onclick = (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    };

    if (saveSettings) {
        saveSettings.onclick = () => {
            const apiKey = apiKeyInput.value.trim();
            const model = modelInput.value.trim();
            
            localStorage.setItem('app_api_key', apiKey);
            localStorage.setItem('app_model', model || 'arcee-ai/trinity-large-preview:free');
            
            settingsModal.style.display = 'none';
            // Update notice visibility in case it changed
            loadSettingsToUI();
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
                // Clear user data
                localStorage.removeItem('google_user');
                // Optional: Clear API settings too if user wants complete logout
                // localStorage.removeItem('app_api_key');
                // localStorage.removeItem('app_model');
                
                // Hide modal
                settingsModal.style.display = 'none';
                
                // Refresh page or reset UI
                window.location.reload();
            }
        };
    }

    // --- Validation Logic ---
    if (validateBtn) {
        validateBtn.onclick = async () => {
            const apiKey = apiKeyInput.value.trim();
            const model = modelInput.value.trim();
            
            if (!apiKey) {
                validateStatus.textContent = '❌ กรุณาใส่ API Key';
                validateStatus.className = 'validate-status invalid';
                return;
            }

            validateBtn.classList.add('loading');
            validateBtn.disabled = true;
            validateStatus.textContent = '⏳ กำลังตรวจสอบ...';
            validateStatus.className = 'validate-status';

            try {
                const response = await fetch(`/validate?api_key=${encodeURIComponent(apiKey)}&model=${encodeURIComponent(model)}`);
                const data = await response.json();
                
                if (data.valid) {
                    validateStatus.textContent = '✅ ใช้ได้';
                    validateStatus.className = 'validate-status valid';
                } else {
                    validateStatus.textContent = `❌ ${data.error || 'ใช้ไม่ได้'}`;
                    validateStatus.className = 'validate-status invalid';
                }
            } catch (err) {
                validateStatus.textContent = '❌ ติดต่อเซิร์ฟเวอร์ไม่ได้';
                validateStatus.className = 'validate-status invalid';
            } finally {
                validateBtn.classList.remove('loading');
                validateBtn.disabled = false;
            }
        };
    }

    // Initial load for notice
    loadSettingsToUI();

    // --- Message helpers ---
    function scrollBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
        }
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

        const settings = getSettings();
        keywordInput.value = '';
        keywordInput.blur();

        // Start a new chat session for this keyword
        const chat = startChatSession(keyword);
        const chatId = chat.id;

        addMessage(`Searching for news about: ${keyword}`, 'user');
        addMessageToChat(chatId, `Searching for news about: ${keyword}`, 'user');

        const loadingMsg = createMessageElement("กำลังเตรียมการ...", 'assistant');
        loadingMsg.id = `loading-${chatId}`;
        messagesContainer.appendChild(loadingMsg);
        scrollBottom();

        // Register active task
        activeTasks.set(chatId, { step: 'init', message: 'กำลังเตรียมการ...', element: loadingMsg });

        try {
            let url = `/news?keyword=${encodeURIComponent(keyword)}`;
            if (settings.apiKey) url += `&api_key=${encodeURIComponent(settings.apiKey)}`;
            if (settings.model) url += `&model=${encodeURIComponent(settings.model)}`;

            const response = await fetch(url);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        
                        // Update active task state
                        const task = activeTasks.get(chatId);
                        if (task) {
                            task.step = data.step;
                            task.message = data.message;
                            
                            // If user is currently looking at this chat, update UI
                            if (currentChatId === chatId) {
                                const el = document.getElementById(`loading-${chatId}`);
                                if (el) {
                                    el.querySelector('.content').innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${data.message} ${data.progress ? `(${data.progress}%)` : ''}`;
                                }
                            }
                        }

                        if (data.step === 'done') {
                            activeTasks.delete(chatId);
                            
                            // Remove loading message from UI if visible
                            if (currentChatId === chatId) {
                                const el = document.getElementById(`loading-${chatId}`);
                                if (el) el.remove();
                            }

                            const summaryText = data.summary || "ไม่พบข้อมูลสรุป";
                            addMessage(summaryText, 'assistant');
                            addMessageToChat(chatId, summaryText, 'assistant');

                            // Show images
                            const rawImgs = data.images || [];
                            if (rawImgs.length > 0) {
                                let imgHtml = '<div class="news-images">';
                                rawImgs.forEach(item => {
                                    const src = typeof item === 'string' ? item : item.src;
                                    const link = typeof item === 'string' ? '' : (item.link || '');
                                    if (link) {
                                        imgHtml += `<a href="${link}" target="_blank" rel="noopener noreferrer"><img src="${src}" class="message-image" onerror="this.parentElement.style.display='none'"></a>`;
                                    } else {
                                        imgHtml += `<img src="${src}" class="message-image" onerror="this.style.display='none'">`;
                                    }
                                });
                                imgHtml += '</div>';

                                const imgDiv = document.createElement('div');
                                imgDiv.className = 'message assistant-message glass';
                                imgDiv.innerHTML = imgHtml;
                                messagesContainer.appendChild(imgDiv);
                                scrollBottom();
                                addMessageToChat(chatId, imgHtml, 'assistant', true);
                            }
                        } else if (data.step === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        console.error("Error parsing stream chunk:", e, line);
                    }
                }
            }
        } catch (error) {
            activeTasks.delete(chatId);
            const el = document.getElementById(`loading-${chatId}`);
            if (el) el.remove();
            
            const errMsg = `เกิดข้อผิดพลาด: ${error.message}`;
            addMessage(errMsg, 'assistant');
            addMessageToChat(chatId, errMsg, 'assistant');
        }
    }

    // --- Chat Message ---
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        const settings = getSettings();
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
            let url = `/chat?message=${encodeURIComponent(text)}`;
            if (settings.apiKey) url += `&api_key=${encodeURIComponent(settings.apiKey)}`;
            if (settings.model) url += `&model=${encodeURIComponent(settings.model)}`;

            const response = await fetch(url);
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

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            createNewChat();
        });
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            const container = document.getElementById('messages-container');
            const messages = container.querySelectorAll('.message');
            
            if (messages.length === 0 || (messages.length === 1 && messages[0].classList.contains('welcome-screen'))) {
                alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
                return;
            }

            // Create a clean clone for PDF export
            const exportArea = document.createElement('div');
            exportArea.className = 'pdf-export-area';
            
            // Add a Header to the PDF
            const history = getChatHistory();
            const chat = history.find(c => c.id === currentChatId);
            const title = chat ? chat.keyword : "Newwis Chat Export";
            const date = new Date().toLocaleDateString('th-TH', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });

            const header = document.createElement('div');
            header.className = 'pdf-header';
            header.innerHTML = `
                <h1>Newwis - AI News Summary</h1>
                <div class="pdf-meta">
                    <p><strong>Topic:</strong> ${title}</p>
                    <p><strong>Export Date:</strong> ${date}</p>
                </div>
                <hr>
            `;
            exportArea.appendChild(header);

            // Clone messages
            messages.forEach(msg => {
                if (msg.classList.contains('welcome-screen')) return;
                if (msg.id && msg.id.startsWith('loading-')) return;

                const clone = msg.cloneNode(true);
                // Remove any interactive icons/buttons from clone if any
                clone.querySelectorAll('button, .fa-copy, .fa-file-pdf').forEach(el => el.remove());
                
                // Ensure text is visible in PDF (sometimes glassmorphism makes it hard to see on plain white)
                clone.style.background = msg.classList.contains('user-message') ? '#f3f4f6' : '#ffffff';
                clone.style.color = '#111827';
                clone.style.marginBottom = '15px';
                clone.style.padding = '15px';
                clone.style.borderRadius = '8px';
                clone.style.border = '1px solid #e5e7eb';
                clone.style.boxShadow = 'none';
                clone.style.opacity = '1';

                exportArea.appendChild(clone);
            });

            // Set PDF options
            const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_') || 'Export';
            const fileName = `NewsSummary_${safeTitle}.pdf`;
            console.log('Starting PDF export with filename:', fileName);

            const opt = {
                margin:       [10, 10],
                filename:     fileName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    logging: true, // Enable html2canvas logging
                    letterRendering: true 
                },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Generate and save PDF with a more robust method
            exportArea.style.position = 'fixed';
            exportArea.style.left = '-9999px';
            exportArea.style.top = '0';
            document.body.appendChild(exportArea);

            // Using the worker API with explicit steps
            html2pdf().set(opt).from(exportArea).toPdf().save().then(() => {
                console.log('PDF export successful');
                document.body.removeChild(exportArea);
            }).catch(err => {
                console.error('PDF Export Worker Error:', err);
                if (exportArea.parentNode) document.body.removeChild(exportArea);
                alert('เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message);
            });
        });
    }

    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', () => {
            const messages = messagesContainer.querySelectorAll('.message');
            if (messages.length === 0) return;

            let fullText = "";
            messages.forEach(msg => {
                // Skip loading or error messages if they are currently visible/specific
                if (msg.textContent.includes("กำลังพิมพ์...") || msg.id.startsWith('loading-')) return;
                
                const role = msg.classList.contains('user-message') ? "User" : "AI";
                // Get text content, removing image HTML if present
                const text = msg.innerText.trim();
                if (text) {
                    fullText += `[${role}]:\n${text}\n\n`;
                }
            });

            if (!fullText.trim()) return;

            navigator.clipboard.writeText(fullText.trim()).then(() => {
                // Visual feedback
                const originalClass = copyAllBtn.className;
                copyAllBtn.className = "fas fa-check";
                copyAllBtn.style.color = "#22c55e"; // Success green
                setTimeout(() => {
                    copyAllBtn.className = originalClass;
                    copyAllBtn.style.color = "";
                }, 2000);
            }).catch(err => {
                console.error("Failed to copy text:", err);
                alert("ไม่สามารถคัดลอกข้อความได้");
            });
        });
    }
});