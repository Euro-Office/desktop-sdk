# AI Chat Library Migration Plan

Превращение ai-agent плагина в NPM-библиотеку `@onlyoffice/ai-chat` с сохранением обратной совместимости.

## Структура npm_lib/

Весь код библиотеки создаётся в папке `npm_lib/`. Плагин (`src/`) импортирует из неё. Это позволяет развивать библиотеку отдельно, не ломая текущий плагин.

```
npm_lib/
├── storage/
│   ├── types.ts                    # StorageAdapter + sub-interfaces
│   ├── indexeddb/                  # Дефолтная реализация
│   │   ├── index.ts
│   │   ├── threads.ts
│   │   ├── messages.ts
│   │   ├── profiles.ts
│   │   └── prompts.ts             # prompts + prompt-folders
│   └── index.ts                   # re-export
├── platform/
│   ├── types.ts                   # PlatformAdapter + sub-interfaces
│   ├── onlyoffice/                # ONLYOFFICE Desktop реализация
│   │   ├── index.ts
│   │   ├── file-ops.ts
│   │   ├── process-runner.ts
│   │   ├── environment.ts
│   │   └── host-tools.ts
│   ├── noop/
│   │   └── index.ts               # Fallback (null для file/process/hostTools)
│   └── index.ts
├── tools/
│   ├── types.ts                   # HostTool, HostToolGroup, UnifiedTool, ToolSource
│   ├── registry.ts                # ToolRegistry class
│   ├── sources/
│   │   ├── host.ts                # HostToolSource (wraps HostToolGroup[])
│   │   ├── web-search.ts          # WebSearchToolSource
│   │   └── mcp.ts                 # MCPToolSource (STDIO + HTTP)
│   └── index.ts
├── providers/
│   ├── base.ts                    # AbstractBaseProvider (экспорт для расширения)
│   ├── registry.ts                # providerRegistry + register/unregister
│   ├── anthropic/
│   ├── openai/
│   ├── ... (все 11 провайдеров)
│   └── index.ts
└── index.ts                       # Главный экспорт библиотеки
```

**Связь `src/` → `npm_lib/`:**

`src/App.tsx` сразу импортирует и оборачивает всё в провайдеры из `npm_lib/` — плагин работает через новый слой абстракции. Это позволяет тестировать библиотеку на живом продукте на каждом этапе.

```tsx
// src/App.tsx — после миграции
import { IndexedDBStorage } from "../npm_lib/storage";
import { OnlyOfficePlatform } from "../npm_lib/platform";
import { ToolRegistry, HostToolSource, WebSearchToolSource, MCPToolSource } from "../npm_lib/tools";
import { provider } from "../npm_lib/providers";

function App() {
  const storage = useMemo(() => new IndexedDBStorage(), []);
  const platform = useMemo(() => new OnlyOfficePlatform(), []);

  // Тулы хоста (бывший DesktopEditor) — передаются как HostToolGroup
  const hostTools: HostToolGroup[] = useMemo(() => [{
    id: "desktop-editor",
    name: "Desktop Editor",
    tools: platform.hostTools?.getTools().map(tool => ({
      ...tool,
      handler: (args) => platform.hostTools!.callTool(tool.name, args),
    })) ?? [],
  }], [platform]);

  return (
    <StorageContext.Provider value={storage}>
      <PlatformContext.Provider value={platform}>
        <ToolsContext.Provider value={{ hostTools }}>
          {/* ... остальной App как сейчас ... */}
        </ToolsContext.Provider>
      </PlatformContext.Provider>
    </StorageContext.Provider>
  );
}
```

Таким образом:
- `src/store/` импортирует `StorageAdapter` из `npm_lib/storage` через контекст
- `src/components/` импортирует `usePlatform()` из `npm_lib/platform` через контекст
- `src/hooks/` импортирует `ToolRegistry` из `npm_lib/tools` через контекст
- Старые папки (`src/database/`, `src/servers/`, `src/providers/`) удаляются после переноса
- **На каждом этапе миграции плагин остаётся рабочим** — можно запустить `npm run dev` и проверить

---

