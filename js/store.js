import { CONFIG_KEY, CONVERSATIONS_KEY, DEFAULT_CONFIG } from './config.js';

export const state = {
    config: loadConfig(),
    conversations: loadConversations(),
    currentConversationId: null,
    isGenerating: false,
    isBackendReachable: true
};

export const els = {};

export function getEl(id) {
    const el = document.getElementById(id);
    if (el) els[id] = el;
    return el;
}

export function cacheEl(id) {
    return getEl(id);
}

function safeParse(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch {
        return fallback;
    }
}

export function loadConfig() {
    const saved = safeParse(CONFIG_KEY, {});
    return { ...DEFAULT_CONFIG, ...saved };
}

export function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadConversations() {
    return safeParse(CONVERSATIONS_KEY, []);
}

export function saveConversations(conversations) {
    const serializable = (conversations || state.conversations).map(conv => ({
        ...conv,
        messages: conv.messages.map(m => {
            const copy = { ...m };
            delete copy.pdfAttachment;
            return copy;
        })
    }));
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(serializable));
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
