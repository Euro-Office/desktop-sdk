// --- Types ---
export type {
  TMCPItem,
  Thread,
  ProviderType,
  Model,
  TProvider,
  PromptFolder,
  Prompt,
  TAttachmentFile,
  TAttachmentImage,
  TProcess,
  Profile,
} from "./types";

// --- Storage ---
export type {
  StorageAdapter,
  ThreadsStorage,
  MessagesStorage,
  ProfilesStorage,
  PromptsStorage,
  PromptFoldersStorage,
} from "./storage/types";

export { StorageProvider, useStorage } from "./storage/context";
export { getStorageInstance, setStorageInstance } from "./storage/storage-holder";

// --- Platform ---
export type {
  PlatformAdapter,
  PlatformFileOperations,
  PlatformProcessRunner,
  PlatformEnvironment,
  PlatformHostTools,
} from "./platform/types";

export { PlatformProvider, usePlatform } from "./platform/context";

// --- Tools ---
export type { HostTool, HostToolGroup, ToolSource } from "./tools/types";

export { ToolsProvider, useToolsContext } from "./tools/context";

// --- Settings ---
export type { SettingsAdapter } from "./settings/types";

export { SettingsProvider, useSettings } from "./settings/context";
export {
  getSettingsInstance,
  setSettingsInstance,
} from "./settings/settings-holder";

// --- Utils ---
export {
  convertMessagesToMd,
  getMessageTitleFromMd,
  removeSpecialCharacter,
} from "./utils";

// --- Providers ---
export { AbstractBaseProvider } from "./providers/base";
export type { BaseProvider } from "./providers/registry";
export {
  registerProvider,
  unregisterProvider,
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
} from "./providers/registry";
export { provider, type SendMessageReturnType } from "./providers";
