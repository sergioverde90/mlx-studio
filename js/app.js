const CONFIG_KEY = 'tars_config';
const CONVERSATIONS_KEY = 'tars_conversations';

const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:8080/v1/chat/completions',
    systemPrompt: '',
    temperature: 0.8,
    minP: 0.06,
    presencePenalty: 1.2,
    repeatPenalty: 1.05,
    thinkingBudget: 512,
    enableThinking: true
};

let config = loadConfig();
let conversations = loadConversations();
let currentConversationId = null;
let abortController = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const conversationsList = document.getElementById('conversations-list');
const newChatBtn = document.getElementById('new-chat-btn');
const messagesContainer = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcome-screen');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const chatContainer = document.getElementById('chat-container');
const sidebarToggle = document.getElementById('sidebar-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const sidebarOverlay = document.createElement('div');
sidebarOverlay.id = 'sidebar-overlay';
document.body.appendChild(sidebarOverlay);

// Configure marked
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// Initialize
function init() {
    renderConversations();
    loadLastConversation();
    setupEventListeners();
    loadSettings();
    messageInput.focus();
}

function loadConfig() {
    try {
        const saved = localStorage.getItem(CONFIG_KEY);
        return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadConversations() {
    try {
        const saved = localStorage.getItem(CONVERSATIONS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function saveConversations() {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function loadLastConversation() {
    if (conversations.length > 0) {
        const lastConv = conversations[conversations.length - 1];
        selectConversation(lastConv.id);
    }
}

function createConversation() {
    const conv = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now()
    };
    conversations.unshift(conv);
    saveConversations();
    selectConversation(conv.id);
    renderConversations();
    messageInput.focus();
}

function selectConversation(id) {
    currentConversationId = id;
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    welcomeScreen.style.display = 'none';
    renderMessages(conv.messages);
    renderConversations();

    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

function deleteConversation(id, e) {
    e.stopPropagation();
    conversations = conversations.filter(c => c.id !== id);
    saveConversations();

    if (currentConversationId === id) {
        if (conversations.length > 0) {
            selectConversation(conversations[0].id);
        } else {
            currentConversationId = null;
            messagesContainer.innerHTML = '';
            welcomeScreen.style.display = 'flex';
        }
    }
    renderConversations();
}

function renderConversations() {
    conversationsList.innerHTML = '';
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item' + (conv.id === currentConversationId ? ' active' : '');
        item.innerHTML = `
            <span class="conversation-title">${escapeHtml(conv.title)}</span>
            <button class="conversation-delete" title="Delete">&times;</button>
        `;
        item.addEventListener('click', () => selectConversation(conv.id));
        item.querySelector('.conversation-delete').addEventListener('click', (e) => deleteConversation(conv.id, e));
        conversationsList.appendChild(item);
    });
}

function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        appendMessage(msg.role, msg.content, false);
    });
    scrollToBottom();
}

function appendMessage(role, content, animate = true) {
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }

    const messageEl = document.createElement('div');
    const isMarkdown = role === 'assistant';
    messageEl.className = `message ${role}${isMarkdown ? ' text-only' : ' text-only'}`;
    if (!animate) messageEl.style.animation = 'none';

    const avatarText = role === 'user' ? 'U' : 'T';
    messageEl.innerHTML = `
        <div class="message-avatar">${avatarText}</div>
        <div class="message-content">
            <div class="message-text"></div>
        </div>
    `;

    const textEl = messageEl.querySelector('.message-text');

    if (role === 'assistant') {
        const { thinkingHtml, contentHtml } = parseThinkingAndContent(content);
        if (thinkingHtml || contentHtml) {
            if (thinkingHtml) {
                const thinkingBlock = document.createElement('div');
                thinkingBlock.className = 'thinking-block';
                thinkingBlock.innerHTML = `
                    <button class="thinking-toggle" onclick="toggleThinking(this)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        Thinking...
                    </button>
                    <div class="thinking-content">
                        <div class="message text-only"></div>
                    </div>
                `;
                textEl.innerHTML = '';
                textEl.appendChild(thinkingBlock);
                thinkingBlock.querySelector('.thinking-content .message.text-only').innerHTML = marked.parse(thinkingHtml);
            }
            if (contentHtml) {
                if (thinkingHtml) {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'message text-only';
                    contentDiv.innerHTML = marked.parse(contentHtml);
                    textEl.appendChild(contentDiv);
                } else {
                    textEl.innerHTML = marked.parse(contentHtml);
                }
            }
        } else {
            textEl.innerHTML = escapeHtml(content);
        }
    } else {
        textEl.innerHTML = escapeHtml(content);
    }

    messagesContainer.appendChild(messageEl);
    scrollToBottom();
    return messageEl;
}

function parseThinkingAndContent(content) {
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
    let thinkingParts = [];
    let contentParts = [];
    let lastIndex = 0;
    let match;

    while ((match = thinkingRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            contentParts.push(content.substring(lastIndex, match.index));
        }
        thinkingParts.push(match[1]);
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        contentParts.push(content.substring(lastIndex));
    }

    return {
        thinkingHtml: thinkingParts.join('\n'),
        contentHtml: contentParts.join('')
    };
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function updateTitle(convId, content) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    const firstLine = content.split('\n')[0];
    conv.title = firstLine.substring(0, 40) + (firstLine.length > 40 ? '...' : '');
    saveConversations();
    renderConversations();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleThinking(btn) {
    btn.classList.toggle('open');
    const content = btn.nextElementSibling;
    content.classList.toggle('open');
}

function showTypingIndicator() {
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }
    const messageEl = document.createElement('div');
    messageEl.className = 'message assistant typing';
    messageEl.id = 'typing-indicator';
    messageEl.innerHTML = `
        <div class="message-avatar">T</div>
        <div class="message-content">
            <div class="message-text">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(messageEl);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function updateMessageContent(element, content) {
    const textEl = element.querySelector('.message-text');
    if (!textEl) return;

    const { thinkingHtml, contentHtml } = parseThinkingAndContent(content);

    let thinkingBlock = textEl.querySelector('.thinking-block');
    if (thinkingHtml) {
        if (!thinkingBlock) {
            thinkingBlock = document.createElement('div');
            thinkingBlock.className = 'thinking-block';
            thinkingBlock.innerHTML = `
                <button class="thinking-toggle" onclick="toggleThinking(this)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    Thinking...
                </button>
            <div class="thinking-content">
                    <div class="message text-only"></div>
                </div>
            `;
            textEl.insertBefore(thinkingBlock, textEl.firstChild);
        }
        thinkingBlock.querySelector('.thinking-content .message.text-only').textContent = thinkingHtml;
    } else if (thinkingBlock) {
        thinkingBlock.remove();
    }

    if (contentHtml) {
        if (thinkingHtml) {
            let contentDiv = textEl.querySelector(':scope > div.message.text-only');
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'message text-only';
                textEl.appendChild(contentDiv);
            }
            contentDiv.innerHTML = marked.parse(contentHtml);
        } else {
            textEl.innerHTML = marked.parse(contentHtml);
        }
    }

    scrollToBottom();
}

function buildRequestMessages() {
    const conv = conversations.find(c => c.id === currentConversationId);
    if (!conv) return [];

    let messages = conv.messages.map(m => ({ role: m.role, content: m.content }));

    const systemPrompt = config.systemPrompt || '';
    if (systemPrompt) {
        messages.unshift({ role: 'system', content: systemPrompt });
    }

    return messages;
}

function buildRequestPayload(messages) {
    const payload = {
        model: 'unsloth/Qwen3.6-35B-A3B-UD-MLX-4bit',
        messages: messages,
        stream: true,
        temperature: config.temperature,
        min_p: config.minP,
        presence_penalty: config.presencePenalty,
        repeat_penalty: config.repeatPenalty,
        thinking_budget_tokens: config.thinkingBudget,
        chat_template_kwargs: {
            enable_thinking: config.enableThinking,
            preserve_thinking: false
        }
    };

    return payload;
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentConversationId) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    const conv = conversations.find(c => c.id === currentConversationId);
    if (!conv) return;

    conv.messages.push({ role: 'user', content: text });
    if (conv.messages.length === 1) {
        updateTitle(currentConversationId, text);
    }
    saveConversations();
    appendMessage('user', text);

    showTypingIndicator();

    const messages = buildRequestMessages();
    const payload = buildRequestPayload(messages);

    abortController = new AbortController();

    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        removeTypingIndicator();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let normalContent = '';
        let assistantEl = null;
        let thinkingContent = '';
        let thinkingBlock = null;
        let thinkingContentEl = null;
        let hasThinking = false;
        let hasContent = false;
        let tokenCount = 0;
        let startTime = null;
        let firstTokenTime = null;
        let statsEl = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!startTime) {
                startTime = Date.now();
                firstTokenTime = startTime;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(trimmed.slice(6));
                    const choice = data.choices?.[0];
                    if (!choice) continue;

                    const delta = choice.delta;
                    const content = delta?.content;
                    const reasoning = delta?.reasoning;

                    if (content) tokenCount += content.trim().split(/\s+/).filter(w => w).length;
                    if (reasoning) tokenCount += reasoning.trim().split(/\s+/).filter(w => w).length;

                    if (!assistantEl) {
                        assistantEl = appendMessage('assistant', '', false);
                        statsEl = document.createElement('div');
                        statsEl.className = 'message-stats';
                        statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">0.0</span>`;
                        const messageContent = assistantEl.querySelector('.message-content');
                        messageContent.appendChild(statsEl);
                    } else {
                        const elapsed = (Date.now() - firstTokenTime) / 1000;
                        const speed = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : '0.0';
                        statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">${speed} tok/s</span>`;
                    }

                    if (reasoning) {
                        hasThinking = true;
                        thinkingContent += reasoning;
                        if (!thinkingBlock) {
                            const textEl = assistantEl.querySelector('.message-text');
                            thinkingBlock = document.createElement('div');
                            thinkingBlock.className = 'thinking-block';
                            thinkingBlock.innerHTML = `
                                <button class="thinking-toggle" onclick="toggleThinking(this)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                    Thinking...
                                </button>
                                <div class="thinking-content">
                                    <div class="message text-only"></div>
                                </div>
                            `;
                            textEl.innerHTML = '';
                            textEl.appendChild(thinkingBlock);
                            thinkingContentEl = thinkingBlock.querySelector('.thinking-content .message.text-only');
                            thinkingBlock.querySelector('.thinking-toggle').classList.add('open');
                            thinkingBlock.querySelector('.thinking-content').classList.add('open');
                        }
                        if (thinkingContentEl) {
                            thinkingContentEl.innerHTML = marked.parse(thinkingContent);
                        }
                    }

                    if (content) {
                        hasContent = true;
                        normalContent += content;
                        if (hasThinking) {
                            let contentDiv = assistantEl.querySelector('.thinking-block')
                                ? assistantEl.querySelector('.thinking-block')?.nextElementSibling
                                : null;
                            if (!contentDiv) {
                                contentDiv = document.createElement('div');
                                contentDiv.className = 'message text-only';
                                assistantEl.querySelector('.message-text').appendChild(contentDiv);
                            }
                            contentDiv.textContent += content;
                        } else {
                            const textEl = assistantEl.querySelector('.message-text');
                            if (textEl) {
                                textEl.textContent += content;
                            }
                        }
                    }
                } catch (e) {
                    // Skip malformed JSON
                }
            }
        }

        if (!assistantEl) {
            appendMessage('assistant', '[No response received]');
        }

        const textEl = assistantEl.querySelector('.message-text');
        const normalContentDiv = textEl?.querySelector(':scope > div.message.text-only');
        if (normalContentDiv) {
            normalContentDiv.innerHTML = marked.parse(normalContent);
        } else if (textEl && normalContent) {
            textEl.innerHTML = marked.parse(normalContent);
        }

        if (statsEl && assistantEl) {
            const totalTime = ((Date.now() - firstTokenTime) / 1000).toFixed(1);
            const finalSpeed = tokenCount > 0 ? (tokenCount / ((Date.now() - firstTokenTime) / 1000)).toFixed(1) : '0.0';
            statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">${finalSpeed} tok/s</span><span class="stats-item stats-time">${totalTime}s</span>`;
        }

        let fullContent = normalContent;
        if (thinkingContent) {
            fullContent = `<thinking>\n${thinkingContent}\n</thinking>\n\n${normalContent}`;
        }
        conv.messages.push({ role: 'assistant', content: fullContent });
        saveConversations();

    } catch (err) {
        removeTypingIndicator();
        if (err.name === 'AbortError') {
            return;
        }
        console.error('Request failed:', err);
        appendMessage('assistant', `**Error:** ${err.message}`);
    } finally {
        abortController = null;
        sendBtn.disabled = false;
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        messageInput.focus();
    }
}

function stopGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

function setupEventListeners() {
    newChatBtn.addEventListener('click', createConversation);

    sendBtn.addEventListener('click', () => {
        if (messageInput.value.trim() && !sendBtn.disabled) sendMessage();
    });

    stopBtn.addEventListener('click', stopGeneration);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        sendBtn.disabled = !messageInput.value.trim();
    });

    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('visible');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    sidebarOverlay.addEventListener('click', closeSidebar);

    settingsBtn.addEventListener('click', () => {
        settingsOverlay.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsOverlay.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        config.apiUrl = document.getElementById('setting-api-url').value || DEFAULT_CONFIG.apiUrl;
        config.systemPrompt = document.getElementById('setting-system-prompt').value;
        config.temperature = parseFloat(document.getElementById('setting-temperature').value) || DEFAULT_CONFIG.temperature;
        config.minP = parseFloat(document.getElementById('setting-min-p').value) || DEFAULT_CONFIG.minP;
        config.presencePenalty = parseFloat(document.getElementById('setting-presence-penalty').value) || DEFAULT_CONFIG.presencePenalty;
        config.repeatPenalty = parseFloat(document.getElementById('setting-repeat-penalty').value) || DEFAULT_CONFIG.repeatPenalty;
        config.thinkingBudget = parseInt(document.getElementById('setting-thinking-budget').value) || DEFAULT_CONFIG.thinkingBudget;
        config.enableThinking = document.getElementById('setting-enable-thinking').checked;
        saveConfig();
        settingsOverlay.classList.add('hidden');
    });

    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            settingsOverlay.classList.add('hidden');
            if (window.innerWidth <= 768) closeSidebar();
        }
    });
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

function loadSettings() {
    document.getElementById('setting-api-url').value = config.apiUrl || '';
    document.getElementById('setting-system-prompt').value = config.systemPrompt || '';
    document.getElementById('setting-temperature').value = config.temperature ?? '';
    document.getElementById('setting-min-p').value = config.minP ?? '';
    document.getElementById('setting-presence-penalty').value = config.presencePenalty ?? '';
    document.getElementById('setting-repeat-penalty').value = config.repeatPenalty ?? '';
    document.getElementById('setting-thinking-budget').value = config.thinkingBudget ?? '';
    document.getElementById('setting-enable-thinking').checked = config.enableThinking !== false;
}

init();
