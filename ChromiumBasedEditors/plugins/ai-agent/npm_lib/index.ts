// --- Capabilities ---

// --- Widget ---
export { AIChatWidget, type AIChatWidgetProps } from "./AIChatWidget";
export type { Capabilities } from "./capabilities";
export { ActionType, CapabilitiesUI } from "./capabilities";
// --- Config ---
export type { FeatureFlags, StoreKeys } from "./config";
export {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_STORE_KEYS,
  MAX_TOOL_COUNT,
  MAX_TOOL_COUNT_WITH_WEB_SEARCH,
} from "./config";
// --- Events ---
export { chatEvents } from "./events";
// --- Hooks ---
export {
  useDebouncedCallback,
  useDirection,
  useMessages,
  useProfiles,
  useServers,
  useThread,
} from "./hooks";
export type { InitAIChatI18nOptions } from "./i18n";
// --- i18n ---
export { bundledLocaleKeys, initAIChatI18n } from "./i18n";
export { getApiKeyLink } from "./lib/api-key-links";
export { type DebouncedFn, debounce } from "./lib/debounce";
export type { ImageCollections } from "./lib/images";
export { getImageSrc, getProviderImageSrc } from "./lib/images";
// --- Lib ---
export { cn, sanitizeProviderName } from "./lib/utils";
export { PlatformProvider, usePlatform } from "./platform/context";
// --- Platform ---
export type {
  PlatformAdapter,
  PlatformEnvironment,
  PlatformFileOperations,
  PlatformHostTools,
  PlatformProcessRunner,
  PlatformClouds,
} from "./platform/types";
export { default as Provider, type SendMessageReturnType } from "./providers";
// --- Providers ---
export { AbstractBaseProvider } from "./providers/base";
export type { BaseProvider } from "./providers/registry";
export {
  createProvider,
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
  registerProvider,
  unregisterProvider,
} from "./providers/registry";
export type {
  ChangeToolStatusResult,
  ChatEvent,
  ProfilesInitResult,
  PromptUpdates,
  TaskProfileKeys,
  ToolCallData,
  ToolsListResult,
} from "./services";
// --- Services ---
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
export { SettingsProvider, useSettings } from "./settings/context";
export {
  getSettingsInstance,
  setSettingsInstance,
} from "./settings/settings-holder";
// --- Settings ---
export type { SettingsAdapter } from "./settings/types";
export { StorageProvider, useStorage } from "./storage/context";
export {
  getStorageInstance,
  setStorageInstance,
} from "./storage/storage-holder";
// --- Storage ---
export type {
  MessagesStorage,
  ProfilesStorage,
  PromptFoldersStorage,
  PromptsStorage,
  StorageAdapter,
  ThreadsStorage,
} from "./storage/types";
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
// --- Store ---
export { createStores, StoresProvider, useStores } from "./store";
export { ToolsProvider, useToolsContext } from "./tools/context";
// --- Tools ---
export { getClientInfo, setClientInfo } from "./tools/sources/CustomServers";
export type { HostTool, HostToolGroup, ToolSource } from "./tools/types";
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
// --- Utils ---
export {
  convertMessagesToMd,
  getMessageTitleFromMd,
  removeSpecialCharacter,
} from "./utils";
