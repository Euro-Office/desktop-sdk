// =============================================================================
// AI Chat Widget — Public API
// =============================================================================
//
// This is the main entry point for the `@onlyoffice/ai-chat` library.
// It exports everything needed to embed a fully-featured AI chat interface
// into any React application with pluggable storage, settings, platform
// integration, and AI provider support.
//
// Quick start:
//
//   import { AIChatWidget } from "@onlyoffice/ai-chat";
//
//   <AIChatWidget
//     storage={myStorageAdapter}
//     settings={mySettingsAdapter}
//     platform={myPlatformAdapter}
//     locale="en"
//   />
//
// =============================================================================

// ---------------------------------------------------------------------------
// AppContext — Dependency Injection
// ---------------------------------------------------------------------------

/**
 * Dependency injection container for a single `AIChatWidget` instance.
 *
 * Each widget gets its own `AppContext` with isolated `settings`, `storage`,
 * `platform`, `provider`, `servers`, and `eventBus` — enabling multiple
 * independent widget instances on the same page without shared global state.
 *
 * You do **not** need to create this manually — `AIChatWidget` builds it
 * internally. It is exported for advanced use cases (custom services, testing).
 *
 * @example
 * ```ts
 * const ctx: AppContext = {
 *   settings: mySettings,
 *   storage: myStorage,
 *   platform: myPlatform,
 *   provider: new Provider(),
 *   servers: new Servers(mySettings, myPlatform, eventBus),
 *   eventBus: new ChatEventBus(),
 * };
 * ```
 */
export type { AppContext } from "./app-context";

// ---------------------------------------------------------------------------
// Widget — Main Entry Point
// ---------------------------------------------------------------------------

/**
 * `AIChatWidget` — the main React component that renders the complete AI chat UI.
 *
 * It initializes i18n, creates an `AppContext`, sets up all React context providers
 * (Settings, Platform, Stores, Tools, Storage), and renders the chat interface
 * with routing between Chat, Settings, Initial Setup, and Empty Screen pages.
 *
 * @example
 * ```tsx
 * import { AIChatWidget } from "@onlyoffice/ai-chat";
 *
 * function App() {
 *   return (
 *     <AIChatWidget
 *       storage={indexedDbStorage}
 *       settings={localStorageSettings}
 *       platform={desktopPlatform}
 *       locale="en"
 *       theme="dark"
 *       hostToolGroups={[{ id: "editor", name: "Editor", tools: [...] }]}
 *     />
 *   );
 * }
 * ```
 *
 * @see {@link AIChatWidgetProps} for all available configuration options.
 */
export { AIChatWidget, type AIChatWidgetProps } from "./AIChatWidget";

// ---------------------------------------------------------------------------
// Config — Feature Flags & Store Keys
// ---------------------------------------------------------------------------

/**
 * Interface mapping logical setting names to their actual storage key strings.
 * Pass via `AIChatWidget.storeKeys` (required). The host application defines
 * the concrete key values — the library has no built-in defaults.
 *
 * Properties: `defaultProfile`, `chatProfile`, `summarizationProfile`,
 * `translationProfile`, `textAnalysisProfile`, `imageGenerationProfile`,
 * `ocrProfile`, `visionProfile`, `deepMode`, `mcpServers`, `disabledTools`.
 *
 * @example
 * ```ts
 * const storeKeys: StoreKeys = {
 *   defaultProfile: "default-profile",
 *   chatProfile: "chat-profile",
 *   summarizationProfile: "summarization-profile",
 *   translationProfile: "translation-profile",
 *   textAnalysisProfile: "text-analysis-profile",
 *   imageGenerationProfile: "image-generation-profile",
 *   ocrProfile: "ocr-profile",
 *   visionProfile: "vision-profile",
 *   deepMode: "deep-mode",
 *   mcpServers: "mcpServers",
 *   disabledTools: "disabledTools",
 * };
 * ```
 */
export type { StoreKeys } from "./config";

// ---------------------------------------------------------------------------
// Platform — Host Application Integration
// ---------------------------------------------------------------------------

/**
 * `PlatformProvider` — React context provider that makes the `PlatformAdapter`
 * available to all child components via `usePlatform()`.
 * Set up automatically by `AIChatWidget`; only use directly in custom layouts.
 *
 * `usePlatform()` — Hook to access the `PlatformAdapter` from any component.
 * Throws if used outside of `PlatformProvider`.
 *
 * @example
 * ```tsx
 * const platform = usePlatform();
 * const files = await platform.file?.pickFiles();
 * ```
 */
