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
  TCloud,
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
  PlatformClouds,
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

// --- Services ---
export {
  PromptsService,
  ThreadsService,
  ProfilesService,
  ServersService,
  ChatEngine,
} from "./services";
export type {
  PromptUpdates,
  TaskProfileKeys,
  ProfilesInitResult,
  ToolsListResult,
  ChangeToolStatusResult,
  ChatEvent,
  ToolCallData,
} from "./services";

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
export { default as Provider, type SendMessageReturnType } from "./providers";
