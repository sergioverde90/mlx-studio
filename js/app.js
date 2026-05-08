// === config.js ===
const CONFIG_KEY = 'tars_config';
const CONVERSATIONS_KEY = 'tars_conversations';

const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:8080/v1/chat/completions',
    systemPrompt: '',
    model: 'unsloth/gemma-4-E4B-E4B-it-UD-MLX-4bit',
    maxTokens: 8192,
    temperature: 0.8,
    minP: 0.06,
    presencePenalty: 1.2,
    repeatPenalty: 1.05,
    thinkingBudget: 512,
    enableThinking: true
};

const API_MODEL_PARAMS = {
    temperature: 'temperature',
    minP: 'min_p',
    presencePenalty: 'presence_penalty',
    repeatPenalty: 'repeat_penalty',
    thinkingBudget: 'thinking_budget_tokens',
    maxTokens: 'max_tokens'
};

const STREAM_LINE_PREFIX = 'data: ';
const STREAM_DONE_TOKEN = 'data: [DONE]';

const UI = {
    MAX_INPUT_HEIGHT: 200,
    TITLE_MAX_LENGTH: 40,
    MOBILE_BREAKPOINT: 768
};

const DOM_IDS = {
    sidebar: 'sidebar',
    conversationsList: 'conversations-list',
    newChatBtn: 'new-chat-btn',
    messages: 'messages',
    welcomeScreen: 'welcome-screen',
    messageInput: 'message-input',
    sendBtn: 'send-btn',
    stopBtn: 'stop-btn',
    thinkingToggleBtn: 'thinking-toggle-btn',
    chatContainer: 'chat-container',
    main: 'main',
    sidebarToggle: 'sidebar-toggle',
    settingsBtn: 'settings-btn',
    settingsOverlay: 'settings-overlay',
    closeSettings: 'close-settings',
    saveSettings: 'save-settings',
    sidebarOverlay: 'sidebar-overlay'
};

const SETTINGS_FIELDS = {
    apiUrl: 'setting-api-url',
    systemPrompt: 'setting-system-prompt',
    temperature: 'setting-temperature',
    minP: 'setting-min-p',
    presencePenalty: 'setting-presence-penalty',
    repeatPenalty: 'setting-repeat-penalty',
    thinkingBudget: 'setting-thinking-budget',
    model: 'setting-model',
    maxTokens: 'setting-max-tokens'
};

// === store.js ===
function safeParse(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch {
        return fallback;
    }
}

function loadConfig() {
    const saved = safeParse(CONFIG_KEY, {});
    return { ...DEFAULT_CONFIG, ...saved };
}

function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadConversations() {
    return safeParse(CONVERSATIONS_KEY, []);
}

function saveConversations(conversations) {
    var stringJson = JSON.stringify(conversations || state.conversations);
    localStorage.setItem(CONVERSATIONS_KEY, stringJson);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// === renderer.js ===
function renderConversations(conversations, currentId, onSelect, onDelete) {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '';

    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item' + (conv.id === currentId ? ' active' : '');
        item.innerHTML = `
            <span class="conversation-title">${escapeHtml(conv.title)}</span>
            <button class="conversation-delete" title="Delete">&times;</button>
        `;
        item.addEventListener('click', () => onSelect(conv.id));
        item.querySelector('.conversation-delete').addEventListener('click', (e) => onDelete(conv.id, e));
        list.appendChild(item);
    });
}

function renderMessages(messagesContainer, messages, onHighlight, onProcess, onCopy, onOpen) {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        appendMessage(messagesContainer, msg.role, msg.content, false);
    });
    onHighlight();
    onProcess();
    if (onCopy) {
        setupCopyButtonsOnCodeBlocks(messagesContainer, onCopy, onOpen);
    }
    scrollToBottom(true);
}