## 1. StorageAdapter — pluggable persistence

### Цель
Заменить прямые вызовы `chatDB.getDB()` → `transaction` → `objectStore` на абстрактный интерфейс, чтобы хост мог подставить свой бэкенд (REST API, SQLite, localStorage, etc.). IndexedDB остаётся дефолтной реализацией.

### 1.1 Интерфейс StorageAdapter

Создать `npm_lib/storage/types.ts`:

```ts
export interface ThreadsStorage {
  /** Create a new thread and persist it to storage */
  create(thread: Thread): Promise<void>;

  /** Retrieve all threads sorted by lastEditDate descending (newest first) */
  getAll(): Promise<Thread[]>;

  /** Find a thread by its ID. Returns null if not found */
  getById(threadId: string): Promise<Thread | null>;

  /** Partially update thread fields (title, lastEditDate, etc.) */
  update(threadId: string, updates: Partial<Omit<Thread, "threadId">>): Promise<void>;

  /** Bump lastEditDate and optionally update profileId. Called when a new message is sent */
  touch(threadId: string, updates?: { profileId?: string | null }): Promise<void>;

  /** Delete a thread and all its messages (cascading delete) */
  delete(threadId: string): Promise<void>;
}

export interface MessagesStorage {
  /** Save a new message in a thread. Automatically sets timestamp to Date.now() */
  create(threadId: string, id: string, message: ThreadMessageLike): Promise<void>;

  /** Get all messages for a thread sorted by timestamp ascending (oldest first). Optionally limit to last N messages */
  getByThread(threadId: string, limit?: number): Promise<ThreadMessageLike[]>;

  /** Find a specific message by ID within a thread. Returns null if not found */
  getById(threadId: string, messageId: string): Promise<ThreadMessageLike | null>;

  /** Update message content (e.g. after receiving a tool result). Also updates the timestamp */
  update(messageId: string, message: ThreadMessageLike): Promise<void>;

  /** Delete a single message by ID */
  delete(messageId: string): Promise<void>;

  /** Delete all messages in a thread (used for clearing history or cascading thread delete) */
  deleteByThread(threadId: string): Promise<void>;

  /** Replace all messages in a thread with a new array. Used for bulk operations */
  replaceByThread(threadId: string, messages: ThreadMessageLike[]): Promise<void>;

  /** Full-text case-insensitive search across all message content. Returns {threadId, message} pairs */
  search(query: string): Promise<{ threadId: string; message: ThreadMessageLike }[]>;
}

export interface ProfilesStorage {
  /** Create a single AI provider profile */
  create(profile: Profile): Promise<void>;

  /** Create multiple profiles in a single transaction (used for migration or import) */
  createMany(profiles: Profile[]): Promise<void>;

  /** Retrieve all profiles */
  getAll(): Promise<Profile[]>;

  /** Find a profile by ID. Returns undefined if not found */
  getById(id: string): Promise<Profile | undefined>;

  /** Update a profile by replacing all fields */
  update(profile: Profile): Promise<void>;

  /** Delete a profile by ID */
  delete(id: string): Promise<void>;
}

export interface PromptsStorage {
  /** Create a new saved prompt */
  create(prompt: Prompt): Promise<void>;

  /** Retrieve all prompts sorted by createdAt descending (newest first) */
  getAll(): Promise<Prompt[]>;

  /** Find a prompt by ID. Returns null if not found */
  getById(id: string): Promise<Prompt | null>;

  /** Partially update a prompt: name, text, and/or folderId. Updates the updatedAt timestamp */
  update(id: string, updates: { name?: string; text?: string; folderId?: string | null }): Promise<void>;

  /** Delete a single prompt by ID */
  delete(id: string): Promise<void>;

  /** Delete all prompts in a folder (cascading delete when a folder is removed) */
  deleteByFolder(folderId: string): Promise<void>;
}

export interface PromptFoldersStorage {
  /** Create a new prompt folder */
  create(folder: PromptFolder): Promise<void>;

  /** Retrieve all folders sorted by createdAt descending (newest first) */
  getAll(): Promise<PromptFolder[]>;

  /** Find a folder by ID. Returns null if not found */
  getById(id: string): Promise<PromptFolder | null>;

  /** Rename a folder. Updates the updatedAt timestamp */
  update(id: string, name: string): Promise<void>;

  /** Delete a folder and all prompts inside it (cascading delete) */
  delete(id: string): Promise<void>;
}

export interface StorageAdapter {
  /** Thread (chat session) storage */
  threads: ThreadsStorage;

  /** Message storage */
  messages: MessagesStorage;

  /** AI provider profile storage */
  profiles: ProfilesStorage;

  /** Saved prompt storage */
  prompts: PromptsStorage;

  /** Prompt folder storage */
  promptFolders: PromptFoldersStorage;

  /** Initialize the storage backend (create DB/tables, run migrations). Called once on startup */
  init(): Promise<void>;

  /** Close the storage connection. Called when AIChatProvider unmounts */
  close(): Promise<void>;
}
```

