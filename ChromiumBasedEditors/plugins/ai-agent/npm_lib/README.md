# @onlyoffice/ai-chat — Library Core

This folder is the **core of the ai-chat library**. It contains interfaces, React providers, shared types, AI provider implementations, tool runtime logic, and business-logic services. It has **zero imports from `src/`** — fully self-contained.

Host-specific code (IndexedDB, `window.AscDesktopEditor`, ONLYOFFICE APIs) lives in `src/` and is injected via adapters.

## Architecture

```
npm_lib/          — Library core: types, adapters, contexts, AI providers, tool runtime, services
src/              — Host implementation: IndexedDB storage, localStorage settings, OnlyOffice platform, UI components
```

## File Structure

```
npm_lib/
├── index.ts                       # Root entry — re-exports everything
├── types.ts                       # Shared domain types (Thread, Profile, Model, etc.)
├── capabilities.ts                # CapabilitiesUI bitmask, ActionType, inferCapabilities()
├── constants.ts                   # Shared constants (CURRENT_MODEL_KEY)
├── utils.ts                       # Message utilities (convertMessagesToMd, removeSpecialCharacter, getMessageTitleFromMd)
├── README.md
│
├── storage/
│   ├── types.ts                   # StorageAdapter interface + sub-interfaces
│   ├── context.tsx                # StorageProvider + useStorage()
│   ├── storage-holder.ts          # Global holder for Zustand stores
│   └── index.ts
│
├── settings/
│   ├── types.ts                   # SettingsAdapter interface (key-value)
│   ├── context.tsx                # SettingsProvider + useSettings()
│   ├── settings-holder.ts         # Global holder for Zustand stores
│   └── index.ts
│
├── platform/
│   ├── types.ts                   # PlatformAdapter interface + sub-interfaces
│   ├── context.tsx                # PlatformProvider + usePlatform()
│   ├── platform-holder.ts         # Global holder for Zustand stores
│   └── index.ts
│
├── tools/
│   ├── types.ts                   # HostTool, HostToolGroup, ToolSource
│   ├── context.tsx                # ToolsProvider + useToolsContext()
│   ├── servers.ts                 # Servers aggregator class
│   ├── tools-holder.ts            # Global holder for Zustand stores
│   ├── sources/
│   │   ├── HostToolSource.ts      # Wraps HostToolGroup[] from host
│   │   ├── WebSearch.ts           # Exa API web search
│   │   └── CustomServers.ts       # MCP STDIO/HTTP servers
│   └── index.ts
│
├── services/
│   ├── index.ts                   # Re-exports all services
│   ├── action-holders.ts          # Action holders — per-ActionType provider instances
│   ├── prompts.ts                 # PromptsService — prompt/folder CRUD
│   ├── threads.ts                 # ThreadsService — thread lifecycle, migration, export
│   ├── profiles.ts                # ProfilesService — profile validation, task assignments, provider sync
│   ├── servers.ts                 # ServersService — MCP config, tool list building, enable/disable
│   └── chat-engine.ts             # ChatEngine — message sending, streaming, tool call approval/deny
│
└── providers/
    ├── index.ts                   # Provider class (AI provider manager)
    ├── base.ts                    # AbstractBaseProvider<TOOL, MESSAGE, CLIENT>
    ├── registry.ts                # Provider registry + registerProvider/unregisterProvider
    ├── errors.ts                  # Error handling utilities
    ├── prompts.ts                 # System prompts
    ├── provider-holder.ts         # Global holder for Zustand stores
    ├── anthropic/                 # Claude (Anthropic SDK)
    ├── openai/                    # GPT (OpenAI SDK)
    ├── genai/                     # Gemini (Google GenAI SDK)
    ├── mistral/                   # Mistral SDK
    ├── ollama/                    # Ollama (local)
    ├── lm-studio/                 # LM Studio (local)
    ├── together/                  # Together AI
    ├── openrouter/                # OpenRouter
    ├── deepseek/                  # DeepSeek
    ├── xai/                       # xAI (Grok)
    ├── openaicompatible/          # Generic OpenAI-compatible
    └── tests/
```

