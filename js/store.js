import { CONFIG_KEY, CONVERSATIONS_KEY, DEFAULT_CONFIG } from './config.js';

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
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
