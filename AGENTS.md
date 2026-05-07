# TARS - Agent Notes

## Running

```bash
node server.js          # starts dev server on :3000, proxying to localhost:8080/v1/chat/completions
PORT=9000 node server   # custom port
API_BASE_URL=http://...  # override API target (default is Ollama-compatible endpoint)
```

No test framework. No lint/typecheck config. `npm install` only pulls `marked`.

## Architecture

Single-page chat app with a Node/Express reverse proxy:

- **server.js** — Express server serving static files + `/v1/chat/completions` proxy (streaming SSE passthrough). This avoids CORS to the MLX backend.
- **index.html** — SPA shell, loads all client code from `js/app.js`. All Prism syntax highlighters are loaded inline in HTML (~80 plugins).
- **js/app.js** — Everything: config/store (`loadConfig`/`saveConfig` persist to localStorage keys `tars_config`, `tars_conversations`), rendering (markdown via marked, code highlighting via hljs + prism), API client (SSE streaming with `<thinking>` block parsing), and UI orchestration.

State is flat in a single `state` object: `{ config, conversations[], currentConversationId, isGenerating }`. No framework — vanilla JS throughout.

## Key details an agent might miss

- **API model params use snake_case** (`min_p`, `repeat_penalty`) even though the UI settings fields are camelCase (`config.minP`). The mapping lives in `DEFAULT_CONFIG` and `buildRequestPayload()` at app.js:615.
- **Thinking blocks**: assistant responses may contain `<thinking>...</thinking>` tags for reasoning content, parsed by `parseThinkingAndContent()`. These render as collapsible sections via `toggleThinking()`.
- **Token counting** is a naive whitespace split (`countTokens()` at app.js:469), not real tokenization. Stats shown are approximate only.
- **Conversations load the last one in array order**, not most recent by timestamp — `loadLastConversation()` picks `conversations[conversations.length - 1]`.
- The sidebar overlay element is created dynamically if missing (app.js:763). Don't assume it exists in DOM on first render.