## Initialization Order

All providers set their global holders **synchronously during render** so Zustand stores can access them immediately. The chain:

```
App
├── SettingsProvider          [SYNC]  setSettingsInstance()
│   └── PlatformProvider      [SYNC]  setPlatformInstance()
│       ├── Provider instance [SYNC]  setProviderInstance() via useMemo
│       └── AppWithTools
│           └── ToolsProvider [SYNC]  new Servers() + setServersInstance()
│               └── StorageProvider
│                   ├── [SYNC]    setStorageInstance()
│                   ├── [ASYNC]   storage.init() → renders children when ready
│                   └── AppInner  [uses all holders safely]
```

**Key rule:** All holders are set synchronously. `StorageProvider` additionally gates rendering on async `init()`.

---

## Modules

### types.ts — Shared Domain Types

| Type | Description |
|------|-------------|
| `Thread` | Chat session (threadId, title, lastEditDate, profileId) |
| `Profile` | AI provider profile (name, providerType, baseUrl, key, modelId, capabilities) |
| `Model` | AI model reference (id, name, provider, reasoning, capabilities) |
| `TProvider` | Provider connection info (type, name, key, baseUrl) |
| `ProviderType` | `BuiltinProviderType | (string & {})` — builtin autocomplete + custom strings |
| `TMCPItem` | MCP tool schema (name, description, inputSchema) |
| `Prompt` | Saved prompt (id, name, text, folderId, timestamps) |
| `PromptFolder` | Prompt folder (id, name, timestamps) |
| `TAttachmentFile` | File attachment (path, content, type) |
| `TAttachmentImage` | Image attachment (name, base64) |
| `TProcess` | External process handle (stdin, onprocess, end, start) |

---

### capabilities.ts — Model Capabilities & Action Types

**CapabilitiesUI** — bitmask flags for model capabilities:

| Flag | Value | Description |
|------|-------|-------------|
| `None` | 0x00 | No capabilities |
| `Chat` | 0x01 | Text chat |
| `Image` | 0x02 | Image generation |
| `Embeddings` | 0x04 | Text embeddings |
| `Audio` | 0x08 | Audio (TTS/STT) |
| `Vision` | 0x80 | Image understanding |
| `Tools` | 0x100 | Tool/function calling |

Capabilities are stored as bitmasks on `Model` and `Profile`. Each provider returns capabilities from `getProviderModels()`. Model Assignment UI filters profiles by required capability per task.

**ActionType** — task types for model assignment:

`Chat`, `Summarization`, `Translation`, `TextAnalyze`, `ImageGeneration`, `OCR`, `Vision`

**Action Holders** — each ActionType gets a dedicated provider instance via `getActionProvider(actionType)`. Configured automatically when profiles change. Fallback: task profile -> default profile -> undefined.

```ts
import { ActionType, getActionProvider } from "@onlyoffice/ai-chat";

const provider = getActionProvider(ActionType.Summarization);
if (provider) {
  const result = await provider.sendMessageSync([
    { role: "user", content: "Summarize this text: ..." },
  ]);
}
```

---

### storage/ — Pluggable Persistence

The host provides a `StorageAdapter` implementation with 5 sub-stores:

| Sub-store | Key methods |
|-----------|-------------|
| `threads` | create, getAll, getById, update, touch, delete (cascading) |
| `messages` | create, getByThread, getById, update, delete, deleteByThread, replaceByThread, search |
| `profiles` | create, createMany, getAll, getById, update, delete |
| `prompts` | create, getAll, getById, update, delete, deleteByFolder |
| `promptFolders` | create, getAll, getById, update, delete (cascading) |

Plus `init()` / `close()` lifecycle.

**Current host implementation:** `src/storage/indexeddb/` — IndexedDB with 5 object stores.

---

### settings/ — Pluggable Key-Value Settings

