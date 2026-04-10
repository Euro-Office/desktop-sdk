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
├── platform/
│   ├── types.ts                # PlatformAdapter interface + sub-interfaces
│   ├── context.tsx             # PlatformProvider + usePlatform() hook
│   ├── platform-holder.ts      # Global holder for Zustand stores
│   └── index.ts                # Re-exports
│
└── tools/
    ├── types.ts                # HostTool, HostToolGroup, ToolSource interfaces
    ├── context.tsx             # ToolsProvider + useToolsContext() hook
    ├── servers.ts              # Servers aggregator class
    ├── tools-holder.ts         # Global holder for Zustand stores
    ├── sources/
    │   ├── HostToolSource.ts   # Wraps HostToolGroup[] from host
    │   ├── WebSearch.ts        # Exa API web search
    │   └── CustomServers.ts    # MCP STDIO/HTTP servers
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

### tools/ — Unified Tool System

Manages all tool sources: host-provided tools, web search, and MCP servers. Contains both interfaces and runtime logic (WebSearch, CustomServers, Servers aggregator).

#### Key Types

| Type | Description |
|------|-------------|
| `HostTool` | A single tool the host exposes to the AI model (name, description, inputSchema, handler, requireApproval) |
| `HostToolGroup` | A named group of host tools displayed as a section in the UI (id, name, tools) |
| `ToolSource` | Interface for any tool provider (id, getTools, callTool, autoAllow) |

#### Tool Sources (in `sources/`)

| Source | File | Description |
|--------|------|-------------|
| `HostToolSource` | `sources/HostToolSource.ts` | Wraps `HostToolGroup[]` from the host. Replaces the old `DesktopEditorTool` |
| `WebSearch` | `sources/WebSearch.ts` | Exa API web search (web_search + web_crawling tools). Available when configured with provider + key |
| `CustomServers` | `sources/CustomServers.ts` | MCP servers via JSON-RPC 2.0. HTTP servers always work, STDIO only if `platform.process` is available |

#### Servers Class (`servers.ts`)

Central aggregator that combines all tool sources. Manages:
- Tool aggregation from all sources via `getTools()`
- Tool call routing via `callTools(type, name, args)`
- Server type detection via `getServerType(name)`
- Allow-always permissions for tool approval
- MCP server lifecycle (start, restart, delete)
- Web search configuration

#### ToolsProvider

React context provider. Creates a `Servers` instance and manages its lifecycle.

```tsx
<ToolsProvider hostToolGroups={myToolGroups}>
  {children}
</ToolsProvider>
```

- Creates `Servers` instance on mount
- Sets global tools-holder so Zustand stores can access it
- Syncs `hostToolGroups` into `Servers.hostToolSource`
- Exposes `servers` and `hostToolGroups` via `useToolsContext()`

#### tools-holder.ts

Global holder for the `Servers` instance. Same pattern as storage-holder and platform-holder — bridge for Zustand stores and non-React code.

#### Tool Approval Flow

- **Host tools** with `requireApproval: false` (default) → auto-allow
- **Host tools** with `requireApproval: true` → ManageToolDialog approval UI
- **MCP tools** → approval via ManageToolDialog (can be "always allowed")
- **Web search tools** → always auto-allow

#### How Host Tools Work

The host passes `HostToolGroup[]` via `ToolsProvider`. Each group appears as a section in the tools UI (like "Desktop Editor", "CRM Tools"). Tools within a group are prefixed with `{group.id}_` for uniqueness.

```tsx
const hostTools: HostToolGroup[] = [
  {
    id: "desktop-editor",
    name: "Desktop Editor",
    tools: [
      {
        name: "insert_text",
        description: "Insert text at cursor",
        inputSchema: { type: "object", properties: { text: { type: "string" } } },
        handler: async (args) => editor.insertText(args.text),
      },
    ],
  },
];

<ToolsProvider hostToolGroups={hostTools}>
  <App />
</ToolsProvider>
```

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
2. **No host-specific implementations** — interfaces, types, contexts, holders, and core runtime logic (tools, servers). No `window.*` calls, no IndexedDB, no ONLYOFFICE API
3. **All providers require explicit props** — no auto-detection, no defaults
4. **Holders exist for Zustand** — React context is the primary mechanism, holders are a bridge for non-React code
