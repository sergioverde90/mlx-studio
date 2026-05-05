import { STREAM_LINE_PREFIX, STREAM_DONE_TOKEN } from './config.js';
import {
    highlightAllCode,
    scrollToBottom,
    appendMessage,
    processAllCodeBlocks,
    removeTypingIndicator
} from './renderer.js';

const decoder = new TextDecoder();

export async function sendStreamingMessage(config, apiUrl, conversations, currentId, onComplete, onProgress, onError, onAbort) {
    const messages = buildRequestMessages(conversations, currentId, config);
    const payload = buildRequestPayload(config, messages);

    const abortController = new AbortController();

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
                if (!trimmed.startsWith(STREAM_LINE_PREFIX)) continue;

                try {
                    const data = JSON.parse(trimmed.slice(STREAM_LINE_PREFIX.length));
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
                        scrollToBottom();
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
                        scrollToBottom();
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
        processAllCodeBlocks(document.getElementById('messages'), () => {}, () => {});

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