export { PlatformProvider, usePlatform } from "./platform/context";

/**
 * Platform abstraction interfaces. Implement these to integrate AI Chat
 * with your host application.
 *
 * - **`PlatformAdapter`** — Top-level adapter combining all platform capabilities.
 *   Pass to `AIChatWidget` via the `platform` prop.
 *
 * - **`PlatformEnvironment`** — Read-only environment info: `theme`, `systemTheme`,
 *   `locale`, `devicePixelRatio`, and optional `onEnvironmentChange` listener.
 *
 * - **`PlatformFileOperations`** — File dialogs: `pickFiles()`, `pickImage()`,
 *   `convertFileToText()`, `saveAsFile()`, `openFile()`, etc. Set to `null`
 *   in `PlatformAdapter.file` to disable file features.
 *
 * - **`PlatformHostTools`** — Built-in tools from the host: `getTools()`, `callTool()`.
 *   Set to `null` to disable host tools.
 *
 * - **`PlatformProcessRunner`** — Spawn external processes for MCP STDIO servers:
 *   `createProcess()`, `isAvailable()`. Set to `null` for HTTP-only MCP.
 *
 * - **`PlatformClouds`** — Cloud account integration: `getClouds()`, `getCloudKeys()`.
 *   Set to `null` to disable cloud features.
 *
 * @example
 * ```ts
 * const platform: PlatformAdapter = {
 *   file: myFileOps,         // or null
 *   process: myProcessRunner, // or null
 *   env: { theme: "dark", systemTheme: "dark", locale: "en", devicePixelRatio: 2 },
 *   hostTools: null,
 *   clouds: null,
 * };
 * ```
 */
export type {
  PlatformAdapter,
  PlatformEnvironment,
  PlatformFileOperations,
  PlatformHostTools,
  PlatformProcessRunner,
  PlatformClouds,
} from "./platform/types";

// ---------------------------------------------------------------------------
// Providers — AI Model Providers
// ---------------------------------------------------------------------------

/**
 * `Provider` — The main provider manager class. Manages the active AI provider
 * instance, handles provider switching, and routes messages to the current provider.
 *
 * Key methods: `setCurrentProvider()`, `setCurrentProviderModel()`,
 * `sendMessage()`, `stopMessage()`, `getProvidersModels()`, `createChatName()`.
 *
 * Created internally by `AIChatWidget`. Export is for advanced/custom usage.
 *
 * `SendMessageReturnType` — Async generator type yielding `ThreadMessageLike`
 * chunks during streaming, ending with `{ isEnd: true, responseMessage }`.
 */
export { default as Provider, type SendMessageReturnType } from "./providers";

/**
 * `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>` — Abstract base class for all
 * AI provider implementations. Extend this to create a custom provider.
 *
 * Generic parameters:
 * - `TOOL` — Provider-specific tool format (e.g. Anthropic's `ToolUnion`)
 * - `MESSAGE` — Provider-specific message format (e.g. `MessageParam`)
 * - `CLIENT` — Provider SDK client type (e.g. `Anthropic`, `OpenAI`)
 *
 * Required overrides: `setProvider()`, `setPrevMessages()`, `setTools()`,
 * `createChatName()`, `sendMessage()`, `sendMessageAfterToolCall()`,
 * `getName()`, `getBaseUrl()`, `checkProvider()`, `getProviderModels()`.
 *
 * Optional overrides: `imageGeneration()`, `imageVision()`, `imageOCR()`.
 *
 * @example
 * ```ts
 * class MyProvider extends AbstractBaseProvider<MyTool, MyMessage, MyClient> {
 *   getName() { return "My Custom Provider"; }
 *   getBaseUrl() { return "https://api.myprovider.com"; }
 *   // ... implement abstract methods
 * }
 * ```
 */
export { AbstractBaseProvider } from "./providers/base";

/**
 * Union type of all built-in provider classes and any custom
 * `AbstractBaseProvider<any, any, any>` — the common type for provider instances.
 */
export type { BaseProvider } from "./providers/registry";

