// === config.js ===
const CONFIG_KEY = 'tars_config';
const CONVERSATIONS_KEY = 'tars_conversations';

const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:8080/v1/chat/completions',
    useLocalStudioUrl: false,
    systemPrompt: '',
    model: 'mlx-community/gemma-4-26b-a4b-it-4bit',
    maxTokens: 16384,
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
    MOBILE_BREAKPOINT: 768,
    MAX_FILE_SIZE: 50 * 1024 * 1024 // 50MB
};

// === Slash Command System ===

const SLASH_COMMANDS = [
    {
        name: 'compact',
        description: 'Summarize and compress conversation history',
        icon: '⬡',
        handler: handleCompactCommand
    }
];

class SlashCommandManager {
    constructor(inputElement, commands) {
        this.input = inputElement;
        this.commands = commands;
        this.dropdown = null;
        this.activeIndex = -1;
        this.isOpen = false;
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    getPlainText() {
        return this.input.innerText || '';
    }

    setPlainText(text) {
        this.input.innerText = text;
    }

    getCursorPos() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return 0;
        const range = selection.getRangeAt(0);
        const preCursor = document.createRange();
        preCursor.selectNodeContents(this.input);
        preCursor.setEnd(range.startContainer, range.startOffset);
        return preCursor.toString().length;
    }

    setCursorPos(pos) {
        const selection = window.getSelection();
        const range = document.createRange();
        let charIndex = 0;
        const nodeStack = [this.input];
        let node;
        let foundStart = false;
        let foundEnd = false;

        while (!foundEnd && nodeStack.length > 0) {
            node = nodeStack.pop();
            if (node.nodeType === Node.TEXT_NODE) {
                const nextIndex = charIndex + node.textContent.length;
                if (!foundStart && charIndex <= pos && pos <= nextIndex) {
                    range.setStart(node, pos - charIndex);
                    range.collapse(true);
                    foundStart = true;
                }
                charIndex = nextIndex;
            } else {
                for (let i = node.childNodes.length - 1; i >= 0; i--) {
                    nodeStack.push(node.childNodes[i]);
                }
            }
        }

        selection.removeAllRanges();
        if (foundStart) {
            selection.addRange(range);
        }
    }

    handleInput() {
        const text = this.getPlainText();
        const cursorPos = this.getCursorPos();
        const textBeforeCursor = text.slice(0, cursorPos);
        const slashIndex = textBeforeCursor.lastIndexOf('/');

        if (slashIndex === -1) {
            this.close();
            return;
        }

        const afterSlash = text.slice(slashIndex + 1, cursorPos);
        if (afterSlash.includes(' ')) {
            this.close();
            return;
        }

        const filtered = this.commands.filter(cmd =>
            cmd.name.toLowerCase().includes(afterSlash.toLowerCase())
        );

        if (filtered.length === 0) {
            this.close();
            return;
        }

        this.activeIndex = 0;
        this.render(filtered, afterSlash);
    }