function appendMessage(container, role, content, animate = true) {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }

    const messageEl = document.createElement('div');
    const isMarkdown = role === 'assistant';
    messageEl.className = `message ${role}${isMarkdown ? ' text-only' : ' text-only'}`;
    if (!animate) messageEl.style.animation = 'none';

    const avatarText = role === 'user' ? 'U' : 'T';
    messageEl.dataset.index = container.querySelectorAll('.message.user').length;
    messageEl.innerHTML = `
        <div class="message-avatar">${avatarText}</div>
        <div class="message-content">
            <div class="message-text"></div>
            <button class="resend-btn" title="Resend"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Retry</button>
        </div>
    `;

    const textEl = messageEl.querySelector('.message-text');

    if (role === 'assistant') {
        const { thinkingHtml, contentHtml } = parseThinkingAndContent(content);
        if (thinkingHtml || contentHtml) {
            if (thinkingHtml) {
                const thinkingBlock = createThinkingBlock(thinkingHtml);
                textEl.innerHTML = '';
                textEl.appendChild(thinkingBlock);
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

    container.appendChild(messageEl);
    scrollToBottom(true);
    return messageEl;
}

function createThinkingBlock(contentHtml) {
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
    const html = marked.parse(contentHtml);
    thinkingBlock.querySelector('.thinking-content .message.text-only').innerHTML = html;
    return thinkingBlock;
}

function highlightAllCode(messagesContainer) {
    const blocks = messagesContainer.querySelectorAll('pre code[class*="language-"]');
    for (const block of blocks) {
        if (!block.closest('.thinking-block')) {
            hljs.highlightElement(block);
        }
    }
}

let userScrolledUp = false;

function scrollToBottom(force = false) {
    requestAnimationFrame(() => {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            if (force) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
                userScrolledUp = false;
            } else if (!userScrolledUp) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
    });
}

document.addEventListener('scroll', function() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
        if (distanceFromBottom > 30) {
            userScrolledUp = true;
        } else {
            userScrolledUp = false;
        }
    }
}, true);

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

if (typeof window !== 'undefined') {
    window.toggleThinking = toggleThinking;
}

function showTypingIndicator(messagesContainer) {
    const welcomeScreen = document.getElementById('welcome-screen');
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
    scrollToBottom(false);
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function updateMessageContent(assistantEl, content, onScroll) {
    const textEl = assistantEl.querySelector('.message-text');
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

    onScroll();
}

// === api.js ===
const decoder = new TextDecoder();

async function sendStreamingMessage(config, apiUrl, conversations, currentId, onComplete, onProgress, onError, onAbort, externalAbortController) {
    const messages = buildRequestMessages(conversations, currentId, config);
    const payload = buildRequestPayload(config, messages);

    const abortController = externalAbortController || new AbortController();

    try {
        const response = await fetch(apiUrl, {
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
        let buffer = '';
        let normalContent = '';
        let assistantEl = null;
        let thinkingContent = '';
        let thinkingBlock = null;
        let thinkingContentEl = null;
        let hasThinking = false;
        let hasContent = false;
        let tokenCount = 0;
        let firstTokenTime = null;
        let statsEl = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!firstTokenTime) {
                firstTokenTime = Date.now();
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === STREAM_DONE_TOKEN) continue;

                let jsonStr = trimmed;
                if (trimmed.startsWith('data: ')) {
                    jsonStr = trimmed.slice(6);
                } else if (trimmed.startsWith('data:')) {
                    jsonStr = trimmed.slice(5);
                } else {
                    continue;
                }

                try {
                    const data = JSON.parse(jsonStr.trim());
                    const choice = data.choices?.[0];
                    if (!choice) continue;

                    const delta = choice.delta;
                    const content = delta?.content;
                    const reasoning = delta?.reasoning;

                    if (content) tokenCount += countTokens(content);
                    if (reasoning) tokenCount += countTokens(reasoning);

                    if (!assistantEl) {
                        assistantEl = appendMessage(document.getElementById('messages'), 'assistant', '', false);
                        statsEl = createStatsElement(tokenCount);
                        const messageContent = assistantEl.querySelector('.message-content');
                        messageContent.appendChild(statsEl);
                    } else {
                        updateStatsElement(statsEl, tokenCount, firstTokenTime);
                    }

                    if (reasoning) {
                        hasThinking = true;
                        thinkingContent += reasoning;
                        if (!thinkingBlock) {
                            thinkingBlock = createStreamingThinkingBlock(assistantEl);
                            thinkingContentEl = thinkingBlock.querySelector('.thinking-content .message.text-only');
                            thinkingBlock.querySelector('.thinking-toggle').classList.add('open');
                            thinkingBlock.querySelector('.thinking-content').classList.add('open');
                        }
                        if (thinkingContentEl) {
                            thinkingContentEl.innerHTML = marked.parse(thinkingContent);
                        }
                        scrollToBottom(false);
                    }

                    if (content) {
                        hasContent = true;
                        normalContent += content;
                        if (hasThinking) {
                            let contentDiv = findOrCreateContentDiv(assistantEl);
                            contentDiv.innerHTML = marked.parse(normalContent);
                        } else {
                            const textEl = assistantEl.querySelector('.message-text');
                            if (textEl) textEl.innerHTML = marked.parse(normalContent);
                        }
                        scrollToBottom(false);
                        highlightAllCode(document.getElementById('messages'));
                    }

                    onProgress({ tokenCount, hasThinking, hasContent });
                } catch (e) {
                    // Skip malformed JSON
                }
            }
        }

        finalizeMessage(assistantEl, normalContent, thinkingContent, tokenCount, firstTokenTime, statsEl);

        const fullContent = buildFullContent(thinkingContent, normalContent);
        onComplete(fullContent);

        highlightAllCode(document.getElementById('messages'));
        setupCopyButtonsOnCodeBlocks(document.getElementById('messages'), copyCodeToClipboard, null);

        if (statsEl && assistantEl) {
            updateFinalStats(statsEl, tokenCount, firstTokenTime);
        }

    } catch (err) {
        removeTypingIndicator();
        if (err.name === 'AbortError') {
            onAbort();
            return;
        }
        console.error('Request failed:', err);
        onError(err.message);
    }

    return abortController;
}

