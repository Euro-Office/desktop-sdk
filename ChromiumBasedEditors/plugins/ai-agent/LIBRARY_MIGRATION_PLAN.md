# AI Chat Library Migration Plan

Превращение ai-agent плагина в NPM-библиотеку `@onlyoffice/ai-chat` с сохранением обратной совместимости.

## Структура npm_lib/

Весь код библиотеки создаётся в папке `npm_lib/`. Плагин (`src/`) импортирует из неё. Это позволяет развивать библиотеку отдельно, не ломая текущий плагин.

```
npm_lib/
├── storage/                           # ✅ DONE
│   ├── types.ts
│   ├── indexeddb/
│   ├── context.tsx
│   ├── storage-holder.ts
│   └── index.ts
├── platform/                          # ✅ DONE
│   ├── types.ts
│   ├── onlyoffice/
│   ├── noop/
│   ├── context.tsx
│   ├── platform-holder.ts
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
Этап 1: Tools API + ToolRegistry (пункт 3)
  ├── Создать npm_lib/tools/ (registry + sources)
  ├── Перенести src/servers/WebSearch.ts → npm_lib/tools/sources/web-search.ts
  ├── Перенести src/servers/CustomServers.ts → npm_lib/tools/sources/mcp.ts
  ├── Создать npm_lib/tools/sources/host.ts (HostToolSource)
  ├── Удалить src/servers/DesktopEditor.ts
  └── Переключить src/store/useServersStore.ts на ToolRegistry

Этап 2: customProviders (пункт 4)
  ├── Перенести src/providers/ → npm_lib/providers/
  ├── Расширить registry (register/unregister)
  ├── Расширить ProviderType
  └── Fallback-иконка для кастомных провайдеров
```