    handleKeydown(e) {
        if (!this.isOpen) {
            if (e.key === '/' && e.ctrlKey === false && e.metaKey === false) {
                return;
            }
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.navigate(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (this.activeIndex >= 0) {
                this.select(this.activeIndex);
            } else {
                this.select(0);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.close();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (this.activeIndex >= 0) {
                this.select(this.activeIndex);
            }
        }
    }

    navigate(direction) {
        const visible = this.getCurrentFilteredCommands();
        this.activeIndex = Math.max(0, Math.min(visible.length - 1, this.activeIndex + direction));
        this.render(visible, this.getCurrentPrefix());
    }

    select(index) {
        const visible = this.getCurrentFilteredCommands();
        const command = visible[index];
        if (!command) return;

        const text = this.getPlainText();
        const cursorPos = this.getCursorPos();
        const textBeforeCursor = text.slice(0, cursorPos);
        const slashIndex = textBeforeCursor.lastIndexOf('/');

        // Replace the command text with a styled span
        const beforeSlash = text.slice(0, slashIndex);
        const afterCursor = text.slice(cursorPos);
        const commandText = `/${command.name}`;

        // Clear and rebuild with span
        this.input.innerHTML = '';
        if (beforeSlash) {
            this.createTextNodes(beforeSlash);
        }
        
        const span = document.createElement('span');
        span.className = 'command-span';
        span.textContent = commandText;
        this.input.appendChild(span);
        
        if (afterCursor) {
            this.createTextNodes(afterCursor);
        }

        const newCursorPos = slashIndex + 1 + command.name.length;
        this.setCursorPos(newCursorPos);
        this.input.dispatchEvent(new Event('input'));
        this.input.focus();

        this.close();
    }

    createTextNodes(text) {
        const fragments = text.split('\n');
        fragments.forEach((fragment, i) => {
            if (i > 0) {
                this.input.appendChild(document.createElement('br'));
            }
            if (fragment) {
                this.input.appendChild(document.createTextNode(fragment));
            }
        });
    }

    render(items, prefix) {
        if (!this.dropdown) {
            this.dropdown = document.createElement('div');
            this.dropdown.id = DOM_IDS.slashDropdown;
            this.dropdown.innerHTML = `
                <div class="slash-command-header">Commands</div>
                <div class="slash-command-list"></div>
            `;
            document.body.appendChild(this.dropdown);
        }

        const listEl = this.dropdown.querySelector('.slash-command-list');
        if (items.length === 0) {
            listEl.innerHTML = '<div class="slash-command-no-results">No matching commands</div>';
        } else {
            listEl.innerHTML = items.map((cmd, i) => {
                const highlighted = this.highlightMatch(cmd.name, prefix);
                return `
                    <div class="slash-command-item ${i === this.activeIndex ? 'active' : ''}" data-index="${i}">
                        <div class="slash-command-icon">${cmd.icon}</div>
                        <div class="slash-command-info">
                            <div class="slash-command-name">${highlighted}</div>
                            <div class="slash-command-desc">${cmd.description}</div>
                        </div>
                        <div class="slash-command-hint">↵</div>
                    </div>
                `;
            }).join('');

            listEl.querySelectorAll('.slash-command-item').forEach((el, i) => {
                el.addEventListener('click', () => {
                    this.select(i);
                });
            });
        }

        this.dropdown.classList.add('visible');
        this.isOpen = true;
        this.positionDropdown();
    }

    highlightMatch(name, prefix) {
        if (!prefix) return `<span class="slash-prefix">/</span>${name}`;
        const idx = name.toLowerCase().indexOf(prefix.toLowerCase());
        if (idx === -1) return `<span class="slash-prefix">/</span>${name}`;
        const before = name.slice(0, idx);
        const match = name.slice(idx, idx + prefix.length);
        const after = name.slice(idx + prefix.length);
        return `<span class="slash-prefix">/</span>${before}<strong style="color:var(--accent)">${match}</strong>${after}`;
    }

    getCurrentPrefix() {
        const text = this.getPlainText();
        const cursorPos = this.getCursorPos();
        const textBeforeCursor = text.slice(0, cursorPos);
        const slashIndex = textBeforeCursor.lastIndexOf('/');
        if (slashIndex === -1 || slashIndex !== cursorPos - 1) return '';
        return text.slice(slashIndex + 1, cursorPos);
    }

    getCurrentFilteredCommands() {
        const prefix = this.getCurrentPrefix();
        return this.commands.filter(cmd =>
            cmd.name.toLowerCase().includes(prefix.toLowerCase())
        );
    }

    positionDropdown() {
        const rect = this.input.getBoundingClientRect();
        const dropdownRect = this.dropdown.getBoundingClientRect();

        let left = rect.left;
        let top = rect.bottom + 4;

        if (left + dropdownRect.width > window.innerWidth) {
            left = window.innerWidth - dropdownRect.width - 12;
        }
        if (top + dropdownRect.height > window.innerHeight) {
            top = rect.top - dropdownRect.height - 4;
        }

        this.dropdown.style.left = left + 'px';
        this.dropdown.style.top = top + 'px';
    }

    close() {
        this.isOpen = false;
        this.activeIndex = -1;
        if (this.dropdown) {
            this.dropdown.classList.remove('visible');
        }
    }

    handleOutsideClick(e) {
        if (this.isOpen && !this.dropdown.contains(e.target) && e.target !== this.input) {
            this.close();
        }
    }
}

const DOM_IDS = {
    sidebar: 'sidebar',
    conversationsList: 'conversations-list',
    newChatBtn: 'new-chat-btn',
    messages: 'messages',
    welcomeScreen: 'welcome-screen',
    messageInput: 'message-input',
    sendBtn: 'send-btn',
    stopBtn: 'stop-btn',
    apiUrlToggleBtn: 'api-url-toggle-btn',
    thinkingToggleBtn: 'thinking-toggle-btn',
    pdfUploadBtn: 'pdf-upload-btn',
    pdfFileInput: 'pdf-file-input',
    fileInfo: 'file-info',
    chatContainer: 'chat-container',
    main: 'main',
    sidebarToggle: 'sidebar-toggle',
    settingsBtn: 'settings-btn',
    slashDropdown: 'slash-command-dropdown',

    settingsOverlay: 'settings-overlay',
    closeSettings: 'close-settings',
    saveSettings: 'save-settings',
    sidebarOverlay: 'sidebar-overlay'
};

const SETTINGS_FIELDS = {
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
    // Strip pdfAttachment before persisting to avoid localStorage quota issues
    const serializable = (conversations || state.conversations).map(conv => ({
        ...conv,
        messages: conv.messages.map(m => {
            const copy = { ...m };
            delete copy.pdfAttachment;
            return copy;
        })
    }));
    var stringJson = JSON.stringify(serializable);
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
        const isEmpty = conv.messages.length === 0;
        item.className = 'conversation-item' + (conv.id === currentId ? ' active' : '') + (isEmpty ? ' empty' : '');
        item.innerHTML = `
            <span class="conversation-title">${escapeHtml(conv.title)}</span>
            <button class="conversation-export" title="Export to Markdown" aria-label="Export conversation">${conv.messages.length > 0 ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>' : '⚠️'}</button>
            <button class="conversation-delete" title="Delete">&times;</button>
        `;
        item.addEventListener('click', () => onSelect(conv.id));
        item.querySelector('.conversation-export').addEventListener('click', (e) => exportConversation(conv.id));
        item.querySelector('.conversation-delete').addEventListener('click', (e) => onDelete(conv.id, e));
        list.appendChild(item);
    });
}