### 1.2 IndexedDB реализация (дефолт)

Создать `npm_lib/storage/indexeddb/index.ts` — реализация `StorageAdapter`:

- Переместить логику из `src/database/index.ts` (ChatDB class) → `IndexedDBStorage.init()` / `.close()`
- Переместить `src/database/threads.ts` → `IndexedDBThreadsStorage implements ThreadsStorage`
- Переместить `src/database/messages.ts` → `IndexedDBMessagesStorage implements MessagesStorage`
- Переместить `src/database/profiles.ts` → `IndexedDBProfilesStorage implements ProfilesStorage`
- Переместить `src/database/prompts.ts` → `IndexedDBPromptsStorage implements PromptsStorage`
- Переместить `src/database/prompt-folders.ts` → `IndexedDBPromptFoldersStorage implements PromptFoldersStorage`
- `src/database/metadata.ts` — объединить нужные функции (migrateProviderToProfile, search, count) в соответствующие storage-классы

Файловая структура: см. `npm_lib/storage/` в общей структуре выше.

### 1.3 Интеграция в приложение

Сейчас все 6 database-модулей импортируются напрямую в stores и hooks:

| Потребитель | Текущий импорт | Новый импорт |
|---|---|---|
| `useThreadsStore.ts` | `import { createThread, readAllThreads, ... } from "@/database/threads"` | `storage.threads.create(...)` через контекст |
| `useMessageStore.ts` | `import { createMessage, readMessages, ... } from "@/database/messages"` | `storage.messages.create(...)` |
| `useProfilesStore.ts` | `import { createProfile, readAllProfiles, ... } from "@/database/profiles"` | `storage.profiles.create(...)` |
| `usePromptsStore.ts` | `import { createPrompt, readAllPrompts, ... } from "@/database/prompts"` | `storage.prompts.create(...)` |
| `usePromptsStore.ts` | `import { createPromptFolder, ... } from "@/database/prompt-folders"` | `storage.promptFolders.create(...)` |
| `App.tsx` | `import { chatDB, initChatDB } from "./database"` | `storage.init()` / `storage.close()` |
| `hooks/useMessages.ts` | `import { createMessage, updateMessage } from "@/database/messages"` | `storage.messages.create(...)` |

**Подход**: storage передаётся через единый Provider (см. пункт 7). Zustand stores получают storage instance при создании или через middleware.

### 1.4 Конкретные изменения по файлам

**Новые файлы (в `npm_lib/storage/`):**
- `npm_lib/storage/types.ts`
- `npm_lib/storage/index.ts`
- `npm_lib/storage/indexeddb/index.ts`
- `npm_lib/storage/indexeddb/threads.ts`
- `npm_lib/storage/indexeddb/messages.ts`
- `npm_lib/storage/indexeddb/profiles.ts`
- `npm_lib/storage/indexeddb/prompts.ts` (промпты + папки в одном, т.к. тесно связаны)

**Удаляемые файлы (после миграции):**
- `src/database/index.ts`
- `src/database/threads.ts`
- `src/database/messages.ts`
- `src/database/profiles.ts`
- `src/database/prompts.ts`
- `src/database/prompt-folders.ts`
- `src/database/metadata.ts`

