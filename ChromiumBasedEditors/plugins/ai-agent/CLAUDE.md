# AI Agent Plugin

ONLYOFFICE Desktop Editor plugin providing a multi-provider AI chat interface with MCP tool support, streaming responses, and persistent chat history.

## Tech Stack

- **UI:** React 19, TypeScript, Tailwind CSS 4, Radix UI, @assistant-ui/react
- **Build:** Vite 7, Biome (linter/formatter)
- **State:** Zustand 5 (8 stores)
- **Persistence:** IndexedDB (5 stores) + localStorage (settings/flags)
- **i18n:** i18next — 22 languages
- **Testing:** Vitest (unit), Playwright (e2e)
- **Animation:** Framer Motion

## Project Structure

```
src/
├── pages/              # Chat, Settings, InitialSetup, EmptyScreen, ModelAssignment, MCPServers, WebSearch
├── components/         # 30 component directories (layout, dialog, markdown, servers, model-config-cards, etc.)
├── store/              # Zustand stores (8 files)
├── database/           # IndexedDB: ChatDB class + CRUD modules
├── providers/          # AI provider implementations (15 providers)
├── servers/            # MCP server management (Desktop, WebSearch, Custom)
├── hooks/              # React hooks (useMessages, useProfiles, useThreads, useServers, useDirection)
├── lib/                # Types, constants, utilities
├── translations/       # 22 language JSON files
├── styles/             # Theme CSS files (7 themes)
└── assets/             # Provider logos, format icons, theme assets
```

## AI Providers (15)

All extend `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>` with async generator streaming.

| Provider | SDK | Notes |
|----------|-----|-------|
| Anthropic | @anthropic-ai/sdk | Extended thinking (budget_tokens) |
| OpenAI | openai | Reasoning model support |
| Google GenAI | @google/genai | |
| Mistral | @mistralai/mistralai | |
| Together | together-ai | |
| OpenRouter | @openrouter/ai-sdk-provider | |
| DeepSeek | (OpenAI-compatible) | |
| XAI | (OpenAI-compatible) | |
| Groq | (OpenAI-compatible) | LPU inference |
| Zhipu | (OpenAI-compatible) | GLM-4 models, fallback model list |
| GPT4All | (OpenAI-compatible) | Local models |
| Stability AI | (custom, FormData) | Image-only (Stable Diffusion) |
| Ollama | ollama | Local models |
| LM Studio | @lmstudio/sdk | Local models |
| OpenAI Compatible | (extends OpenAI) | Custom endpoints |

Provider registry in `src/providers/registry.ts` — singleton instances, type-safe lookup.

## MCP Servers & Tools

Three tool sources aggregated in `src/servers/index.ts`:

1. **DesktopEditorTool** — built-in ONLYOFFICE integrations
2. **WebSearch** — Exa API for real-time web search
3. **CustomServers** — user-configured STDIO/HTTP MCP servers (JSON-RPC 2.0)

Tool limits: 100 max (102 with web search). Tool names prefixed: `{serverType}_{toolName}`.

Tool approval workflow: auto-allow, always-allow (persisted), or UI prompt via `ManageToolDialog`.

## State Management (Zustand Stores)

| Store | Purpose |
|-------|---------|
| `useMessageStore` | Messages, streaming state, stop control |
| `useThreadsStore` | Thread CRUD, switching, migration from legacy schema |
| `useProfilesStore` | Profiles, task-specific assignments, extended thinking flag |
| `useServersStore` | MCP servers, tools, disabled tools, web search toggle |
| `useAttachmentsStore` | File/image attachments (max 5+5) |
| `usePromptsStore` | Saved prompts and folders |
| `useRouter` | Page navigation (chat, settings, initial-setup, history) |
| `useThemeStore` | Theme selection |

## Database (IndexedDB — "ChatHistory")

| Store | Key | Indices |
|-------|-----|---------|
| threads | threadId | updatedAt |
| messages | id | threadId, timestamp |
| profiles | id | — |
| prompts | id | createdAt, folderId |
| promptFolders | id | createdAt |

CRUD modules in `src/database/` — one file per store.

## Key Features

- **Multi-provider chat** with profile-based model selection
- **Streaming responses** via async generators
- **Extended thinking** (deep reasoning mode) for supported models
- **File attachments** — documents (PDF, Word, Excel, etc.) and images
- **MCP tool calls** with approval workflow and "always allow" persistence
- **Saved prompts** organized in folders
- **Model assignment** — default + 7 task-specific profiles (Chat, Summarization, Translation, Text Analysis, Image Generation, OCR, Vision)
- **Chat history** — search, rename, delete, save as DOCX
- **7 themes** — dark, light, night, white, gray, classic-light, contrast-dark
- **22 languages** with RTL support
- **ONLYOFFICE integration** — file conversion, save to DOCX, editor interop

## Scripts

```bash
npm run dev          # Vite dev server
npm run build        # biome check + tsc + vite build + post-build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npm run lint         # Biome lint
npm run format       # Biome format
npm run check        # Biome check (lint + format)
```

## Code Style (Biome)

- Double quotes, semicolons always, ES5 trailing commas
- 2-space indent, 80-char line width, LF line endings
- Strict: errors on unused imports/vars, no console
- Path alias: `@/` → `./src/`
