import { STREAM_DONE_TOKEN, DOM_IDS } from './config.js';
import { state, els, saveConversations } from './store.js';
import {
    appendMessage,
    scrollToBottom,
    highlightAllCode,
    parseThinkingAndContent,
    removeTypingIndicator,
    toggleThinking
} from './renderer.js';

const decoder = new TextDecoder();

// === SSE Parsing Utilities ===

function parseSSELine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === STREAM_DONE_TOKEN) return null;

    let jsonStr = trimmed;
    if (trimmed.startsWith('data: ')) {
        jsonStr = trimmed.slice(6);
    } else if (trimmed.startsWith('data:')) {
        jsonStr = trimmed.slice(5);
    } else {
        return null;
    }

    try {
        return JSON.parse(jsonStr.trim());
    } catch {
        return null;
    }
}

function extractContent(data) {
    const choice = data?.choices?.[0];
    if (!choice) return null;
    return {
        content: choice.delta?.content,
        reasoning: choice.delta?.reasoning
    };
}

// === Token Counting (naive whitespace split) ===

export function countTokens(text) {
    return text.trim().split(/\s+/).filter(w => w).length;
}

// === Stats UI ===

export function createStatsElement(tokenCount) {
    const statsEl = document.createElement('div');
    statsEl.className = 'message-stats';
    statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">0.0</span>`;
    return statsEl;
}

export function updateStatsElement(statsEl, tokenCount, firstTokenTime) {
    const elapsed = (Date.now() - firstTokenTime) / 1000;
    const speed = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : '0.0';
    statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">${speed} tok/s</span>`;
}

export function updateFinalStats(statsEl, tokenCount, firstTokenTime) {
    const totalTime = ((Date.now() - firstTokenTime) / 1000).toFixed(1);
    const finalSpeed = tokenCount > 0 ? (tokenCount / ((Date.now() - firstTokenTime) / 1000)).toFixed(1) : '0.0';
    statsEl.innerHTML = `<span class="stats-item stats-tokens">${tokenCount} tokens</span><span class="stats-item stats-speed">${finalSpeed} tok/s</span><span class="stats-item stats-time">${totalTime}s</span>`;
}

// === Thinking Block Helpers ===

export function createStreamingThinkingBlock(assistantEl) {
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

// === Code Block Copy ===

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
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path>
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

export function setupCopyButtonsOnCodeBlocks(messagesContainer, onCopy, onOpen) {
    const textEls = messagesContainer.querySelectorAll('.message-text, .thinking-content .message.text-only, :scope > div.message.text-only');
    for (const textEl of textEls) {
        wrapCodeBlocksWithActions(textEl, onCopy, onOpen);
    }
}

export function copyCodeToClipboard(code, btn) {
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

// === Streaming Message Handler ===

export async function sendStreamingMessage(config, apiUrl, conversations, currentId, onComplete, onProgress, onError, onAbort, externalAbortController) {
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
                const sseData = parseSSELine(line);
                if (!sseData) continue;

                const { content, reasoning } = extractContent(sseData);
                if (!content && !reasoning) continue;

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

// === Request Builders ===

export function buildRequestMessages(conversations, currentId, config) {
    const conv = conversations.find(c => c.id === currentId);
    if (!conv) return [];

    let messages = conv.messages.map(m => {
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

export function buildRequestPayload(config, messages) {
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

// === Generic SSE Stream Parser (deduplicated from handleCompactCommand) ===

export async function parseSSEStream(url, payload, onContent, signal) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    let buffer = '';
    let collectedContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const sseData = parseSSELine(line);
            if (!sseData) continue;

            const choice = sseData.choices?.[0];
            if (!choice) continue;

            const content = choice.delta?.content;
            if (content) {
                collectedContent += content;
                onContent(collectedContent);
            }
        }
    }

    return collectedContent;
}