/**
 * Provider registry functions for looking up, creating, and managing AI providers.
 *
 * - **`getProvider(type)`** — Look up a provider by type string (built-in first,
 *   then custom). Returns `undefined` if not found.
 *
 * - **`createProvider(type)`** — Create a **new** (non-singleton) provider instance.
 *   Use for action-specific providers that shouldn't share state with the main one
 *   (e.g. a dedicated summarization provider).
 *
 * - **`registerProvider(type, provider)`** — Register a custom provider at runtime.
 *   Makes it available via `getProvider()` and in the provider selection UI.
 *
 * - **`unregisterProvider(type)`** — Remove a previously registered custom provider.
 *
 * - **`isValidProviderType(type)`** — Check if a type string maps to a known
 *   provider (built-in or custom). Returns `boolean`.
 *
 * - **`getSupportedProviderTypes()`** — Get all available provider type strings
 *   (built-in + custom). Use to populate a provider selector.
 *
 * @example
 * ```ts
 * import { registerProvider, getProvider, getSupportedProviderTypes } from "@onlyoffice/ai-chat";
 *
 * registerProvider("my-custom", new MyCustomProvider());
 * getSupportedProviderTypes(); // [...builtins, "my-custom"]
 * const provider = getProvider("my-custom");
 * ```
 */
export {
  createProvider,
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
  registerProvider,
  unregisterProvider,
} from "./providers/registry";

// ---------------------------------------------------------------------------
// Services — Business Logic Layer
// ---------------------------------------------------------------------------

/**
 * Service-layer types used by `ChatEngine`, `ProfilesService`, `ServersService`, etc.
 *
 * - **`ChatEvent`** — Discriminated union streamed from `ChatEngine`:
 *   `"message-start"`, `"message-delta"`, `"message-end"`,
 *   `"message-incomplete"`, `"tool-call-pending"`, `"thread-title"`.
 *
 * - **`ToolCallData`** — Identifies a pending tool call: `{ message, idx, messageUID }`.
 *   Used to approve or deny a specific tool invocation.
 *
 * - **`ProfilesInitResult`** — Return type of profile initialization:
 *   `{ profiles, defaultProfile, taskProfiles }`.
 *
 * - **`TaskProfileKeys`** — Maps storage key names for default and per-task profiles:
 *   `{ defaultKey, taskKeys }`.
 *
 * - **`PromptUpdates`** — Partial update payload for prompts: `{ name?, text?, folderId? }`.
 *
 * - **`ToolsListResult`** — Result of building the tools list:
 *   `{ tools, servers, disabledTools, webSearchEnabled }`.
 *
 * - **`ChangeToolStatusResult`** — Same as `ToolsListResult` or `null` if invalid.
 */
export type {
  ChangeToolStatusResult,
  ChatEvent,
  ProfilesInitResult,
  PromptUpdates,
  TaskProfileKeys,
  ToolCallData,
  ToolsListResult,
} from "./services";

/**
 * Core services that implement the business logic of the chat system.
 * Created internally by `createStores()`; exported for advanced/custom usage.
 *
 * - **`ChatEngine`** — Orchestrates message flow: sending messages, streaming
 *   responses, handling tool calls, generating titles.
 *   Methods: `sendMessage()`, `approveToolCall()`, `denyToolCall()`, `stop()`.
 *   Each returns an `AsyncGenerator<ChatEvent>`.
 *
 * - **`ProfilesService`** — CRUD for AI provider profiles, default selection,
 *   per-task model assignments.
 *   Methods: `init()`, `addProfile()`, `editProfile()`, `deleteProfile()`,
 *   `setTaskProfile()`, `selectCurrentChatProfile()`.
 *
 * - **`PromptsService`** — CRUD for saved prompts and prompt folders.
 *   Methods: `loadAll()`, `createPrompt()`, `updatePrompt()`, `deletePrompt()`,
 *   `createFolder()`, `renameFolder()`, `deleteFolder()`.
 *
 * - **`ServersService`** — Manages MCP servers and tool availability (respects
 *   `MAX_TOOL_COUNT` limits).
 *   Methods: `initServers()`, `buildToolsList()`, `changeToolStatus()`.
 *
 * - **`ThreadsService`** — Chat thread lifecycle: CRUD, migration, export.
 *   Methods: `loadAll()`, `createThread()`, `renameThread()`, `deleteThread()`,
 *   `downloadThread()`, `clearHistory()`.
 *
 * - **`applyProfileToAction(actionType, taskProfile, defaultProfile)`** — Assigns
 *   a provider profile to a specialized action type (e.g. Summarization, Translation).
 *
 * - **`getActionProvider(actionType)`** — Gets the provider configured for a
 *   specific action type. Returns `BaseProvider | undefined`.
 *
 * - **`initActionHolders()`** — Initializes action holder instances for all action
 *   types. Call once at startup before executing any actions.
 */