**Изменяемые файлы (7):**
- `src/store/useThreadsStore.ts` — заменить импорты database → storage
- `src/store/useMessageStore.ts` — аналогично
- `src/store/useProfilesStore.ts` — аналогично
- `src/store/usePromptsStore.ts` — аналогично
- `src/App.tsx` — `initChatDB()` → `storage.init()`
- `src/hooks/useMessages.ts` — заменить database-вызовы
- `src/lib/migrateProvidersToProfiles.ts` — если использует database

---

## 2. PlatformContext — абстракция window.* вызовов

### Цель
Заменить 6 прямых обращений к `window.AscDesktopEditor`, `window.RendererProcessVariable`, `window.ExternalProcess`, `window.on_update_plugin_info` на инъекцию через React Context. Дефолтная реализация = текущее поведение (ONLYOFFICE Desktop).

### 2.1 Интерфейс PlatformAdapter

Создать `npm_lib/platform/types.ts`:

```ts
export interface PlatformFileOperations {
  /** Show a native file picker dialog and return the selected file path and name, or null if cancelled */
  pickFile(): Promise<{ path: string; name: string } | null>;

  /** Show a native image picker dialog and return the image as base64, or null if cancelled */
  pickImage(): Promise<{ name: string; base64: string } | null>;

  /** Convert a file at the given path to plain text (e.g. DOCX/PDF → text). Returns content and ONLYOFFICE file type code */
  convertFileToText(path: string): Promise<{ content: string; type: number }>;

  /** Determine the ONLYOFFICE file type code for a file at the given path */
  getFileType(path: string): number;

  /** Get a JSON string of recently opened files from the host editor */
  getRecentFiles(): Promise<string>;

  /** Show a "Save As" dialog and save content as a file (e.g. export message as DOCX) */
  saveAsFile(content: string, defaultName: string, format: number): Promise<void>;

  /** Open a file in the host editor by path */
  openFile(path: string, name: string): void;
}

export interface PlatformProcessRunner {
  /** Spawn an external process (used for MCP STDIO servers). Returns a process handle or null if unavailable */
  createProcess(command: string, env?: Record<string, string>): TProcess | null;

  /** Check whether external process spawning is supported in the current environment */
  isAvailable(): boolean;
}

export interface PlatformEnvironment {
  /** Current UI theme set by the host application */
  theme: "dark" | "light";

  /** OS-level system theme (may differ from the app theme) */
  systemTheme: "dark" | "light";

  /** Current locale/language code (e.g. "en", "ru", "de") */
  locale: string;

  /** Device pixel ratio for high-DPI rendering */
  devicePixelRatio: number;

  /** Subscribe to theme/language changes from the host. Returns an unsubscribe function */
  onEnvironmentChange?: (callback: (info: { theme?: string; lang?: string }) => void) => () => void;
}

export interface PlatformHostTools {
  /** Get the list of built-in tools provided by the host application (e.g. ONLYOFFICE editor tools) */
  getTools(): TMCPItem[];

  /** Execute a built-in host tool by name with the given arguments. Returns a JSON string result */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

export interface PlatformAdapter {
  /** File operations: picking, converting, saving, opening files via the host. If null — file attachment buttons and "Save as DOCX" are hidden */
  file: PlatformFileOperations | null;

  /** External process runner for MCP STDIO server transport. If null — only HTTP MCP servers are available */
  process: PlatformProcessRunner | null;

  /** Host environment info: theme, locale, pixel ratio, change events */
  env: PlatformEnvironment;

  /** Built-in tools exposed by the host application. If null — no host tools section in the tools list */
  hostTools: PlatformHostTools | null;
}
```

**UI visibility rules:** components check for `null` before rendering platform-dependent features:

| `PlatformAdapter` field | If `null`, hide in UI |
|---|---|
| `file` | "Add file" button, "Add image" button, "Recent files" menu, "Save as DOCX" in message actions, file click-to-open |
| `process` | STDIO MCP server option in config (HTTP servers still work) |
| `hostTools` | "Desktop Editor" section in the tools list |

