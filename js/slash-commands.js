import { DOM_IDS } from './config.js';

export class SlashCommandManager {
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
        if (foundStart) selection.addRange(range);
    }

    handleInput() {
        const text = this.getPlainText();
        const cursorPos = this.getCursorPos();
        const textBeforeCursor = text.slice(0, cursorPos);
        const slashIndex = textBeforeCursor.lastIndexOf('/');

        if (slashIndex === -1) { this.close(); return; }

        const afterSlash = text.slice(slashIndex + 1, cursorPos);
        if (afterSlash.includes(' ')) { this.close(); return; }

        const filtered = this.commands.filter(cmd =>
            cmd.name.toLowerCase().includes(afterSlash.toLowerCase())
        );

        if (filtered.length === 0) { this.close(); return; }

        this.activeIndex = 0;
        this.render(filtered, afterSlash);
    }

    handleKeydown(e) {
        if (!this.isOpen) {
            if (e.key === '/' && e.ctrlKey === false && e.metaKey === false) return;
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.navigate(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.select(this.activeIndex >= 0 ? this.activeIndex : 0);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.close();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (this.activeIndex >= 0) this.select(this.activeIndex);
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
        const beforeSlash = text.slice(0, slashIndex);
        const afterCursor = text.slice(cursorPos);
        const commandText = `/${command.name}`;

        this.input.innerHTML = '';
        if (beforeSlash) this.createTextNodes(beforeSlash);

        const span = document.createElement('span');
        span.className = 'command-span';
        span.textContent = commandText;
        this.input.appendChild(span);

        if (afterCursor) this.createTextNodes(afterCursor);

        const newCursorPos = slashIndex + 1 + command.name.length;
        this.setCursorPos(newCursorPos);
        this.input.dispatchEvent(new Event('input'));
        this.input.focus();
        this.close();
    }

    createTextNodes(text) {
        const fragments = text.split('\n');
        fragments.forEach((fragment, i) => {
            if (i > 0) this.input.appendChild(document.createElement('br'));
            if (fragment) this.input.appendChild(document.createTextNode(fragment));
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
                el.addEventListener('click', () => this.select(i));
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
        if (this.dropdown) this.dropdown.classList.remove('visible');
    }

    handleOutsideClick(e) {
        if (this.isOpen && !this.dropdown.contains(e.target) && e.target !== this.input) {
            this.close();
        }
    }
}