export {
  applyProfileToAction,
  ChatEngine,
  getActionProvider,
  initActionHolders,
  ProfilesService,
  PromptsService,
  ServersService,
  ThreadsService,
} from "./services";

// ---------------------------------------------------------------------------
// Settings — Pluggable Key-Value Settings
// ---------------------------------------------------------------------------

/**
 * `SettingsProvider` — React context provider that makes `SettingsAdapter`
 * available to all child components. Set up automatically by `AIChatWidget`.
 *
 * `useSettings()` — Hook to access the `SettingsAdapter` from any component.
 * Use to read/write persistent user preferences. Throws if used outside `SettingsProvider`.
 *
 * @example
 * ```ts
 * const settings = useSettings();
 * const apiKey = settings.get("openai-api-key");
 * settings.set("openai-api-key", "sk-...");
 * ```
 */
export { SettingsProvider, useSettings } from "./settings/context";

/**
 * Global settings instance accessors for use **outside React components**
 * (e.g. in Zustand stores or service classes).
 *
 * - `setSettingsInstance(settings)` — Called once during widget initialization.
 * - `getSettingsInstance()` — Returns the current `SettingsAdapter`.
 *
 * Prefer `useSettings()` hook inside React components.
 */
export {
  getSettingsInstance,
  setSettingsInstance,
} from "./settings/settings-holder";

/**
 * Interface for a pluggable key-value settings backend.
 * Implement this to provide persistence (e.g. `localStorage`, `AsyncStorage`,
 * or a remote config service).
 *
 * Methods: `get(key)`, `set(key, value)`, `remove(key)`.
 *
 * @example
 * ```ts
 * const settings: SettingsAdapter = {
 *   get: (key) => localStorage.getItem(key),
 *   set: (key, value) => localStorage.setItem(key, value),
 *   remove: (key) => localStorage.removeItem(key),
 * };
 * ```
 */
export type { SettingsAdapter } from "./settings/types";

// ---------------------------------------------------------------------------
// Storage — Pluggable Persistence Layer
// ---------------------------------------------------------------------------

/**
 * `StorageProvider` — React context provider that initializes storage
 * (waits for `storage.init()`) and provides it via context.
 * Renders `null` until storage is ready. Calls `storage.close()` on unmount.
 *
 * `useStorage()` — Hook to access the `StorageAdapter` from any component.
 * Throws if used outside `StorageProvider`.
 */
export { StorageProvider, useStorage } from "./storage/context";

/**
 * Global storage instance accessors for use **outside React components**
 * (e.g. in Zustand stores or service classes).
 *
 * - `setStorageInstance(storage)` — Called once during widget initialization.
 * - `getStorageInstance()` — Returns the current `StorageAdapter`.
 *
 * Prefer `useStorage()` hook inside React components.
 */
export {
  getStorageInstance,
  setStorageInstance,
} from "./storage/storage-holder";

/**
 * Storage abstraction interfaces. Implement `StorageAdapter` to provide
 * a custom persistence backend (IndexedDB, SQLite, REST API, etc.).
 *
 * `StorageAdapter` bundles five sub-storages + lifecycle methods:
 *
 * - **`threads: ThreadsStorage`** — Chat session metadata (CRUD, touch, delete).
 * - **`messages: MessagesStorage`** — Chat messages with full-text search,
 *   per-thread queries, and bulk replace.
 * - **`profiles: ProfilesStorage`** — AI provider profiles (CRUD, batch create).
 * - **`prompts: PromptsStorage`** — Saved prompt templates (CRUD, folder-based delete).
 * - **`promptFolders: PromptFoldersStorage`** — Prompt folder organization.
 * - **`init(): Promise<void>`** — Initialize the backend (create DB/tables, run migrations).
 * - **`close(): Promise<void>`** — Close the connection on unmount.
 *
 * @example
 * ```ts
 * const storage: StorageAdapter = {
 *   threads: new IndexedDBThreads(),
 *   messages: new IndexedDBMessages(),
 *   profiles: new IndexedDBProfiles(),
 *   prompts: new IndexedDBPrompts(),
 *   promptFolders: new IndexedDBFolders(),
 *   init: () => openDB("ChatHistory", 1),
 *   close: () => db.close(),
 * };
 * ```
 */