### 2.2 Дефолтная реализация (ONLYOFFICE Desktop)

Создать `npm_lib/platform/onlyoffice/index.ts`:

```ts
export class OnlyOfficePlatform implements PlatformAdapter {
  file = new OnlyOfficeFileOps();
  process = new OnlyOfficeProcessRunner();
  env = new OnlyOfficeEnvironment();
  hostTools = new OnlyOfficeHostTools();
}
```

Каждый класс — простая обёртка. Вся логика уже есть в текущем коде, просто перемещается из компонентов в адаптер.

### 2.3 Noop/Fallback реализация

Создать `npm_lib/platform/noop/index.ts` — для окружений без ONLYOFFICE:

```ts
export class NoopPlatform implements PlatformAdapter {
  file = null;       // no file operations → attachment buttons hidden
  process = null;    // no process runner → STDIO MCP servers unavailable
  env = {
    theme: "light" as const,
    systemTheme: "light" as const,
    locale: "en",
    devicePixelRatio: 1,
  };
  hostTools = null;  // no host tools → desktop-editor tools section hidden
}
```

### 2.4 Файловая структура

См. `npm_lib/platform/` в общей структуре выше.

### 2.5 Конкретные замены по файлам

| Файл | Текущий вызов | Замена |
|---|---|---|
| `ComposerActionAttachments.tsx:48` | `window.AscDesktopEditor.convertFileExternal(...)` | `platform.file.convertFileToText(path)` |
| `ComposerActionAttachments.tsx:67` | `window.AscDesktopEditor.OpenFilenameDialog(...)` | `platform.file.pickFile()` |
| `ComposerActionAttachments.tsx:72` | `window.AscDesktopEditor.getOfficeFileType(file)` | `platform.file.getFileType(path)` |
| `ComposerActionAttachments.tsx:103` | `window.AscDesktopEditor?.callToolFunction("recent_files_reader")` | `platform.file.getRecentFiles()` |
| `AssistantMessage.tsx:99-102` | `window.AscDesktopEditor.SaveFilenameDialog + saveAndOpen` | `platform.file.saveAsFile(content, name, format)` |
| `useThreadsStore.ts:158-161` | `window.AscDesktopEditor.SaveFilenameDialog + saveAndOpen` | `platform.file.saveAsFile(content, name, format)` |
| `file-item/index.tsx:81` | `window.AscDesktopEditor.openTemplate(file.path, name)` | `platform.file.openFile(path, name)` |
| `servers/DesktopEditor.ts:22` | `window.AscDesktopEditor?.callToolFunction(name, args)` | `platform.hostTools.callTool(name, args)` |
| `servers/DesktopEditor.ts:33` | `window.AscDesktopEditor?.getToolFunctions()` | `platform.hostTools.getTools()` |
| `servers/CustomServers.ts:241,301` | `new window.ExternalProcess(...)` | `platform.process.createProcess(cmd, env)` |
| `layout/index.tsx:25-26` | `window.RendererProcessVariable.lang` | `platform.env.locale` |
| `layout/index.tsx:29` | `window.on_update_plugin_info = ...` | `platform.env.onEnvironmentChange(callback)` |
| `layout/index.tsx:37` | `window.RendererProcessVariable.theme.system` | `platform.env.systemTheme` |
| `useThemeStore.ts:25-29` | `window.RendererProcessVariable.theme` | `platform.env.theme` |
| `useThemeStore.ts:41` | `window.devicePixelRatio` | `platform.env.devicePixelRatio` |
| `main.tsx:12` | `window.parent.document.querySelector(iframe)` | Остаётся в main.tsx (это bootstrap, не часть библиотеки) |

---

## 3. Tools API — unified tool system

### Цель
Объединить все источники тулов в единый ToolRegistry. Убрать DesktopEditor как отдельный класс — вместо него хост передаёт любые тулы снаружи через `hostTools` prop.

### 3.1 Три источника тулов