function countTokens(text) {
    return text.trim().split(/\s+/).filter(w => w).length;
}

function createStatsElement(tokenCount) {
    const statsEl = document.createElement('div');
    statsEl.className = 'message-stats';
    statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">0.0</span>`;
    return statsEl;
}

function updateStatsElement(statsEl, tokenCount, firstTokenTime) {
    const elapsed = (Date.now() - firstTokenTime) / 1000;
    const speed = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : '0.0';
    statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">${speed} tok/s</span>`;
}

function createStreamingThinkingBlock(assistantEl) {
    const textEl = assistantEl.querySelector('.message-text');
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
    return thinkingBlock;
}

function findOrCreateContentDiv(assistantEl) {
    const existing = assistantEl.querySelector('.thinking-block')
        ? assistantEl.querySelector('.thinking-block')?.nextElementSibling
        : null;
    if (!existing) {
        const div = document.createElement('div');
        div.className = 'message text-only';
        assistantEl.querySelector('.message-text').appendChild(div);
        return div;
    }
    return existing;
}

function finalizeMessage(assistantEl, normalContent, thinkingContent, tokenCount, firstTokenTime, statsEl) {
    if (!assistantEl) {
        appendMessage(document.getElementById('messages'), 'assistant', '[No response received]');
        return;
    }

    const textEl = assistantEl.querySelector('.message-text');
    const normalContentDiv = textEl?.querySelector(':scope > div.message.text-only');
    if (normalContentDiv) {
        normalContentDiv.innerHTML = marked.parse(normalContent);
    } else if (textEl && normalContent) {
        textEl.innerHTML = marked.parse(normalContent);
    }
}

function buildFullContent(thinkingContent, normalContent) {
    if (thinkingContent) {
        return `<thinking>\n${thinkingContent}\n</thinking>\n\n${normalContent}`;
    }
    return normalContent;
}

function updateFinalStats(statsEl, tokenCount, firstTokenTime) {
    const totalTime = ((Date.now() - firstTokenTime) / 1000).toFixed(1);
    const finalSpeed = tokenCount > 0 ? (tokenCount / ((Date.now() - firstTokenTime) / 1000)).toFixed(1) : '0.0';
    statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">${finalSpeed} tok/s</span><span class="stats-item stats-time">${totalTime}s</span>`;
}

function wrapCodeBlocksWithActions(textEl, onCopy, onOpen) {
    const codeBlocks = textEl.querySelectorAll('pre:has(code[class*="language-"])');
    for (const pre of codeBlocks) {
        if (pre.closest('.thinking-block')) continue;
        if (pre.querySelector('.code-block-actions')) continue;

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const actions = document.createElement('div');
        actions.className = 'code-block-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.title = 'Copy code';
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>`;
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = pre.querySelector('code').textContent;
            onCopy(code, copyBtn);
        });

        actions.appendChild(copyBtn);
        wrapper.appendChild(actions);
    }
}

function setupCopyButtonsOnCodeBlocks(messagesContainer, onCopy, onOpen) {
    const textEls = messagesContainer.querySelectorAll('.message-text, .thinking-content .message.text-only, :scope > div.message.text-only');
    for (const textEl of textEls) {
        wrapCodeBlocksWithActions(textEl, onCopy, onOpen);
    }
}

function copyCodeToClipboard(code, btn) {
    navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>`;
        }, 2000);
    });
}

