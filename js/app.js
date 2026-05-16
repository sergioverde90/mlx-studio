import { DOM_IDS, UI, SETTINGS_FIELDS, SLASH_COMMANDS } from './config.js';
import { state, els, getEl, cacheEl, saveConfig, saveConversations, generateId } from './store.js';
import {
    renderConversations,
    renderMessages,
    appendMessage,
    highlightAllCode,
    scrollToBottom,
    showTypingIndicator,
    removeTypingIndicator,
    escapeHtml
} from './renderer.js';
import {
    sendStreamingMessage,
    buildRequestMessages,
    buildRequestPayload,
    copyCodeToClipboard
} from './api.js';
import {
    setupSidebar,
    setupSettings,
    loadSettingsIntoUI,
    updateApiUrlToggleVisual,
    updateThinkingToggleVisual,
    setupInputAutoResize,
    isMobile,
    closeSidebar,
    setBackendToggleState
} from './ui.js';
import { SlashCommandManager } from './slash-commands.js';

// === PDF Upload State ===
let currentPdfFile = null;

// === API URL ===
function getApiUrl() {
    return state.config.useLocalStudioUrl
        ? 'http://localhost:8081/v1/chat/completions'
        : 'http://localhost:8080/v1/chat/completions';
}

// === Backend Reachability Check ===
async function checkBackendReachable() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch('http://localhost:8081/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [], model: '' }),
            signal: controller.signal
        });
        state.isBackendReachable = true;
    } catch {
        state.isBackendReachable = false;
    }
    setBackendToggleState(els[DOM_IDS.apiUrlToggleBtn], els[DOM_IDS.pdfUploadBtn], state.isBackendReachable);
}

// === DOM Initialization ===
function initDOM() {
    cacheEl(DOM_IDS.sidebar);
    cacheEl(DOM_IDS.conversationsList);
    cacheEl(DOM_IDS.newChatBtn);
    cacheEl(DOM_IDS.messages);
    cacheEl(DOM_IDS.welcomeScreen);
    cacheEl(DOM_IDS.messageInput);
    cacheEl(DOM_IDS.sendBtn);
    cacheEl(DOM_IDS.stopBtn);
    cacheEl(DOM_IDS.settingsOverlay);
    cacheEl(DOM_IDS.apiUrlToggleBtn);
    cacheEl(DOM_IDS.thinkingToggleBtn);
    cacheEl(DOM_IDS.pdfUploadBtn);
    cacheEl(DOM_IDS.pdfFileInput);
    cacheEl(DOM_IDS.fileInfo);
    cacheEl(DOM_IDS.closeSettings);
    cacheEl(DOM_IDS.saveSettings);
    cacheEl(DOM_IDS.sidebarOverlay);

    if (!els[DOM_IDS.sidebarOverlay]) {
        const overlay = document.createElement('div');
        overlay.id = DOM_IDS.sidebarOverlay;
        document.body.appendChild(overlay);
        els[DOM_IDS.sidebarOverlay] = overlay;
    }
}

