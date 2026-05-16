import { DOM_IDS, UI, SETTINGS_FIELDS } from './config.js';
import { state, els } from './store.js';

export function setupSidebar() {
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
        if (e.key === 'Escape' && window.innerWidth <= UI.MOBILE_BREAKPOINT) {
            closeSidebar();
        }
    });
}

export function closeSidebar() {
    const sidebar = document.getElementById(DOM_IDS.sidebar);
    const overlay = document.getElementById(DOM_IDS.sidebarOverlay);
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
}

export function setupSettings(config, onSave) {
    const overlay = document.getElementById(DOM_IDS.settingsOverlay);
    const openBtn = document.getElementById(DOM_IDS.settingsBtn);
    const closeBtn = document.getElementById(DOM_IDS.closeSettings);
    const saveBtn = document.getElementById(DOM_IDS.saveSettings);

    openBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

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
        if (e.target === overlay) overlay.classList.add('hidden');
    });
}

export function loadSettingsIntoUI(config) {
    const apiUrlElement = document.getElementById(SETTINGS_FIELDS.useLocalStudioUrl);
    if (apiUrlElement) apiUrlElement.checked = config.useLocalStudioUrl ?? false;
    document.getElementById(SETTINGS_FIELDS.systemPrompt).value = config.systemPrompt || '';
    document.getElementById(SETTINGS_FIELDS.temperature).value = config.temperature ?? '';
    document.getElementById(SETTINGS_FIELDS.minP).value = config.minP ?? '';
    document.getElementById(SETTINGS_FIELDS.presencePenalty).value = config.presencePenalty ?? '';
    document.getElementById(SETTINGS_FIELDS.repeatPenalty).value = config.repeatPenalty ?? '';
    document.getElementById(SETTINGS_FIELDS.thinkingBudget).value = config.thinkingBudget ?? '';
    document.getElementById(SETTINGS_FIELDS.model).value = config.model || '';
    document.getElementById(SETTINGS_FIELDS.maxTokens).value = config.maxTokens ?? '';
}

export function updateApiUrlToggleVisual(apiUrlToggleBtn, useLocalStudioUrl) {
    apiUrlToggleBtn.classList.toggle('active', useLocalStudioUrl);
}

export function updateThinkingToggleVisual(thinkingToggleBtn, enableThinking) {
    thinkingToggleBtn.classList.toggle('active', enableThinking !== false);
}

export function setupInputAutoResize(messageInput, sendBtn) {
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, UI.MAX_INPUT_HEIGHT) + 'px';
        sendBtn.disabled = !messageInput.innerText.trim();
    });
}

export function setBackendToggleState(apiUrlToggleBtn, isReachable) {
    if (isReachable) {
        apiUrlToggleBtn.classList.remove('disabled');
        apiUrlToggleBtn.title = 'Toggle API URL';
    } else {
        apiUrlToggleBtn.classList.add('disabled');
        apiUrlToggleBtn.title = 'Backend not reachable';
    }
}

export function isMobile() {
    return window.innerWidth <= UI.MOBILE_BREAKPOINT;
}