function buildRequestMessages(conversations, currentId, config) {
    const conv = conversations.find(c => c.id === currentId);
    if (!conv) return [];

    let messages = conv.messages.map(m => ({ role: m.role, content: m.content }));

    if (config.systemPrompt) {
        messages.unshift({ role: 'system', content: config.systemPrompt });
    }

    return messages;
}

function buildRequestPayload(config, messages) {
    return {
        model: config.model,
        messages: messages,
        stream: true,
        temperature: config.temperature,
        min_p: config.minP,
        presence_penalty: config.presencePenalty,
        repeat_penalty: config.repeatPenalty,
        thinking_budget_tokens: config.thinkingBudget,
        max_tokens: config.maxTokens,
        chat_template_kwargs: {
            enable_thinking: config.enableThinking,
            preserve_thinking: false
        }
    };
}

// === ui.js ===
function setupSidebar() {
    const sidebar = document.getElementById(DOM_IDS.sidebar);
    const overlay = document.getElementById(DOM_IDS.sidebarOverlay);
    const toggle = document.getElementById(DOM_IDS.sidebarToggle);

    toggle.addEventListener('click', () => {
        if (window.innerWidth <= UI.MOBILE_BREAKPOINT) {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('visible');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    overlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (window.innerWidth <= UI.MOBILE_BREAKPOINT) {
                closeSidebar();
            }
        }
    });
}

function closeSidebar() {
    const sidebar = document.getElementById(DOM_IDS.sidebar);
    const overlay = document.getElementById(DOM_IDS.sidebarOverlay);
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
}

function setupSettings(config, onSave) {
    const overlay = document.getElementById(DOM_IDS.settingsOverlay);
    const openBtn = document.getElementById(DOM_IDS.settingsBtn);
    const closeBtn = document.getElementById(DOM_IDS.closeSettings);
    const saveBtn = document.getElementById(DOM_IDS.saveSettings);

    openBtn.addEventListener('click', () => {
        overlay.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
    });

    saveBtn.addEventListener('click', () => {
        config.apiUrl = document.getElementById(SETTINGS_FIELDS.apiUrl).value || config.apiUrl;
        config.systemPrompt = document.getElementById(SETTINGS_FIELDS.systemPrompt).value;
        config.temperature = parseFloat(document.getElementById(SETTINGS_FIELDS.temperature).value) || config.temperature;
        config.minP = parseFloat(document.getElementById(SETTINGS_FIELDS.minP).value) || config.minP;
        config.presencePenalty = parseFloat(document.getElementById(SETTINGS_FIELDS.presencePenalty).value) || config.presencePenalty;
        config.repeatPenalty = parseFloat(document.getElementById(SETTINGS_FIELDS.repeatPenalty).value) || config.repeatPenalty;
        config.thinkingBudget = parseInt(document.getElementById(SETTINGS_FIELDS.thinkingBudget).value) || config.thinkingBudget;
        config.model = document.getElementById(SETTINGS_FIELDS.model).value || config.model;
        config.maxTokens = parseInt(document.getElementById(SETTINGS_FIELDS.maxTokens).value) || config.maxTokens;
        onSave(config);
        overlay.classList.add('hidden');
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
        }
    });
}

function loadSettingsIntoUI(config) {
    document.getElementById(SETTINGS_FIELDS.apiUrl).value = config.apiUrl || '';
    document.getElementById(SETTINGS_FIELDS.systemPrompt).value = config.systemPrompt || '';
    document.getElementById(SETTINGS_FIELDS.temperature).value = config.temperature ?? '';
    document.getElementById(SETTINGS_FIELDS.minP).value = config.minP ?? '';
    document.getElementById(SETTINGS_FIELDS.presencePenalty).value = config.presencePenalty ?? '';
    document.getElementById(SETTINGS_FIELDS.repeatPenalty).value = config.repeatPenalty ?? '';
    document.getElementById(SETTINGS_FIELDS.thinkingBudget).value = config.thinkingBudget ?? '';
    document.getElementById(SETTINGS_FIELDS.model).value = config.model || '';
    document.getElementById(SETTINGS_FIELDS.maxTokens).value = config.maxTokens ?? '';
}

function updateThinkingToggleVisual(thinkingToggleBtn, enableThinking) {
    thinkingToggleBtn.classList.toggle('active', enableThinking !== false);
}