The host provides a `SettingsAdapter` for persisting user preferences:

```ts
interface SettingsAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

Settings keys (e.g. `"default-profile"`, `"mcpServers"`) are defined by the host, not the library. Services receive keys via constructor or method arguments.

**Current host implementation:** `src/settings/localStorage.ts` — wraps browser `localStorage`.

---

### platform/ — Platform Abstraction

| Sub-interface | Nullable | When null, hides |
|---------------|----------|-----------------|
| `file` | Yes | File/image attachment buttons, "Save as DOCX" |
| `process` | Yes | STDIO MCP servers (HTTP still works) |
| `env` | No | — (always required: theme, locale, pixelRatio) |
| `hostTools` | Yes | Desktop editor tools section in tools list |

**Current host implementations:** `src/platform/onlyoffice/` and `src/platform/noop/`.

---

### tools/ — Unified Tool System

Three tool sources managed by `Servers` class:

| Source | Description | Availability |
|--------|-------------|-------------|
| `HostToolSource` | Host-provided tool groups (`HostToolGroup[]`) | Always, if passed via `ToolsProvider` |
| `WebSearch` | Exa API (web_search + web_crawling) | When configured with provider + API key |
| `CustomServers` | MCP via JSON-RPC 2.0 | HTTP always; STDIO only if `platform.process` available |

**Tool approval:** Host tools auto-allow by default (`requireApproval: false`). MCP tools require UI approval. Web search always auto-allows.

---

### services/ — Business Logic

Services contain all chat business logic. They depend on holders (`getStorageInstance()`, `getSettingsInstance()`, etc.) and have zero UI dependencies.

| Service | Responsibility |
|---------|---------------|
| `ActionHolders` | Per-ActionType provider instances with fallback (task profile -> default profile) |
| `PromptsService` | Prompt/folder CRUD with storage persistence |
| `ThreadsService` | Thread lifecycle, legacy migration, DOCX export, deletion |
| `ProfilesService` | Profile validation, task profile assignments, provider sync |
| `ServersService` | MCP config persistence, tool list building with limits, enable/disable, tool call routing |
| `ChatEngine` | Message sending, streaming via `AsyncGenerator<ChatEvent>`, tool call approval/deny, thread title generation |

**ChatEngine event types:**

| ChatEvent type | Description |
|----------------|-------------|
| `message-start` | First chunk of assistant response |
| `message-delta` | Subsequent streaming chunk |
| `message-end` | Stream complete |
| `message-incomplete` | Stream interrupted (error/cancel) |
| `tool-call-pending` | Tool call requires user approval |
| `thread-title` | Thread title generated, create thread |

---

### providers/ — AI Provider System

11 built-in providers + runtime registration for custom ones.

**AbstractBaseProvider<TOOL, MESSAGE, CLIENT>** — base class:

| Method | Type | Description |
|--------|------|-------------|
| `sendMessage()` | abstract | Streaming chat via async generator |
| `sendMessageAfterToolCall()` | abstract | Continue after tool call |
| `sendMessageSync()` | concrete | Non-streaming chat — drains generator, returns string |
| `imageGeneration()` | optional | Image generation — returns base64 (OpenAI only) |
| `imageVision()` | concrete | Image analysis — sends image+prompt via sendMessageSync |
| `imageOCR()` | concrete | OCR — extracts text from image via imageVision |
| `isSupportStreaming()` | concrete | Streaming support flag (default true) |
| `setProvider()` / `setTools()` / `setPrevMessages()` | abstract | Configuration |
| `checkProvider()` / `getProviderModels()` | abstract | Validation and model discovery (returns capabilities) |
| `createChatName()` | abstract | Generate thread title from content |

**Registry:**
- `getProvider(type)` — lookup builtin or custom (singleton)
- `createProvider(type)` — create a new (non-singleton) instance
- `registerProvider(type, instance)` — add custom provider at runtime
- `unregisterProvider(type)` — remove custom provider
- `getSupportedProviderTypes()` — all registered types
- `isValidProviderType(type)` — check if type exists

**Provider class** (`index.ts`) — wrapper that manages current active provider, delegates all calls.

---

## Usage

### Current Host (ONLYOFFICE Plugin)

```tsx
// src/App.tsx
const App = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const settings = useMemo(() => new LocalStorageSettings(), []);
  const platform = useMemo(
    () => isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform(),
    []
  );

  useMemo(() => {
    const p = new Provider();
    setProviderInstance(p);
    return p;
  }, []);

  return (
    <SettingsProvider settings={settings}>
      <PlatformProvider platform={platform}>
        <AppWithTools storage={storage} />
      </PlatformProvider>
    </SettingsProvider>
  );
};
```

### Custom Host (example)

```tsx
import {
  PlatformProvider, StorageProvider, ToolsProvider, SettingsProvider,
  type StorageAdapter, type PlatformAdapter, type SettingsAdapter, type HostToolGroup,
  Provider, setProviderInstance,
} from "@onlyoffice/ai-chat";