function renderMessages(messagesContainer, messages, onHighlight, onProcess, onCopy, onOpen) {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        appendMessage(messagesContainer, msg.role, msg.content, false);
    });
    if (onHighlight) onHighlight();
    if (onProcess) onProcess();
    if (onCopy) {
        setupCopyButtonsOnCodeBlocks(messagesContainer, onCopy, onOpen);
    }
    scrollToBottom(true);
    if (onHighlight) highlightAllCode(messagesContainer);
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
            <div class="message-text">
                <button class="copy-msg-btn" title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path>
                </svg></button>
            </div>
            <div class="message-actions"></div>
        </div>
    `;

    const textEl = messageEl.querySelector('.message-text');

    if (role === 'user') {
        const copyBtn = messageEl.querySelector('.copy-msg-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>`;
                }, 2000);
            });
        });
    }

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
        const copyBtn = textEl.querySelector('.copy-msg-btn');
        textEl.innerHTML = '';
        textEl.appendChild(copyBtn);
        const span = document.createElement('span');
        span.className = 'user-message-content';
        span.textContent = content;
        textEl.appendChild(span);
        const retryBtn = document.createElement('button');
        retryBtn.className = 'resend-btn';
        retryBtn.title = 'Resend';
        retryBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
        retryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const conv = state.conversations.find(c => c.id === state.currentConversationId);
            if (!conv) return;
            let userIndex = parseInt(messageEl.dataset.index, 10);
            if (isNaN(userIndex)) return;
            const resendMsg = conv.messages[userIndex];
            if (!resendMsg) return;
            // Remove all messages after the retry point (assistant responses and future user messages)
            // Don't include the retry user message yet - sendMessage() will add it
            conv.messages = conv.messages.slice(0, userIndex);
            saveConversations();
            // Clear the conversation view to reflect the truncated history
            const container = els[DOM_IDS.messages];
            container.innerHTML = '';
            // Re-render only messages up to the retry point
            renderMessages(container, conv.messages, () => highlightAllCode(container), () => {}, () => {});
            removeTypingIndicator();
            els[DOM_IDS.messageInput].innerText = resendMsg.content;
            els[DOM_IDS.messageInput].dispatchEvent(new Event('input'));
            els[DOM_IDS.messageInput].focus();
            requestAnimationFrame(() => sendMessage());
        });
        textEl.appendChild(retryBtn);
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

