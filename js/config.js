export const CONFIG_KEY = 'tars_config';
export const CONVERSATIONS_KEY = 'tars_conversations';

export const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:8080/v1/chat/completions',
    systemPrompt: '',
    model: 'unsloth/gemma-4-E4B-it-UD-MLX-4bit',
    maxTokens: 8192,
    temperature: 0.8,
    minP: 0.06,
    presencePenalty: 1.2,
    repeatPenalty: 1.05,
    thinkingBudget: 512,
    enableThinking: true
};

export const API_MODEL_PARAMS = {
    temperature: 'temperature',
    minP: 'min_p',
    presencePenalty: 'presence_penalty',
    repeatPenalty: 'repeat_penalty',
    thinkingBudget: 'thinking_budget_tokens',
    maxTokens: 'max_tokens'
};

export const STREAM_LINE_PREFIX = 'data: ';
export const STREAM_DONE_TOKEN = 'data: [DONE]';

export const UI = {
    MAX_INPUT_HEIGHT: 200,
    TITLE_MAX_LENGTH: 40,
    COMPACT_CODE_PREVIEW_LINES: 2,
    COMPACT_CODE_TRUNCATE_CHAR: 60,
    MOBILE_BREAKPOINT: 768
};

export const DOM_IDS = {
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
    sidebarOverlay: 'sidebar-overlay',
    codePreviewPanel: 'code-preview-panel',
    codePreviewTitle: 'code-preview-title',
    codePreviewLang: 'code-preview-lang',
    codePreviewCode: 'code-preview-code',
    codePreviewCopy: 'code-preview-copy',
    codePreviewClose: 'code-preview-close'
};

export const SETTINGS_FIELDS = {
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