export type {
  MessagesStorage,
  ProfilesStorage,
  PromptFoldersStorage,
  PromptsStorage,
  StorageAdapter,
  ThreadsStorage,
} from "./storage/types";

// ---------------------------------------------------------------------------
// Store — Zustand State Management
// ---------------------------------------------------------------------------

/**
 * State types for each Zustand store. Use these for typing selectors,
 * middleware, or custom store extensions.
 *
 * - **`MessageStoreState`** — Messages, streaming state, stop control.
 * - **`ProfilesStoreState`** — Profiles, defaults, task assignments, errors.
 * - **`ThreadsStoreState`** — Thread list and current thread management.
 * - **`ServersStoreState`** — MCP servers and tool management.
 * - **`PromptsStoreState`** — Saved prompts and folders.
 * - **`AttachmentsStoreState`** — File/image attachments in the composer (max 5+5).
 * - **`ThemeStoreState`** — Current UI theme.
 * - **`RouterStoreState`** — Page navigation state.
 * - **`Page`** — Union type of valid page identifiers.
 * - **`Stores`** — Bundle of all store hooks, `ChatEngine`, `Provider`, and selectors.
 * - **`CreateStoresConfig`** — Configuration for `createStores()`:
 *   `{ keys?: Partial<StoreKeys>, ctx: AppContext }`.
 */
export type {
  AttachmentsStoreState,
  CreateStoresConfig,
  MessageStoreState,
  Page,
  ProfilesStoreState,
  PromptsStoreState,
  RouterStoreState,
  ServersStoreState,
  Stores,
  ThemeStoreState,
  ThreadsStoreState,
} from "./store";

/**
 * `createStores(config)` — Factory that creates all Zustand stores, services,
 * and wires them together. Called once during `AIChatWidget` initialization.
 * Accepts `{ keys?: Partial<StoreKeys>, ctx: AppContext }`.
 *
 * `StoresProvider` — React context provider for the `Stores` bundle.
 * Set up automatically by `AIChatWidget`.
 *
 * `useStores()` — Hook to access all stores and services from any component.
 * Returns the full `Stores` object with all store hooks, `chatEngine`, `provider`,
 * and `selectCurrentChatProfile`.
 *
 * @example
 * ```ts
 * const { useMessageStore, useProfilesStore, chatEngine } = useStores();
 * const { messages } = useMessageStore();
 * ```
 */
export { createStores, StoresProvider, useStores } from "./store";

// ---------------------------------------------------------------------------
// Tools — MCP Tool Sources & Host Tools
// ---------------------------------------------------------------------------

/**
 * `ToolsProvider` — React context provider that syncs host tool groups into
 * the server manager and provides tool context to child components.
 * Set up automatically by `AIChatWidget`.
 *
 * `useToolsContext()` — Hook to access `{ hostToolGroups, servers, eventBus }`
 * from any component. Use for tool-related operations.
 */
export { ToolsProvider, useToolsContext } from "./tools/context";

/**
 * Tool system interfaces for integrating host application tools with the AI chat.
 *
 * - **`HostTool`** — A single tool exposed to the AI model:
 *   `name`, `description`, `inputSchema` (JSON Schema), `handler` (async function),
 *   and optional `requireApproval` flag.
 *
 * - **`HostToolGroup`** — A named collection of tools displayed as a section
 *   in the tools list UI. Has `id` (used as name prefix), `name`, and `tools[]`.
 *
 * - **`ToolSource`** — Interface for any tool source (host tools, MCP servers,
 *   web search). Defines `id`, `getTools()`, `callTool()`, and optional `autoAllow`.
 *
 * @example
 * ```ts
 * const editorTools: HostToolGroup = {
 *   id: "editor",
 *   name: "Editor Tools",
 *   tools: [{
 *     name: "insert_text",
 *     description: "Insert text at cursor position",
 *     inputSchema: { type: "object", properties: { text: { type: "string" } } },
 *     handler: async (args) => editor.insertText(args.text),
 *   }],
 * };
 *
 * <AIChatWidget hostToolGroups={[editorTools]} ... />
 * ```
 */
export type { HostTool, HostToolGroup, ToolSource } from "./tools/types";

// ---------------------------------------------------------------------------
// Types — Domain Models
// ---------------------------------------------------------------------------

