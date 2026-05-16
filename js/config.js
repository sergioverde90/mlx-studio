export const CONFIG_KEY = 'tars_config';
export const CONVERSATIONS_KEY = 'tars_conversations';

export const DEFAULT_CONFIG = {
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
    MOBILE_BREAKPOINT: 768,
    MAX_FILE_SIZE: 50 * 1024 * 1024
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

export const SETTINGS_FIELDS = {
    systemPrompt: 'setting-system-prompt',
    temperature: 'setting-temperature',
    minP: 'setting-min-p',
    presencePenalty: 'setting-presence-penalty',
    repeatPenalty: 'setting-repeat-penalty',
    thinkingBudget: 'setting-thinking-budget',
    model: 'setting-model',
    maxTokens: 'setting-max-tokens',
    useLocalStudioUrl: 'setting-use-local-studio-url'
};

export const SLASH_COMMANDS = [
    {
        name: 'compact',
        description: 'Summarize and compress conversation history',
        icon: '⬡',
        handler: 'handleCompactCommand'
    }
];
