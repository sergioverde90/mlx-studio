export function renderConversations(conversations, currentId, onSelect, onDelete) {
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

export function renderMessages(messagesContainer, messages, onHighlight, onProcess) {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        appendMessage(messagesContainer, msg.role, msg.content, false);
    });
    onHighlight();
    onProcess();
    scrollToBottom();
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
    scrollToBottom();
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
    thinkingBlock.querySelector('.thinking-content .message.text-only').innerHTML = marked.parse(contentHtml);
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

export function scrollToBottom() {
    requestAnimationFrame(() => {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });
}

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

// Expose globally for inline onclick handlers
if (typeof window !== 'undefined') {
    window.toggleThinking = toggleThinking;
}

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
    scrollToBottom();
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

export function wrapCodeBlocksWithActions(textEl, onCopy, onOpen) {
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

export function processAllCodeBlocks(messagesContainer, onCopy, onOpen) {
    const textEls = messagesContainer.querySelectorAll('.message-text, .thinking-content .message.text-only');
    for (const textEl of textEls) {
        wrapCodeBlocksWithActions(textEl, onCopy, onOpen);
    }
}