const myStorage: StorageAdapter = { /* REST API */ };
const mySettings: SettingsAdapter = {
  get: (key) => sessionStorage.getItem(key),
  set: (key, value) => sessionStorage.setItem(key, value),
  remove: (key) => sessionStorage.removeItem(key),
};
const myPlatform: PlatformAdapter = {
  file: null,
  process: null,
  env: { theme: "theme-dark", systemTheme: "dark", locale: "en", devicePixelRatio: 2 },
  hostTools: null,
};
const myTools: HostToolGroup[] = [
  {
    id: "crm",
    name: "CRM",
    tools: [{
      name: "find_contact",
      description: "Find a contact",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      handler: async (args) => crm.search(args.query),
    }],
  },
];

const p = new Provider();
setProviderInstance(p);

<SettingsProvider settings={mySettings}>
  <PlatformProvider platform={myPlatform}>
    <ToolsProvider hostToolGroups={myTools}>
      <StorageProvider storage={myStorage}>
        <Chat />
      </StorageProvider>
    </ToolsProvider>
  </PlatformProvider>
</SettingsProvider>
```

### Using Services Directly

```tsx
import { ChatEngine, ProfilesService, ServersService } from "@onlyoffice/ai-chat";

// Profile management
const profiles = new ProfilesService();
const result = await profiles.init({ defaultKey: "default-profile", taskKeys: ["chat-profile"] });

// Chat orchestration
const chat = new ChatEngine();
for await (const event of chat.sendMessage({
  text: "Hello!",
  threadId: "thread-1",
  existingMessages: [],
  extendedThinking: false,
})) {
  switch (event.type) {
    case "message-start": console.log("Stream started");  break;
    case "message-delta": console.log("Chunk:", event.message); break;
    case "message-end":   console.log("Done"); break;
    case "tool-call-pending": /* show approval UI */ break;
  }
}
```

### Adding a Custom AI Provider

```tsx
import { AbstractBaseProvider, registerProvider } from "@onlyoffice/ai-chat";

class MyProvider extends AbstractBaseProvider<MyTool, MyMsg, MyClient> {
  getName() { return "My LLM"; }
  getBaseUrl() { return "https://llm.example.com"; }
  // ... implement all abstract methods
}

registerProvider("my-llm", new MyProvider());
// Now profiles with providerType: "my-llm" will use MyProvider
```

---

## Rules

1. **No imports from `src/`** — npm_lib is fully self-contained
2. **No host-specific code** — no `window.*`, no IndexedDB, no ONLYOFFICE APIs, no localStorage
3. **All providers/adapters require explicit props** — no auto-detection, no defaults, no fallbacks
4. **Settings keys are host-defined** — services receive keys via arguments, never hardcode them
5. **Holders set synchronously** — during render, not in useEffect, so Zustand stores can access them immediately
6. **`ProviderType` accepts any string** — builtin types have autocomplete, custom types work via `registerProvider()`
