# TARS - Local AI Chat Client

## Architecture

Single-page vanilla JS app. Entry: `index.html`. No build step.

- `js/config.js` — constants, defaults, DOM IDs (ES module)
- `js/store.js` — localStorage persistence for config & conversations (ES module)
- `js/renderer.js` — message/thinking block rendering (ES module)
- `js/api.js` — SSE streaming from OpenAI-compatible API (ES module)
- `js/ui.js` — sidebar, settings, input handling (ES module)
- `js/app.js` — orchestrator: state, event listeners, conversation flow (ES module)
- `css/styles.css` — all styles

## Key facts

- Default API: `http://localhost:8080/v1/chat/completions` (configurable in Settings)
- Uses `marked` for Markdown rendering, `highlight.js` + `prism` for code syntax highlighting (all loaded from CDN)
- State persisted in localStorage under keys `tars_config` and `tars_conversations`
- Streaming SSE: parses `data: ` prefixed JSON lines, handles `delta.reasoning` for thinking blocks wrapped in `<thinking>` tags
- No tests, no linting, no typechecking — it's vanilla JS

## Running

Open `index.html` directly in a browser. No dev server needed.
