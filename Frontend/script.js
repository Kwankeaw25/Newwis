// Google OAuth Callback (Must be in global scope)
function handleCredentialResponse(response) {
    try {
        // Decode the JWT token payload
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);

        // Extract info
        const email = payload.email || '';
        const nameBeforeAt = email.includes('@') ? email.split('@')[0] : (payload.name || 'User');
        const picture = payload.picture;

        const userData = {
            name: nameBeforeAt,
            email: email,
            picture: picture
        };

        // Save to localStorage
        localStorage.setItem('google_user', JSON.stringify(userData));

        // Update UI
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
    document.getElementById('user-email').textContent = userData.email;

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
            const userData = JSON.parse(savedUser);
            displayUserProfile(userData);
        } catch (e) {
            console.error("Error loading saved user:", e);
            localStorage.removeItem('google_user');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    checkLoginState();

    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const keywordInput = document.getElementById('keyword-input');

    const settingsModal = document.getElementById('settings-modal');
    const openSettings = document.querySelector('.settings-btn');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');

    // --- Modal Logic ---
    if (openSettings) {
        openSettings.onclick = () => settingsModal.style.display = 'flex';
    }
    if (closeSettings) {
        closeSettings.onclick = () => settingsModal.style.display = 'none';
    }
    window.onclick = (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    };
    if (saveSettings) {
        saveSettings.onclick = () => {
            settingsModal.style.display = 'none';
        };
    }

    // --- Message Logic ---
    function createMessage(content, role) {
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

    function scrollBottom() {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    function addMessage(text, role) {
        const welcome = document.querySelector('.welcome-screen');
        if (welcome) welcome.style.display = 'none';

        messagesContainer.appendChild(createMessage(text, role));
        scrollBottom();
    }

    async function handleKeywordSearch() {
        const keyword = keywordInput.value.trim();
        if (!keyword) return;

        keywordInput.value = '';
        keywordInput.blur();

        addMessage(`Searching for news about: ${keyword}`, 'user');

        const loadingMsg = createMessage("Searching and summarizing news Please wait.", 'assistant');
        messagesContainer.appendChild(loadingMsg);
        scrollBottom();

        try {
            const response = await fetch(`http://localhost:8000/news?keyword=${encodeURIComponent(keyword)}`);
            const text = await response.text();
            loadingMsg.remove();

            try {
                const data = JSON.parse(text);
                const summaryText = data.summary || data.error || "ไม่พบข้อมูล";
                
                // สร้างข้อความสรุป
                addMessage(summaryText, 'assistant');
                
                // แสดงรูปภาพด้านล่าง (สูงสุด 2 รูป)
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
                }
            } catch (e) {
                addMessage(text, 'assistant');
            }
        } catch (error) {
            loadingMsg.remove();
            addMessage(`Error: Unable to reach the server. Make sure the FastAPI app is running.\n\nDetails: ${error.message}`, 'assistant');
        }
    }

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';
        input.style.height = 'auto';

        const loadingMsg = createMessage("กำลังพิมพ์...", 'assistant');
        messagesContainer.appendChild(loadingMsg);
        scrollBottom();

        try {
            const response = await fetch(`http://localhost:8000/chat?message=${encodeURIComponent(text)}`);
            const responseText = await response.text();
            loadingMsg.remove();

            try {
                const data = JSON.parse(responseText);
                addMessage(data.response || data.error || "ไม่พบข้อมูล", 'assistant');
            } catch (e) {
                addMessage(responseText, 'assistant');
            }
        } catch (error) {
            loadingMsg.remove();
            addMessage(`เกิดข้อผิดพลาด: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (${error.message})`, 'assistant');
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

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (keywordInput) {
        keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleKeywordSearch();
            }
        });
    }
});