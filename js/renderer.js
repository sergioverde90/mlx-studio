import { DOM_IDS, UI } from './config.js';
import { state, els, saveConversations } from './store.js';
import { setupCopyButtonsOnCodeBlocks } from './api.js';

export function renderConversations(conversations, currentId, onSelect, onDelete) {
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
        item.querySelector('.conversation-export').addEventListener('click', (e) => {
            e.stopPropagation();
            window.exportConversation(conv.id);
        });
        item.querySelector('.conversation-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete(conv.id, e);
        });
        list.appendChild(item);
    });
}

export function renderMessages(messagesContainer, messages, onHighlight, onProcess, onCopy, onOpen) {
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

export function appendMessage(container, role, content, animate = true) {
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
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path>
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
            conv.messages = conv.messages.slice(0, userIndex);
            saveConversations();
            const container = els[DOM_IDS.messages];
            container.innerHTML = '';
            renderMessages(container, conv.messages, () => highlightAllCode(container), () => {}, () => {});
            removeTypingIndicator();
            els[DOM_IDS.messageInput].innerText = resendMsg.content;
            els[DOM_IDS.messageInput].dispatchEvent(new Event('input'));
            els[DOM_IDS.messageInput].focus();
            requestAnimationFrame(() => window.sendMessage());
        });
        textEl.appendChild(retryBtn);
    }

    container.appendChild(messageEl);
    scrollToBottom(true);
    return messageEl;
}

export function createThinkingBlock(contentHtml) {
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

export function highlightAllCode(messagesContainer) {
    const blocks = messagesContainer.querySelectorAll('pre code[class*="language-"]');
    for (const block of blocks) {
        if (!block.closest('.thinking-block')) {
            hljs.highlightElement(block);
        }
    }
}

let userScrolledUp = false;

export function scrollToBottom(force = false) {
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

export function parseThinkingAndContent(content) {
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

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function toggleThinking(btn) {
    btn.classList.toggle('open');
    const content = btn.nextElementSibling;
    content.classList.toggle('open');
}

// Expose on window for inline onclick handlers
window.toggleThinking = toggleThinking;

export function showTypingIndicator(messagesContainer) {
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

export function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

export function updateMessageContent(assistantEl, content, onScroll) {
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