/**
 * Core domain types used throughout the library.
 *
 * - **`Model`** — AI model metadata: `id`, `name`, `provider` (ProviderType),
 *   optional `reasoning` flag and `capabilities` bitmask.
 *
 * - **`Profile`** — Complete AI provider + model configuration for reuse:
 *   `id`, `name`, `providerType`, `baseUrl`, optional `key`, `modelId`,
 *   optional `reasoning`, `capabilities`, `isCloudProvider`.
 *
 * - **`Prompt`** — Saved prompt template: `id`, `name`, `text`,
 *   optional `folderId`, `createdAt`, `updatedAt`.
 *
 * - **`PromptFolder`** — Folder for organizing prompts: `id`, `name`,
 *   `createdAt`, `updatedAt`.
 *
 * - **`ProviderType`** — Union of 16 built-in provider type strings
 *   (`"anthropic"`, `"openai"`, `"ollama"`, etc.) plus any custom `string`.
 *   Provides autocompletion for built-in types while accepting custom ones.
 *
 * - **`TAttachmentFile`** — File attachment: `path`, `content` (text),
 *   `type` (ONLYOFFICE file type code).
 *
 * - **`TAttachmentImage`** — Image attachment: `name`, `base64` encoded data.
 *
 * - **`Thread`** — Chat session metadata: `threadId`, optional `title`,
 *   `lastEditDate`, `provider`, `model`, `profileId`.
 *
 * - **`TMCPItem`** — Tool descriptor from an MCP server: `name`, `description`,
 *   `inputSchema`, optional `enabled`.
 *
 * - **`TProcess`** — Handle to a spawned external process (for MCP STDIO servers):
 *   `stdin()`, `onprocess()`, `end()`, `start()`.
 *
 * - **`TProvider`** — Minimal provider configuration: `type`, `name`, `baseUrl`,
 *   optional `key`.
 *
 * - **`TCloud`** — Connected cloud account: `portal`, `provider`, `user`, `email`.
 *
 * - **`TCloudProvider`** — Cloud provider configuration: `url`, `label`, `apiKey`.
 */
export type {
  Model,
  Profile,
  Prompt,
  PromptFolder,
  ProviderType,
  TAttachmentFile,
  TAttachmentImage,
  Thread,
  TMCPItem,
  TProcess,
  TProvider,
  TCloud,
  TCloudProvider,
} from "./types";

// ---------------------------------------------------------------------------
// Pages — Standalone Page Components
// ---------------------------------------------------------------------------

/**
 * Pre-built page components that can be used independently from `AIChatWidget`.
 * Each page manages its own state via `useStores()` and requires the full
 * provider stack (Settings, Platform, Stores, Tools, Storage) to be set up.
 *
 * - **`AiModelsPage`** — Configure AI models: add, edit, delete provider profiles.
 * - **`ModelAssignmentPage`** — Assign models to task types (Chat, Summarization,
 *   Translation, Text Analysis, Image Generation, OCR, Vision).
 * - **`McpServersPage`** — Add, configure, and remove MCP servers and their tools.
 * - **`WebSearchPage`** — Enable/disable and configure web search (Exa API).
 * - **`SettingsPage`** — Unified tabbed settings combining all settings pages above.
 * - **`InitialSetupPage`** — Onboarding wizard for first-time users to add their
 *   first AI model.
 * - **`EmptyScreenPage`** — Landing page shown when no profiles or threads exist,
 *   prompting users to get started.
 * - **`ChatPage`** — Main chat interface: message display, composer, streaming
 *   responses, tool call approval, file attachments.
 *
 * @example
 * ```tsx
 * // Use individual pages in a custom layout
 * import { SettingsPage, ChatPage } from "@onlyoffice/ai-chat";
 *
 * function MyApp() {
 *   return currentTab === "settings" ? <SettingsPage /> : <ChatPage />;
 * }
 * ```
 */
export { default as AiModelsPage } from "./pages/ai-models";
export { default as ModelAssignmentPage } from "./pages/model-assignment";
export { default as McpServersPage } from "./pages/mcp-servers";
export { default as WebSearchPage } from "./pages/web-search";
export { default as SettingsPage } from "./pages/settings";
export { default as InitialSetupPage } from "./pages/initial-setup";
export { default as EmptyScreenPage } from "./pages/empty-screen";
export { default as ChatPage } from "./pages/chat";