| Источник | Где живёт | Условие доступности |
|---|---|---|
| **Host tools** (бывший DesktopEditor) | Хост передаёт через prop `hostTools` | Всегда, если переданы |
| **Web search** | Внутри библиотеки (Exa API) | Всегда, если сконфигурирован (provider + key) |
| **Custom MCP servers** | Внутри библиотеки (JSON-RPC 2.0) | HTTP — всегда; STDIO — только если `platform.process` не null |

**Ключевое изменение:** `DesktopEditorTool` удаляется как класс. Его роль полностью заменяется `hostTools` prop — хост может передать что угодно: тулы редактора, тулы CRM, тулы файловой системы и т.д. Библиотека не знает и не заботится откуда они.

### 3.2 Интерфейс HostTool

Создать `npm_lib/tools/types.ts`:

```ts
export interface HostTool {
  /** Unique tool name (e.g. "insert_text", "get_selection"). Will be prefixed with "{group}_" internally */
  name: string;

  /** Human-readable description shown to the AI model and in the tools list UI */
  description: string;

  /** JSON Schema describing the tool's input parameters */
  inputSchema: Record<string, unknown>;

  /** The function that executes the tool. Called with parsed arguments, returns a result for the AI model */
  handler: (args: Record<string, unknown>) => Promise<unknown>;

  /** Whether to show an approval dialog before executing. Default: false (auto-allow) */
  requireApproval?: boolean;
}

export interface HostToolGroup {
  /** Group ID used as source prefix in qualified names (e.g. "desktop_editor" → "desktop_editor_insert_text") */
  id: string;

  /** Display name shown in the tools list UI (e.g. "Desktop Editor", "CRM Tools") */
  name: string;

  /** Tools in this group */
  tools: HostTool[];
}

export interface UnifiedTool {
  /** Unique name across all sources: "{source}_{name}" (e.g. "host_insert_text", "web-search_web_search") */
  qualifiedName: string;

  /** Source identifier: host group id (e.g. "desktop_editor") | "web-search" | "mcp-{serverName}" */
  source: string;

  /** Original tool name without the source prefix */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;

  /** Whether the tool is currently enabled by the user */
  enabled: boolean;
}
```

### 3.3 Unified ToolRegistry

Создать `npm_lib/tools/registry.ts`:

```ts
class ToolRegistry {
  private sources: Map<string, ToolSource> = new Map();

  /** Register a new tool source (host tools, web search, or MCP server) */
  registerSource(source: ToolSource): void;

  /** Remove a tool source by its ID */
  removeSource(id: string): void;

  /** Get all enabled tools as a flat array (for passing to AI provider) */
  getAllTools(): UnifiedTool[];

  /** Get tools grouped by source (for the tools list UI) */
  getToolsBySource(): Record<string, UnifiedTool[]>;

  /** Execute a tool by its qualified name. Extracts source, routes to the correct handler */
  callTool(qualifiedName: string, args: Record<string, unknown>): Promise<unknown>;

  /** Enable or disable a specific tool */
  setToolEnabled(qualifiedName: string, enabled: boolean): void;
}

interface ToolSource {
  /** Unique source ID: "host" | "web-search" | "mcp-{serverName}" */
  id: string;

  /** Fetch available tools from this source */
  getTools(): Promise<TMCPItem[]> | TMCPItem[];

  /** Execute a tool from this source by name */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}
```

### 3.4 Адаптеры — ToolSource implementations

**HostToolSource** — одна инстанция на каждый `HostToolGroup`:
- `getTools()` → маппинг `group.tools` → `TMCPItem[]`
- `callTool(name, args)` → находит HostTool по name, вызывает `handler(args)`
- Source ID: `group.id` (e.g. `"desktop_editor"`, `"crm"`)
- В UI каждая группа отображается как отдельная секция с заголовком `group.name`

**WebSearchToolSource** — обёртка над `src/servers/WebSearch.ts`:
- `getTools()` → 2 хардкоженых тула (`web_search`, `web_crawling`) если сконфигурирован
- `callTool()` → Exa API через fetch
- Source ID: `"web-search"`
- Доступен всегда, если передан `webSearch: { provider, key }`