// === PDF Upload Functions ===
function handlePdfFile(file, pdfUploadBtn, fileInfo) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Please select a PDF file');
        return;
    }

    if (file.size > UI.MAX_FILE_SIZE) {
        alert(`File size exceeds ${UI.MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return;
    }

    if (currentPdfFile) {
        currentPdfFile = null;
        pdfUploadBtn.classList.remove('active');
        fileInfo.classList.add('hidden');
        document.getElementById(DOM_IDS.pdfFileInput).value = '';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const commaIndex = e.target.result.indexOf(',');
        const base64Content = commaIndex > 0 ? e.target.result.substring(commaIndex + 1) : e.target.result;
        currentPdfFile = {
            file: file,
            base64: base64Content,
            name: file.name,
            size: file.size
        };

        pdfUploadBtn.classList.add('active');
        fileInfo.classList.remove('hidden');
        fileInfo.innerHTML = `
            <span>📄 ${escapeHtml(file.name)}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="remove-file-btn" title="Remove file">&times;</button>
        `;

        fileInfo.querySelector('.remove-file-btn').addEventListener('click', () => {
            currentPdfFile = null;
            pdfUploadBtn.classList.remove('active');
            fileInfo.classList.add('hidden');
            document.getElementById(DOM_IDS.pdfFileInput).value = '';
        });
    };
    reader.onerror = () => alert('Error reading file');
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// === Conversation Management ===
function createNewConversation() {
    const emptyConvCount = state.conversations.filter(c => c.messages.length === 0).length;
    if (emptyConvCount >= 1) {
        alert('Max 1 empty conversation allowed. Add a message to the existing empty conversation or delete it first.');
        return;
    }
    const conv = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now()
    };
    state.conversations.unshift(conv);
    saveConversations(state.conversations);
    selectConversation(conv.id);
    renderConversationsUI();
    els[DOM_IDS.welcomeScreen].style.display = 'flex';
    els[DOM_IDS.messageInput].focus();
}

function selectConversation(id) {
    state.currentConversationId = id;
    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;

    els[DOM_IDS.welcomeScreen].style.display = 'none';
    renderMessages(els[DOM_IDS.messages], conv.messages,
        () => {},
        () => {},
        copyCodeToClipboard,
        null
    );
    renderConversationsUI();

    if (isMobile()) closeSidebar();
}

function handleDeleteConversation(id) {
    const wasCurrent = state.currentConversationId === id;
    state.conversations = state.conversations.filter(c => c.id !== id);
    saveConversations(state.conversations);

    if (wasCurrent) {
        if (state.conversations.length > 0) {
            state.currentConversationId = state.conversations[0].id;
        } else {
            state.currentConversationId = null;
            els[DOM_IDS.messages].innerHTML = '';
            els[DOM_IDS.welcomeScreen].style.display = 'flex';
        }
    }
    renderConversationsUI();
    if (state.currentConversationId) {
        const conv = state.conversations.find(c => c.id === state.currentConversationId);
        if (conv) {
            els[DOM_IDS.welcomeScreen].style.display = 'none';
            renderMessages(els[DOM_IDS.messages], conv.messages,
                () => {},
                () => {},
                copyCodeToClipboard,
                null
            );
            highlightAllCode(els[DOM_IDS.messages]);
        }
    }
}

function handleTitleUpdate(convId, content) {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv) return;
    const firstLine = content.split('\n')[0];
    conv.title = firstLine.substring(0, UI.TITLE_MAX_LENGTH) + (firstLine.length > UI.TITLE_MAX_LENGTH ? '...' : '');
    saveConversations();
    renderConversationsUI();
}

// === Message Sending ===
async function sendMessage() {
    const text = els[DOM_IDS.messageInput].innerText.trim();
    if (!text && !currentPdfFile) return;

    if (!state.currentConversationId) {
        const emptyConvCount = state.conversations.filter(c => c.messages.length === 0).length;
        if (emptyConvCount >= 1) {
            // Reuse the existing empty conversation instead of creating a new one
            const emptyConv = state.conversations.find(c => c.messages.length === 0);
            state.currentConversationId = emptyConv.id;
        } else {
            createNewConversation();
        }
    }

    const conv = state.conversations.find(c => c.id === state.currentConversationId);
    if (conv && conv.messages.length === 0) {
        els[DOM_IDS.welcomeScreen].style.display = 'none';
        conv.title = text.substring(0, UI.TITLE_MAX_LENGTH) + (text.length > UI.TITLE_MAX_LENGTH ? '...' : '');
        saveConversations();
    }

    let messageContent = text;
    let pdfAttachment = null;
    if (currentPdfFile) {
        messageContent = `[PDF-ATTACHMENT:${currentPdfFile.name}]\n${text}`;
        pdfAttachment = {
            name: currentPdfFile.name,
            size: currentPdfFile.size,
            base64: currentPdfFile.base64
        };
    }

    els[DOM_IDS.messageInput].innerHTML = '';
    els[DOM_IDS.sendBtn].disabled = true;
    els[DOM_IDS.sendBtn].classList.add('hidden');
    els[DOM_IDS.stopBtn].classList.remove('hidden');

    if (!conv) return;

    const userMessage = { role: 'user', content: messageContent };
    if (pdfAttachment) userMessage.pdfAttachment = pdfAttachment;
    conv.messages.push(userMessage);
    currentPdfFile = null;
    els[DOM_IDS.pdfUploadBtn].classList.remove('active');
    els[DOM_IDS.fileInfo].classList.add('hidden');
    els[DOM_IDS.pdfFileInput].value = '';
    if (conv.messages.length === 1) handleTitleUpdate(state.currentConversationId, messageContent);
    saveConversations();
    appendMessage(els[DOM_IDS.messages], 'user', messageContent);

    showTypingIndicator(els[DOM_IDS.messages]);

    state.isGenerating = true;

    const abortController = new AbortController();
    state.abortController = abortController;

    sendStreamingMessage(
        state.config,
        getApiUrl(),
        state.conversations,
        state.currentConversationId,
        (fullContent) => {
            state.abortController = null;
            conv.messages.push({ role: 'assistant', content: fullContent });
            saveConversations();
            finishGeneration();
        },
        () => {},
        (errorMsg) => {
            appendMessage(els[DOM_IDS.messages], 'assistant', `**Error:** ${errorMsg}`);
            finishGeneration();
        },
        () => finishGeneration(),
        abortController
    );
}

// === Compact Command ===
async function handleCompactCommand() {
    const conv = state.conversations.find(c => c.id === state.currentConversationId);
    if (!conv || conv.messages.length === 0) {
        alert('No conversation history to compact');
        return;
    }

    const conversationHistory = conv.messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const compactPrompt = `Summarize the entire conversation below in markdown format. Be concise but preserve important information. Return ONLY the markdown content, no explanations or additional text.

Conversation history:
${conversationHistory}`;

    els[DOM_IDS.messageInput].innerText = 'Compacting conversation...';
    els[DOM_IDS.messageInput].querySelectorAll('.command-span').forEach(el => el.remove());
    els[DOM_IDS.sendBtn].disabled = true;
    els[DOM_IDS.stopBtn].classList.remove('hidden');
    els[DOM_IDS.stopBtn].textContent = 'Stop Compacting';
    document.getElementById('loading-overlay').classList.remove('hidden');

    const abortController = new AbortController();

    const messages = buildRequestMessages(state.conversations, state.currentConversationId, state.config);
    messages.push({ role: 'user', content: [{ type: 'text', text: compactPrompt }] });
    const payload = buildRequestPayload(state.config, messages);

    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const reader = response.body.getReader();
        let buffer = '';
        let markdownContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += new TextDecoder().decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;

                let jsonStr = trimmed;
                if (trimmed.startsWith('data: ')) jsonStr = trimmed.slice(6);
                else if (trimmed.startsWith('data:')) jsonStr = trimmed.slice(5);
                else continue;

                try {
                    const data = JSON.parse(jsonStr.trim());
                    const choice = data.choices?.[0];
                    if (!choice) continue;
                    const content = choice.delta?.content;
                    if (content) markdownContent += content;
                } catch { /* skip malformed JSON */ }
            }
        }

        conv.messages = [{ role: 'assistant', content: markdownContent }];
        conv.title = 'Compact Summary';
        saveConversations();

        els[DOM_IDS.messages].innerHTML = '';
        appendMessage(els[DOM_IDS.messages], 'assistant', markdownContent);
        highlightAllCode(els[DOM_IDS.messages]);

        document.getElementById('loading-overlay').classList.add('hidden');
        els[DOM_IDS.messageInput].innerHTML = '';
        els[DOM_IDS.sendBtn].disabled = false;
        els[DOM_IDS.sendBtn].classList.remove('hidden');
        els[DOM_IDS.stopBtn].classList.add('hidden');
        els[DOM_IDS.messageInput].focus();

    } catch (err) {
        if (err.name === 'AbortError') {
            document.getElementById('loading-overlay').classList.add('hidden');
            els[DOM_IDS.messageInput].innerHTML = '';
            els[DOM_IDS.sendBtn].disabled = false;
            els[DOM_IDS.sendBtn].classList.remove('hidden');
            els[DOM_IDS.stopBtn].classList.add('hidden');
        } else {
            document.getElementById('loading-overlay').classList.add('hidden');
            appendMessage(els[DOM_IDS.messages], 'assistant', `**Error:** Failed to compact conversation: ${err.message}`);
        }
        finishGeneration();
    }
}

// === Generation Control ===
function finishGeneration() {
    state.isGenerating = false;
    els[DOM_IDS.sendBtn].disabled = false;
    els[DOM_IDS.sendBtn].classList.remove('hidden');
    els[DOM_IDS.stopBtn].classList.add('hidden');
    els[DOM_IDS.messageInput].focus();
}

function stopGeneration() {
    state.abortController?.abort();
    saveConversations();
    finishGeneration();
}

// === Conversation List Rendering ===
function renderConversationsUI() {
    const emptyConvCount = state.conversations.filter(c => c.messages.length === 0).length;
    const newChatBtn = els[DOM_IDS.newChatBtn];
    if (newChatBtn) {
        newChatBtn.disabled = emptyConvCount >= 1;
        newChatBtn.title = emptyConvCount >= 1 ? 'Max 1 empty conversation allowed' : 'Start a new conversation';
    }
    renderConversations(
        state.conversations,
        state.currentConversationId,
        (id) => selectConversation(id),
        (id, e) => { e.stopPropagation(); handleDeleteConversation(id); },
        (id, e) => { e.stopPropagation(); exportConversation(id); }
    );
}

// === Export ===
function exportConversationToMarkdown(id) {
    const conv = state.conversations.find(c => c.id === id);
    if (!conv || conv.messages.length === 0) {
        alert('No messages in this conversation');
        return;
    }

    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = timestamp.toTimeString().slice(0, 5).replace(/:/g, '');
    const filename = `conversation-${dateStr}-${timeStr}.md`;

    let markdown = `# ${conv.title || 'New Chat'}\n\n`;
    markdown += `Generated: ${timestamp.toLocaleString()}\n\n---\n\n`;

    for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        const roleLabel = msg.role === 'user' ? '**User**' : '**Assistant**';
        markdown += `> ${roleLabel}:\n\n`;
        markdown += msg.content;
        if (i < conv.messages.length - 1) markdown += '\n\n';
    }

    markdown += '\n---\n\n*End of conversation*';

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportConversation(id) {
    exportConversationToMarkdown(id);
}

// Make exportConversation available globally for renderer.js
if (typeof window !== 'undefined') {
    window.exportConversation = exportConversation;
    window.sendMessage = sendMessage;
}

// === Event Listeners ===
function setupEventListeners() {
    els[DOM_IDS.newChatBtn].addEventListener('click', createNewConversation);

    els[DOM_IDS.apiUrlToggleBtn].addEventListener('click', () => {
        if (!state.isBackendReachable) return;
        state.config.useLocalStudioUrl = !state.config.useLocalStudioUrl;
        saveConfig(state.config);
        updateApiUrlToggleVisual(els[DOM_IDS.apiUrlToggleBtn], state.config.useLocalStudioUrl);
    setBackendToggleState(els[DOM_IDS.apiUrlToggleBtn], els[DOM_IDS.pdfUploadBtn], state.isBackendReachable);
    });

    els[DOM_IDS.thinkingToggleBtn].addEventListener('click', () => {
        state.config.enableThinking = !state.config.enableThinking;
        saveConfig(state.config);
        updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    });

    els[DOM_IDS.pdfUploadBtn].addEventListener('click', () => els[DOM_IDS.pdfFileInput].click());

    els[DOM_IDS.pdfFileInput].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handlePdfFile(file, els[DOM_IDS.pdfUploadBtn], els[DOM_IDS.fileInfo]);
    });

    els[DOM_IDS.sendBtn].addEventListener('click', sendMessage);
    els[DOM_IDS.stopBtn].addEventListener('click', stopGeneration);

    const slashManager = new SlashCommandManager(els[DOM_IDS.messageInput], SLASH_COMMANDS);

    els[DOM_IDS.messageInput].addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = els[DOM_IDS.messageInput].innerText.trim();
            if (text.startsWith('/compact')) {
                handleCompactCommand();
            } else if (!els[DOM_IDS.sendBtn].disabled) {
                sendMessage();
            }
        }
    });

    setupInputAutoResize(els[DOM_IDS.messageInput], els[DOM_IDS.sendBtn]);

    document.getElementById('messages').addEventListener('click', (e) => {
        const btn = e.target.closest('.resend-btn');
        if (!btn || state.isGenerating) return;
        const messageEl = btn.closest('.message.user');
        if (!messageEl) return;
        const conv = state.conversations.find(c => c.id === state.currentConversationId);
        if (!conv) return;

        let userIndex = parseInt(messageEl.dataset.index, 10);
        if (isNaN(userIndex)) return;
        const resendMsg = conv.messages[userIndex];
        if (!resendMsg) return;

        conv.messages = conv.messages.slice(0, userIndex + 1);
        saveConversations();
        removeTypingIndicator();
        els[DOM_IDS.messageInput].innerText = resendMsg.content;
        els[DOM_IDS.messageInput].dispatchEvent(new Event('input'));
        els[DOM_IDS.messageInput].focus();
        requestAnimationFrame(() => sendMessage());
    });

    setupSettings(state.config, (savedConfig) => {
        state.config = savedConfig;
        saveConfig(state.config);
        updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
        updateApiUrlToggleVisual(els[DOM_IDS.apiUrlToggleBtn], state.config.useLocalStudioUrl);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') els[DOM_IDS.settingsOverlay].classList.add('hidden');
    });
}

// === Initialization ===
async function init() {
    initDOM();
    renderConversationsUI();
    setupSidebar();
    setupEventListeners();
    loadSettingsIntoUI(state.config);
    updateApiUrlToggleVisual(els[DOM_IDS.apiUrlToggleBtn], state.config.useLocalStudioUrl);
    updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    els[DOM_IDS.messageInput].focus();
    await checkBackendReachable();
}

document.addEventListener('DOMContentLoaded', init);
