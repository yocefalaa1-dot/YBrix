const API_URL='/api/chat';
const IMAGE_API = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

let chatHistory = [];
let isProcessing = false;

const elements = {
    messagesArea: document.getElementById('messagesArea'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    imageGenBtn: document.getElementById('imageGenBtn'),
    clearBtn: document.getElementById('clearBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    voiceBtn: document.getElementById('voiceBtn'),
    typingIndicator: document.getElementById('typingIndicator'),
    imageModal: document.getElementById('imageModal'),
    imagePrompt: document.getElementById('imagePrompt'),
    generateImageBtn: document.getElementById('generateImageBtn'),
    cancelImageBtn: document.getElementById('cancelImageBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn')
};

elements.sendBtn.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
elements.fileInput.addEventListener('change', handleFileUpload);
elements.imageGenBtn.addEventListener('click', () => openModal('imageModal'));
elements.generateImageBtn.addEventListener('click', generateImage);
elements.cancelImageBtn.addEventListener('click', () => closeModal('imageModal'));
elements.settingsBtn.addEventListener('click', () => openModal('settingsModal'));
elements.closeSettingsBtn.addEventListener('click', () => closeModal('settingsModal'));
elements.clearBtn.addEventListener('click', clearChat);

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal('imageModal');
        closeModal('settingsModal');
    });
});

async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || isProcessing) return;

    addMessage(message, 'user');
    elements.messageInput.value = '';
    autoResize(elements.messageInput);

    showTyping();
    isProcessing = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                history: chatHistory,
                max_tokens: 4096,
                temperature: 0.7
            })
        });

        const data = await response.json();
        hideTyping();

        if (data.success) {
            addMessage(data.response, 'assistant');
            chatHistory.push([message, data.response]);
        } else {
            showToast('Error: ' + data.response, 'error');
        }
    } catch (error) {
        hideTyping();
        showToast('Connection error. Please try again.', 'error');
    }

    isProcessing = false;
}

function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<div class="avatar-icon"></div>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
        <span class="message-sender">${type === 'user' ? 'You' : 'YBrix'}</span>
        <span class="message-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
    `;

    const body = document.createElement('div');
    body.className = 'message-body';
    
    if (type === 'assistant') {
        body.innerHTML = marked.parse(content);
        body.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    } else {
        body.textContent = content;
    }

    contentDiv.appendChild(header);
    contentDiv.appendChild(body);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    elements.messagesArea.appendChild(messageDiv);
    elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const content = event.target.result;
        const message = `I uploaded a file: ${file.name}\n\nContent:\n${content.substring(0, 3000)}`;
        
        addMessage(`Uploaded: ${file.name}`, 'user');
        elements.messageInput.value = '';
        
        showTyping();
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: chatHistory
                })
            });

            const data = await response.json();
            hideTyping();

            if (data.success) {
                addMessage(data.response, 'assistant');
            }
        } catch (error) {
            hideTyping();
            showToast('Error processing file', 'error');
        }
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
}

async function generateImage() {
    const prompt = elements.imagePrompt.value.trim();
    if (!prompt) {
        showToast('Please enter a description', 'error');
        return;
    }

    closeModal('imageModal');
    addMessage(`Generate image: ${prompt}`, 'user');
    showTyping();

    try {
        const response = await fetch(IMAGE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: prompt })
        });

        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        
        hideTyping();
        
        const imgHTML = `<img src="${imageUrl}" alt="${prompt}" style="max-width: 100%; border-radius: 8px; margin-top: 0.5rem;">`;
        addMessage(`Generated image: ${prompt}\n\n${imgHTML}`, 'assistant');
        
        elements.imagePrompt.value = '';
    } catch (error) {
        hideTyping();
        showToast('Image generation failed', 'error');
    }
}

function clearChat() {
    if (confirm('Clear all messages?')) {
        chatHistory = [];
        elements.messagesArea.innerHTML = '';
        showToast('Chat cleared', 'success');
    }
}

function showTyping() {
    elements.typingIndicator.style.display = 'flex';
    elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
}

function hideTyping() {
    elements.typingIndicator.style.display = 'none';
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

elements.messageInput.addEventListener('input', () => autoResize(elements.messageInput));
