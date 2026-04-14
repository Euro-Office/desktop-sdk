import type { StoreApi, UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";
import { DEFAULT_STORE_KEYS, type StoreKeys } from "../config";
import type Provider from "../providers";
import { ChatEngine } from "../services/chat-engine";
import { ProfilesService } from "../services/profiles";
import { PromptsService } from "../services/prompts";
import { ServersService } from "../services/servers";
import { ThreadsService } from "../services/threads";
import {
  type AttachmentsStoreState,
  createAttachmentsStore,
} from "./create-attachments-store";
import {
  type CloudsStoreState,
  createCloudsStore,
} from "./create-clouds-store.ts";
import {
  createMessageStore,
  type MessageStoreState,
} from "./create-message-store";
import {
  createProfilesStore,
  type ProfilesStoreState,
} from "./create-profiles-store";
import {
  createPromptsStore,
  type PromptsStoreState,
} from "./create-prompts-store";
import {
  createRouterStore,
  type RouterStoreState,
} from "./create-router-store";
import {
  createServersStore,
  type ServersStoreState,
} from "./create-servers-store";
import { createThemeStore, type ThemeStoreState } from "./create-theme-store";
import {
  createThreadsStore,
  type ThreadsStoreState,
} from "./create-threads-store";

// Re-export all state types for backwards compatibility
export type { AttachmentsStoreState } from "./create-attachments-store";
export type { CloudsStoreState } from "./create-clouds-store";
export type { MessageStoreState } from "./create-message-store";
export type { ProfilesStoreState } from "./create-profiles-store";
export type { PromptsStoreState } from "./create-prompts-store";
export type { Page, RouterStoreState } from "./create-router-store";
export type { ServersStoreState } from "./create-servers-store";
export type { ThemeStoreState } from "./create-theme-store";
export type { ThreadsStoreState } from "./create-threads-store";

// ---------------------------------------------------------------------------
// Stores bundle type
// ---------------------------------------------------------------------------

export interface Stores {
  useMessageStore: UseBoundStore<StoreApi<MessageStoreState>>;
  useProfilesStore: UseBoundStore<StoreApi<ProfilesStoreState>>;
  useThreadsStore: UseBoundStore<StoreApi<ThreadsStoreState>>;
  useServersStore: UseBoundStore<StoreApi<ServersStoreState>>;
  usePromptsStore: UseBoundStore<StoreApi<PromptsStoreState>>;
  useAttachmentsStore: UseBoundStore<StoreApi<AttachmentsStoreState>>;
  useThemeStore: UseBoundStore<StoreApi<ThemeStoreState>>;
  useRouter: UseBoundStore<StoreApi<RouterStoreState>>;
  chatEngine: ChatEngine;
  provider: Provider;
  selectCurrentChatProfile: (s: ProfilesStoreState) => Profile | null;
  useCloudsStore: UseBoundStore<StoreApi<CloudsStoreState>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateStoresConfig {
  keys?: Partial<StoreKeys>;
  ctx: AppContext;
}

import type { Profile } from "../types";

export function createStores(config: CreateStoresConfig): Stores {
  const keys: StoreKeys = { ...DEFAULT_STORE_KEYS, ...config.keys };
  const { ctx } = config;

  // Services (scoped to this store instance)
  const profilesService = new ProfilesService(ctx);
  const threadsService = new ThreadsService(ctx);
  const serversService = new ServersService(
    keys.mcpServers,
    keys.disabledTools,
    ctx
  );
  const promptsService = new PromptsService(ctx);
  const chatEngine = new ChatEngine(ctx);

  // Create stores, passing dependencies
  const useMessageStore = createMessageStore(ctx);
  const useProfilesStore = createProfilesStore({
    keys,
    profilesService,
    ctx,
  });
  const useThreadsStore = createThreadsStore({
    threadsService,
    useProfilesStore,
    useMessageStore,
  });
  const useServersStore = createServersStore({ serversService });
  const usePromptsStore = createPromptsStore({ promptsService });
  const useAttachmentsStore = createAttachmentsStore();
  const useThemeStore = createThemeStore(ctx);
  const useRouter = createRouterStore();
  const useCloudsStore = createCloudsStore(ctx);

  // Selector
  const selectCurrentChatProfile = (s: ProfilesStoreState) =>
    s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

  return {
    useMessageStore,
    useProfilesStore,
    useThreadsStore,
    useServersStore,
    usePromptsStore,
    useAttachmentsStore,
    useThemeStore,
    useRouter,
    useCloudsStore,
    chatEngine,
    provider: ctx.provider,
    selectCurrentChatProfile,
  };
}