**MCPToolSource** — обёртка над `src/servers/CustomServers.ts`:
- `getTools()` → JSON-RPC `tools/list`
- `callTool()` → JSON-RPC `tools/call`
- Source ID: `"mcp-{serverName}"`
- **HTTP серверы** — доступны всегда
- **STDIO серверы** — доступны только если `platform.process !== null`. Если `platform.process === null`, STDIO серверы из конфига игнорируются с предупреждением в UI

### 3.5 Как хост передаёт тулы

Через props единого Provider (см. пункт 7):

```tsx
<AIChatProvider
  // Host tools — grouped by source name, each group shows as a section in the tools UI
  hostTools={[
    {
      id: "desktop_editor",
      name: "Desktop Editor",
      tools: [
        {
          name: "insert_text",
          description: "Insert text at cursor position in the document",
          inputSchema: {
            type: "object",
            properties: {
              text: { type: "string", description: "Text to insert" },
            },
            required: ["text"],
          },
          handler: async (args) => {
            editor.insertText(args.text);
            return { success: true };
          },
        },
        {
          name: "get_selection",
          description: "Get the currently selected text",
          inputSchema: { type: "object", properties: {} },
          handler: async () => ({ text: editor.getSelection() }),
        },
      ],
    },
    {
      id: "crm",
      name: "CRM Tools",
      tools: [
        {
          name: "find_contact",
          description: "Search for a contact by name or email",
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
          handler: async (args) => crm.search(args.query),
        },
      ],
    },
  ]}

  // Web search — available if configured
  webSearch={{ provider: "exa", key: "exa-key-..." }}

  // MCP servers — HTTP always work, STDIO only if platform.process is provided
  mcpServers={{
    "my-http-server": { url: "http://localhost:3001/mcp" },
    "my-stdio-server": { command: "node", args: ["./server.js"] },
  }}
/>
```

### 3.6 Файловая структура

См. `npm_lib/tools/` в общей структуре выше.

**Удаляется:** `src/servers/DesktopEditor.ts` — заменён на `hostTools` prop.

### 3.7 Изменения в существующих файлах

| Файл | Что меняется |
|---|---|
| `src/servers/DesktopEditor.ts` | **Удалить**. Функционал заменён `hostTools` prop |
| `src/servers/index.ts` | Рефакторинг: Servers class → использует ToolRegistry |
| `src/servers/CustomServers.ts` | Проверка `platform.process !== null` перед запуском STDIO серверов |
| `src/store/useServersStore.ts` | `getTools()` → `toolRegistry.getAllTools()`, `callTools()` → `toolRegistry.callTool()` |
| `src/hooks/useMessages.ts` | `handleToolCall()` без изменений — уже использует store |
| `src/hooks/useServers.ts` | Инициализация: регистрирует ToolSources в registry |
| `src/components/servers/` | UI: `getToolsBySource()` вместо `servers` state |
| `src/pages/chat/sub-components/ComposerActionServers.tsx` | Отображение hostTools в списке |

### 3.8 Tool approval flow

Текущая логика (`checkAllowAlways` / `setAllowAlways` / `ManageToolDialog`) сохраняется:
- **Host tools** с `requireApproval: false` (дефолт) → auto-allow
- **Host tools** с `requireApproval: true` → показ ManageToolDialog
- **MCP tools** → как сейчас (approval через UI)
- **Web search** → как сейчас (auto-allow)

---

## 4. customProviders — расширение provider registry

### Цель
Позволить хосту добавлять свои AI-провайдеры, наследуя от `AbstractBaseProvider`. Встроенные 11 провайдеров остаются.

### 4.1 Экспорт базового класса

В `src/lib-entry.ts` экспортировать:

```ts
export { AbstractBaseProvider } from "./providers/base";
export type { BaseProvider } from "./providers/registry";
export type { StreamResult, SendMessageReturnType } from "./providers/base";
```

### 4.2 Расширение registry

Изменить `src/providers/registry.ts`:

