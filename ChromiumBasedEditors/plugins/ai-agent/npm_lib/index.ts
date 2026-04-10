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

export { ToolsProvider, useHostTools } from "./tools/context";