// === PDF Upload Functions ===

let currentPdfFile = null;

function setupPdfUpload() {
    const pdfUploadBtn = document.getElementById(DOM_IDS.pdfUploadBtn);
    const pdfFileInput = document.getElementById(DOM_IDS.pdfFileInput);
    const fileInfo = document.getElementById(DOM_IDS.fileInfo);

    pdfUploadBtn.addEventListener('click', () => {
        pdfFileInput.click();
    });

    pdfFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handlePdfFile(file, pdfUploadBtn, fileInfo);
        }
    });
}

function handlePdfFile(file, pdfUploadBtn, fileInfo) {
    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Please select a PDF file');
        return;
    }

    // Validate file size
    if (file.size > UI.MAX_FILE_SIZE) {
        alert(`File size exceeds ${UI.MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return;
    }

    // Clear previous file
    if (currentPdfFile) {
        currentPdfFile = null;
        pdfUploadBtn.classList.remove('active');
        fileInfo.classList.add('hidden');
        document.getElementById(DOM_IDS.pdfFileInput).value = '';
    }

    // Read file as Base64 (raw, without data URL prefix)
    const reader = new FileReader();
    reader.onload = (e) => {
        // e.target.result is "data:application/pdf;base64,XXXX" — strip the prefix
        const commaIndex = e.target.result.indexOf(',');
        const base64Content = commaIndex > 0 ? e.target.result.substring(commaIndex + 1) : e.target.result;
        currentPdfFile = {
            file: file,
            base64: base64Content,
            name: file.name,
            size: file.size
        };

        // Update UI
        pdfUploadBtn.classList.add('active');
        fileInfo.classList.remove('hidden');
        fileInfo.innerHTML = `
            <span>📄 ${escapeHtml(file.name)}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="remove-file-btn" title="Remove file">&times;</button>
        `;

        // Add remove button handler
        fileInfo.querySelector('.remove-file-btn').addEventListener('click', () => {
            currentPdfFile = null;
            pdfUploadBtn.classList.remove('active');
            fileInfo.classList.add('hidden');
            document.getElementById(DOM_IDS.pdfFileInput).value = '';
        });
    };
    reader.onerror = () => {
        alert('Error reading file');
    };
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// === End PDF Upload Functions ===

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

/**
 * Builds messages array for the chat API request.
 *
 * Content type elements supported in the `content` array:
 *
 * - `text` — Plain text message. Used for all regular chat messages and system prompts.
 *   Format: `{ type: 'text', text: '<message content>' }`
 *
 * - `pdf` — Base64-encoded PDF document attachment. Used when a user uploads a PDF file.
 *   Format: `{ type: 'pdf', text: '<base64-encoded PDF data>' }`
 *
 * A single message can contain both types (e.g., a text prompt alongside a PDF attachment).
 *
 * @param {Array} conversations - Array of conversation objects
 * @param {string} currentId - ID of the current conversation
 * @param {Object} config - Current configuration object
 * @returns {Array} Formatted messages array ready for the API
 */
function buildRequestMessages(conversations, currentId, config) {
    const conv = conversations.find(c => c.id === currentId);
    if (!conv) return [];

    let messages = conv.messages.map(m => {
        // Reconstruct PDF message in the proper format
        if (m.pdfAttachment) {
            const attachment = m.pdfAttachment;
            const prefix = `[PDF-ATTACHMENT:${attachment.name}]\n`;
            const userPrompt = m.content.startsWith(prefix) 
                ? m.content.substring(prefix.length) 
                : m.content;
            return {
                role: m.role,
                content: [
                    { type: 'text', text: userPrompt },
                    { type: 'pdf', text: attachment.base64 }
                ]
            };
        }
        // Normal message — wrap in array if not already
        if (typeof m.content === 'string') {
            return { role: m.role, content: [{ type: 'text', text: m.content }] };
        }
        return { role: m.role, content: m.content };
    });

    if (config.systemPrompt) {
        messages.unshift({ role: 'system', content: [{ type: 'text', text: config.systemPrompt }] });
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
        const apiUrlElement = document.getElementById(SETTINGS_FIELDS.useLocalStudioUrl);
        if (apiUrlElement) {
            config.useLocalStudioUrl = apiUrlElement.checked || config.useLocalStudioUrl;
        }
        config.apiUrl = config.useLocalStudioUrl 
            ? 'http://localhost:8080/v1/chat/completions'
            : 'http://localhost:8081/v1/chat/completions';
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
    const apiUrlElement = document.getElementById(SETTINGS_FIELDS.useLocalStudioUrl);
    if (apiUrlElement) {
        apiUrlElement.checked = config.useLocalStudioUrl ?? false;
    }
    document.getElementById(SETTINGS_FIELDS.systemPrompt).value = config.systemPrompt || '';
    document.getElementById(SETTINGS_FIELDS.temperature).value = config.temperature ?? '';
    document.getElementById(SETTINGS_FIELDS.minP).value = config.minP ?? '';
    document.getElementById(SETTINGS_FIELDS.presencePenalty).value = config.presencePenalty ?? '';
    document.getElementById(SETTINGS_FIELDS.repeatPenalty).value = config.repeatPenalty ?? '';
    document.getElementById(SETTINGS_FIELDS.thinkingBudget).value = config.thinkingBudget ?? '';
    document.getElementById(SETTINGS_FIELDS.model).value = config.model || '';
    document.getElementById(SETTINGS_FIELDS.maxTokens).value = config.maxTokens ?? '';
}

function updateApiUrlToggleVisual(apiUrlToggleBtn, useLocalStudioUrl) {
    apiUrlToggleBtn.classList.toggle('active', useLocalStudioUrl);
}

function updateThinkingToggleVisual(thinkingToggleBtn, enableThinking) {
    thinkingToggleBtn.classList.toggle('active', enableThinking !== false);
}

function setupInputAutoResize(messageInput, sendBtn) {
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, UI.MAX_INPUT_HEIGHT) + 'px';
        sendBtn.disabled = !messageInput.innerText.trim();
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

function getApiUrl() {
    return state.config.useLocalStudioUrl 
        ? 'http://localhost:8081/v1/chat/completions'
        : 'http://localhost:8080/v1/chat/completions';
}

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

    if (isMobile()) {
        closeSidebar();
    }
}

function handleDeleteConversation(id) {
    const wasCurrent = state.currentConversationId === id;
    const wasEmpty = state.conversations.find(c => c.id === id)?.messages.length === 0;
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

async function sendMessage() {
    const text = els[DOM_IDS.messageInput].innerText.trim();
    if (!text && !currentPdfFile) return;

    if (!state.currentConversationId) {
        createNewConversation();
    }

    const conv = state.conversations.find(c => c.id === state.currentConversationId);
    if (conv && conv.messages.length === 0) {
        els[DOM_IDS.welcomeScreen].style.display = 'none';
        conv.title = text.substring(0, UI.TITLE_MAX_LENGTH) + (text.length > UI.TITLE_MAX_LENGTH ? '...' : '');
        saveConversations();
    }

    // Build message content with PDF if attached
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
    if (pdfAttachment) {
        userMessage.pdfAttachment = pdfAttachment;
    }
    conv.messages.push(userMessage);
    // Clear PDF from memory after attaching to message
    currentPdfFile = null;
    els[DOM_IDS.pdfUploadBtn].classList.remove('active');
    els[DOM_IDS.fileInfo].classList.add('hidden');
    els[DOM_IDS.pdfFileInput].value = '';
    if (conv.messages.length === 1) {
        handleTitleUpdate(state.currentConversationId, messageContent);
    }
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
        () => {
            finishGeneration();
        },
        abortController
    );
}

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
    messages.push({ role: 'user', content: compactPrompt });
    const payload = buildRequestPayload(state.config, messages);

    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

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

                    const content = choice.delta?.content;
                    if (content) {
                        markdownContent += content;
                    }
                } catch (e) {
                    // Skip malformed JSON
                }
            }
        }

        // Replace all messages with the markdown summary as the first assistant message
        conv.messages = [{ role: 'assistant', content: markdownContent }];
        conv.title = 'Compact Summary';
        saveConversations();

        // Clear the chat display and re-render
        els[DOM_IDS.messages].innerHTML = '';
        appendMessage(els[DOM_IDS.messages], 'assistant', markdownContent);
        highlightAllCode(els[DOM_IDS.messages]);

        // Hide loading overlay and reset UI
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
        
        if (i < conv.messages.length - 1) {
            markdown += '\n\n';
        }
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

function updateExportSelect() {
    const exportSelect = document.getElementById('export-conv-select');
    if (!exportSelect) return;

    exportSelect.innerHTML = '<option value="">Select conversation...</option>';

    state.conversations.forEach(conv => {
        const option = document.createElement('option');
        option.value = conv.id;
        option.textContent = conv.title || 'Untitled';
        if (conv.id === state.currentConversationId) {
            option.selected = true;
        }
        exportSelect.appendChild(option);
    });
}

function setupEventListeners() {
    els[DOM_IDS.newChatBtn].addEventListener('click', createNewConversation);

    els[DOM_IDS.apiUrlToggleBtn].addEventListener('click', () => {
        state.config.useLocalStudioUrl = !state.config.useLocalStudioUrl;
        saveConfig(state.config);
        updateApiUrlToggleVisual(els[DOM_IDS.apiUrlToggleBtn], state.config.useLocalStudioUrl);
    });

    els[DOM_IDS.thinkingToggleBtn].addEventListener('click', () => {
        state.config.enableThinking = !state.config.enableThinking;
        saveConfig(state.config);
        updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    });

    els[DOM_IDS.pdfUploadBtn].addEventListener('click', () => {
        els[DOM_IDS.pdfFileInput].click();
    });

    els[DOM_IDS.pdfFileInput].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handlePdfFile(file, els[DOM_IDS.pdfUploadBtn], els[DOM_IDS.fileInfo]);
        }
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
        if (e.key === 'Escape') {
            els[DOM_IDS.settingsOverlay].classList.add('hidden');
        }
    });
}

function init() {
    initDOM();
    renderConversationsUI();
    setupSidebar();
    setupEventListeners();
    loadSettingsIntoUI(state.config);
    updateApiUrlToggleVisual(els[DOM_IDS.apiUrlToggleBtn], state.config.useLocalStudioUrl);
    updateThinkingToggleVisual(els[DOM_IDS.thinkingToggleBtn], state.config.enableThinking);
    els[DOM_IDS.messageInput].focus();
}

document.addEventListener('DOMContentLoaded', init);