function setupInputAutoResize(messageInput, sendBtn) {
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, UI.MAX_INPUT_HEIGHT) + 'px';
        sendBtn.disabled = !messageInput.value.trim();
    });
}

function isMobile() {
    return window.innerWidth <= UI.MOBILE_BREAKPOINT;
}

// === app.js (orchestrator) ===
let state = {
    config: loadConfig(),
    conversations: loadConversations(),
    currentConversationId: null,
    isGenerating: false
};

const els = {};
function cacheEl(id) {
    const el = document.getElementById(id);
    if (el) els[id] = el;
    return el;
}

function initDOM() {
    cacheEl(DOM_IDS.sidebar);
    cacheEl(DOM_IDS.conversationsList);
    cacheEl(DOM_IDS.newChatBtn);
    cacheEl(DOM_IDS.messages);
    cacheEl(DOM_IDS.welcomeScreen);
    cacheEl(DOM_IDS.messageInput);
    cacheEl(DOM_IDS.sendBtn);
    cacheEl(DOM_IDS.stopBtn);
    cacheEl(DOM_IDS.thinkingToggleBtn);
    cacheEl(DOM_IDS.chatContainer);
    cacheEl(DOM_IDS.main);
    cacheEl(DOM_IDS.sidebarToggle);
    cacheEl(DOM_IDS.settingsBtn);
    cacheEl(DOM_IDS.settingsOverlay);
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

function createNewConversation() {
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

    if (isMobile()) {
        closeSidebar();
    }
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

async function sendMessage() {
    const text = els[DOM_IDS.messageInput].value.trim();
    if (!text || state.isGenerating) return;

    if (!state.currentConversationId) {
        createNewConversation();
    }

    els[DOM_IDS.messageInput].value = '';
    els[DOM_IDS.messageInput].style.height = 'auto';
    els[DOM_IDS.sendBtn].disabled = true;
    els[DOM_IDS.sendBtn].classList.add('hidden');
    els[DOM_IDS.stopBtn].classList.remove('hidden');

    const conv = state.conversations.find(c => c.id === state.currentConversationId);
    if (!conv) return;

    conv.messages.push({ role: 'user', content: text });
    if (conv.messages.length === 1) {
        handleTitleUpdate(state.currentConversationId, text);
    }
    saveConversations();
    appendMessage(els[DOM_IDS.messages], 'user', text);

    showTypingIndicator(els[DOM_IDS.messages]);

    state.isGenerating = true;

    const abortController = new AbortController();
    state.abortController = abortController;

    sendStreamingMessage(
        state.config,
        state.config.apiUrl,
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
        () => {
            finishGeneration();
        },
        abortController
    );
}

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

function renderConversationsUI() {
    renderConversations(
        state.conversations,
        state.currentConversationId,
        (id) => selectConversation(id),
        (id, e) => { e.stopPropagation(); handleDeleteConversation(id); }
    );
}

function setupEventListeners() {
    els[DOM_IDS.newChatBtn].addEventListener('click', createNewConversation);

    els[DOM_IDS.thinkingToggleBtn].addEventListener('click', () => {
        state.config.enableThinking = !state.config.enableThinking;
        saveConfig(state.config);
        updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    });

    els[DOM_IDS.sendBtn].addEventListener('click', sendMessage);
    els[DOM_IDS.stopBtn].addEventListener('click', stopGeneration);

    els[DOM_IDS.messageInput].addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!els[DOM_IDS.sendBtn].disabled) sendMessage();
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

        conv.messages = conv.messages.slice(0, userIndex);
        saveConversations();
        removeTypingIndicator();
        els[DOM_IDS.messageInput].value = resendMsg.content;
        els[DOM_IDS.messageInput].dispatchEvent(new Event('input'));
        els[DOM_IDS.messageInput].focus();
        requestAnimationFrame(() => sendMessage());
    });

    setupSettings(state.config, (savedConfig) => {
        state.config = savedConfig;
        saveConfig(state.config);
        updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            els[DOM_IDS.settingsOverlay].classList.add('hidden');
        }
    });
}

function init() {
    initDOM();
    renderConversationsUI();
    loadLastConversation();
    setupSidebar();
    setupEventListeners();
    loadSettingsIntoUI(state.config);
    updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    els[DOM_IDS.messageInput].focus();
}

function loadLastConversation() {
    if (state.conversations.length > 0) {
        selectConversation(state.conversations[state.conversations.length - 1].id);
    }
}

init();