```ts
const builtinProviders: Record<ProviderType, BaseProvider> = { ... };
const customProviders: Map<string, BaseProvider> = new Map();

export function registerProvider(type: string, provider: BaseProvider): void {
  customProviders.set(type, provider);
}

export function unregisterProvider(type: string): void {
  customProviders.delete(type);
}

export function getProvider(type: string): BaseProvider | undefined {
  return builtinProviders[type as ProviderType] ?? customProviders.get(type);
}

export function getSupportedProviderTypes(): string[] {
  return [...Object.keys(builtinProviders), ...customProviders.keys()];
}
```

### 4.3 Расширение типа ProviderType

Сейчас `ProviderType` — union literal. Для кастомных провайдеров нужно допустить `string`:

```ts
type BuiltinProviderType =
  | "anthropic" | "ollama" | "openai" | "openaicompatible"
  | "together" | "openrouter" | "genai" | "deepseek" | "xai"
  | "lm-studio" | "mistral";

type ProviderType = BuiltinProviderType | (string & {});
```

### 4.4 Хост регистрирует провайдер

Через props единого Provider:

```tsx
class MyCorpProvider extends AbstractBaseProvider<MyTool, MyMsg, MyClient> {
  getName() { return "CorpLLM"; }
  getBaseUrl() { return "https://llm.corp.com"; }
  // ... реализация абстрактных методов
}

<AIChatProvider
  customProviders={[
    { type: "corp-llm", instance: new MyCorpProvider() }
  ]}
  profiles={[
    { id: "1", name: "Corp Model", providerType: "corp-llm", baseUrl: "...", modelId: "v3" }
  ]}
/>
```

### 4.5 Provider logo для кастомных провайдеров

Сейчас `src/components/provider-logo/index.tsx` хардкодит логотипы по `ProviderType`.

Добавить:
- Fallback-иконка для неизвестных типов (первая буква имени)
- Опциональный `icon` field в регистрации кастомного провайдера:

```ts
customProviders={[
  { type: "corp-llm", instance: new MyCorpProvider(), icon: <CorpLogo /> }
]}
```

### 4.6 Файлы

| Файл | Изменение |
|---|---|
| `npm_lib/providers/base.ts` | Перенос из `src/providers/base.ts` без изменений |
| `npm_lib/providers/registry.ts` | Перенос из `src/providers/registry.ts` + добавить `registerProvider()`, `unregisterProvider()` |
| `src/lib/types.ts` | `ProviderType` → `BuiltinProviderType | (string & {})` |
| `src/components/provider-logo/index.tsx` | Fallback-иконка + `customIcons` через контекст |
| `src/store/useProfilesStore.ts` | `addProfile()` — валидация кастомных типов через registry |

---

## Порядок реализации

```
Этап 1: StorageAdapter (пункт 1)
  ├── Создать npm_lib/storage/ (интерфейсы + IndexedDB реализация)
  ├── Переключить src/store/* на импорт из npm_lib/storage/
  ├── Переключить src/hooks/useMessages.ts
  └── Удалить src/database/

Этап 2: PlatformContext (пункт 2)
  ├── Создать npm_lib/platform/ (интерфейсы + OnlyOffice + Noop)
  ├── Заменить window.* вызовы в src/ на usePlatform()
  └── Удалить прямые обращения к window.AscDesktopEditor, ExternalProcess, RendererProcessVariable

Этап 3: Tools API + ToolRegistry (пункт 3)
  ├── Создать npm_lib/tools/ (registry + sources)
  ├── Перенести src/servers/WebSearch.ts → npm_lib/tools/sources/web-search.ts
  ├── Перенести src/servers/CustomServers.ts → npm_lib/tools/sources/mcp.ts
  ├── Создать npm_lib/tools/sources/host.ts (HostToolSource)
  ├── Удалить src/servers/DesktopEditor.ts
  └── Переключить src/store/useServersStore.ts на ToolRegistry

Этап 4: customProviders (пункт 4)
  ├── Перенести src/providers/ → npm_lib/providers/
  ├── Расширить registry (register/unregister)
  ├── Расширить ProviderType
  └── Fallback-иконка для кастомных провайдеров
```

Каждый этап можно мержить отдельным PR — обратная совместимость сохраняется на каждом шаге.
