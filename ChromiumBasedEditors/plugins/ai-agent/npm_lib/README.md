# @onlyoffice/ai-chat — Library Core

This folder contains the **public API surface** of the ai-chat library. It defines interfaces, React providers, and shared types — but **no concrete implementations**. Implementations live in `src/` and are injected at runtime.

## Architecture Principle

```
npm_lib/          — Interfaces, types, contexts (what the library exposes)
src/              — Implementations, UI components (what the plugin uses)
```

A host application imports types and providers from `npm_lib/`, then passes its own implementations. The current ONLYOFFICE plugin (`src/`) is just one such host — it creates `IndexedDBStorage`, `OnlyOfficePlatform`, and passes them into the providers.

## File Structure

```
npm_lib/
├── index.ts                    # Root entry — re-exports everything below
├── types.ts                    # Shared domain types (Thread, Profile, Model, etc.)
├── README.md                   # This file
│
├── storage/
│   ├── types.ts                # StorageAdapter interface + sub-interfaces
│   ├── context.tsx             # StorageProvider + useStorage() hook
│   ├── storage-holder.ts       # Global holder for Zustand stores
│   └── index.ts                # Re-exports
│
└── platform/
    ├── types.ts                # PlatformAdapter interface + sub-interfaces
    ├── context.tsx             # PlatformProvider + usePlatform() hook
    ├── platform-holder.ts      # Global holder for Zustand stores
    └── index.ts                # Re-exports
```

## Modules

### types.ts — Shared Domain Types

All data types used across the library and the host:

| Type | Description |
|------|-------------|
| `Thread` | Chat session (threadId, title, lastEditDate, profileId) |
| `Profile` | AI provider profile (name, providerType, baseUrl, key, modelId) |
| `Model` | AI model reference (id, name, provider, reasoning) |
| `TProvider` | Provider connection info (type, name, key, baseUrl) |
| `ProviderType` | Union of supported provider identifiers |
| `TMCPItem` | MCP tool schema (name, description, inputSchema) |
| `Prompt` | Saved prompt (id, name, text, folderId, timestamps) |
| `PromptFolder` | Prompt folder (id, name, timestamps) |
| `TAttachmentFile` | File attachment (path, content, type) |
| `TAttachmentImage` | Image attachment (name, base64) |
| `TProcess` | External process handle (stdin, onprocess, end, start) |

These types are re-exported from `src/lib/types.ts` for backward compatibility with the existing codebase.

---

### storage/ — Pluggable Persistence

Defines how the chat stores its data (threads, messages, profiles, prompts).

#### StorageAdapter Interface

The host must provide a `StorageAdapter` implementation with 5 sub-stores:

| Sub-store | Responsibility |
|-----------|---------------|
| `threads` | Chat sessions — create, getAll, getById, update, touch, delete (cascading) |
| `messages` | Chat messages — create, getByThread, getById, update, delete, deleteByThread, replaceByThread, search |
| `profiles` | AI provider profiles — create, createMany, getAll, getById, update, delete |
| `prompts` | Saved prompts — create, getAll, getById, update, delete, deleteByFolder |
| `promptFolders` | Prompt folders — create, getAll, getById, update, delete (cascading) |

Plus `init()` and `close()` lifecycle methods.

#### StorageProvider

React context provider. **Requires** a `storage` prop — no default implementation.

```tsx
<StorageProvider storage={myStorage}>
  {children}
</StorageProvider>
```

- Calls `storage.init()` on mount, renders children only after init completes
- Calls `storage.close()` on unmount
- Sets the global holder so Zustand stores can access storage outside React

#### storage-holder.ts

Global singleton holder. Zustand stores can't use React context, so they call `getStorageInstance()` to access the active storage. Set automatically by `StorageProvider`.

#### Current Implementation (in `src/`)

`src/storage/indexeddb/` — `IndexedDBStorage` using browser IndexedDB with 5 object stores (threads, messages, profiles, prompts, promptFolders).

---

### platform/ — Platform Abstraction

Defines how the chat interacts with the host environment (file system, processes, theme, tools).

#### PlatformAdapter Interface

| Sub-interface | Nullable | Responsibility |
|---------------|----------|---------------|
| `file: PlatformFileOperations` | Yes | File picker, convert to text, save as, open in editor, recent files |
| `process: PlatformProcessRunner` | Yes | Spawn external processes (for MCP STDIO servers) |
| `env: PlatformEnvironment` | No | Theme, system theme, locale, device pixel ratio, environment change events |
| `hostTools: PlatformHostTools` | Yes | Built-in host tools (get list, call tool) |

**Nullable fields**: when `null`, the corresponding UI is hidden:
- `file = null` → no file/image attachment buttons, no "Save as DOCX"
- `process = null` → STDIO MCP servers unavailable (HTTP still works)
- `hostTools = null` → no desktop-editor tools section

#### PlatformProvider

React context provider. **Requires** a `platform` prop — no default implementation.

```tsx
<PlatformProvider platform={myPlatform}>
  {children}
</PlatformProvider>
```

Sets the global holder **synchronously during render** (not in useEffect) so that Zustand stores initialized at module-import time can access platform immediately.

#### platform-holder.ts

Global singleton holder. Same pattern as storage-holder — needed because Zustand stores and singletons (like `DesktopEditorTool`, `useThemeStore`) can't use React context.

#### Current Implementations (in `src/`)

- `src/platform/onlyoffice/` — `OnlyOfficePlatform`: wraps `window.AscDesktopEditor`, `window.RendererProcessVariable`, `window.ExternalProcess`
- `src/platform/noop/` — `NoopPlatform`: returns `null` for file/process/hostTools, defaults for env

---

## Usage by Host

### ONLYOFFICE Plugin (current)

```tsx
// src/App.tsx
const App = () => {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const platform = useMemo(
    () => isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform(),
    []
  );

  return (
    <PlatformProvider platform={platform}>
      <StorageProvider storage={storage}>
        <AppInner />
      </StorageProvider>
    </PlatformProvider>
  );
};
```

### Custom Host (example)

```tsx
import {
  StorageProvider, PlatformProvider,
  type StorageAdapter, type PlatformAdapter
} from "@onlyoffice/ai-chat";

const myStorage: StorageAdapter = { /* REST API implementation */ };
const myPlatform: PlatformAdapter = {
  file: null,       // no file operations
  process: null,    // no STDIO
  env: { theme: "theme-dark", systemTheme: "dark", locale: "en", devicePixelRatio: 2 },
  hostTools: null,  // no built-in tools
};

<PlatformProvider platform={myPlatform}>
  <StorageProvider storage={myStorage}>
    <Chat />
  </StorageProvider>
</PlatformProvider>
```

## Rules

1. **No imports from `src/`** — npm_lib must be fully self-contained
2. **No concrete implementations** — only interfaces, types, contexts, holders
3. **All providers require explicit props** — no auto-detection, no defaults
4. **Holders exist for Zustand** — React context is the primary mechanism, holders are a bridge for non-React code
