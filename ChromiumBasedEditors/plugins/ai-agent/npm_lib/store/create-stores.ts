import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { DEFAULT_STORE_KEYS, type StoreKeys } from "../config";
import { getPlatformInstance } from "../platform/platform-holder";
import type { TErrorData } from "../providers/base";
import { getProviderInstance } from "../providers/provider-holder";
import { ChatEngine } from "../services/chat-engine";
import { ProfilesService } from "../services/profiles";
import { PromptsService } from "../services/prompts";
import { ServersService } from "../services/servers";
import { ThreadsService } from "../services/threads";
import { getSettingsInstance } from "../settings/settings-holder";
import { getStorageInstance } from "../storage/storage-holder";
import type {
  Profile,
  Prompt,
  PromptFolder,
  TAttachmentFile,
  TAttachmentImage,
  Thread,
  TMCPItem,
} from "../types";

// ---------------------------------------------------------------------------
// Store state types
// ---------------------------------------------------------------------------

export type Page = "chat" | "settings" | "initial-setup" | "history";

export interface MessageStoreState {
  messages: ThreadMessageLike[];
  isStreamRunning: boolean;
  isRequestRunning: boolean;
  setIsStreamRunning: (value: boolean) => void;
  setIsRequestRunning: (value: boolean) => void;
  addMessage: (message: ThreadMessageLike) => void;
  updateLastMessage: (message: ThreadMessageLike) => void;
  fetchPrevMessages: (threadId: string) => Promise<void>;
  stopMessage: () => void;
  clearMessages: () => void;
}

export interface ProfilesStoreState {
  profiles: Profile[];
  defaultProfile: Profile | null;
  chatProfile: Profile | null;
  summarizationProfile: Profile | null;
  translationProfile: Profile | null;
  textAnalysisProfile: Profile | null;
  imageGenerationProfile: Profile | null;
  ocrProfile: Profile | null;
  visionProfile: Profile | null;
  sessionChatProfile: Profile | null;
  extendedThinking: boolean;
  init: () => Promise<void>;
  addProfile: (
    data: Omit<Profile, "id">
  ) => Promise<boolean | TErrorData | undefined>;
  editProfile: (profile: Profile) => Promise<boolean | TErrorData | undefined>;
  deleteProfile: (id: string) => Promise<void>;
  getProfileById: (id: string) => Profile | null;
  getProfileByName: (name: string, ignoreCase?: boolean) => Profile | null;
  setDefaultProfile: (profile: Profile) => void;
  setChatProfile: (profile: Profile | null) => void;
  setSummarizationProfile: (profile: Profile | null) => void;
  setTranslationProfile: (profile: Profile | null) => void;
  setTextAnalysisProfile: (profile: Profile | null) => void;
  setImageGenerationProfile: (profile: Profile | null) => void;
  setOcrProfile: (profile: Profile | null) => void;
  setVisionProfile: (profile: Profile | null) => void;
  setSessionChatProfile: (profile: Profile | null) => void;
  toggleExtendedThinking: () => void;
}

export interface ThreadsStoreState {
  threadId: string;
  threads: Thread[];
  initThreads: () => Promise<void>;
  insertThread: (title: string, opts?: { profileId?: string }) => void;
  insertNewMessageToThread: (opts?: { profileId?: string }) => void;
  migrateThreadFromProviderModelToProfile: (thread: Thread) => Thread;
  onSwitchToNewThread: () => void;
  onSwitchToThread: (id: string) => void;
  onDownloadThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onClearThreadHistory: (id: string) => void;
}

export interface ServersStoreState {
  servers: Record<string, TMCPItem[]>;
  tools: TMCPItem[];
  disabledTools: Record<string, string[]>;
  manageToolData?: {
    message: ThreadMessageLike;
    idx: number;
    messageUID: string;
  };
  webSearchEnabled: boolean;
  initServers: () => void;
  getTools: () => Promise<void>;
  changeToolStatus: (type: string, name: string, enabled: boolean) => void;
  callTools: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  checkAllowAlways: (type: string, name: string) => boolean;
  setAllowAlways: (value: boolean, type: string, name: string) => void;
  setManageToolData: (data: ServersStoreState["manageToolData"]) => void;
  saveConfig: (config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => void;
  getConfig: () => Record<string, Record<string, unknown>>;
  deleteCustomServer: (name: string) => void;
  getCustomServersLogs: () => Record<string, string[]>;
  getWebSearchEnabled: () => boolean;
}

export interface PromptsStoreState {
  prompts: Prompt[];
  folders: PromptFolder[];
  initPrompts: () => Promise<void>;
  addPrompt: (text: string, folderId?: string) => void;
  editPrompt: (
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ) => void;
  removePrompt: (id: string) => void;
  addFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;
}

export interface AttachmentsStoreState {
  attachmentFiles: TAttachmentFile[];
  attachmentImages: TAttachmentImage[];
  addAttachmentFile: (file: TAttachmentFile) => void;
  deleteAttachmentFile: (path: string) => void;
  clearAttachmentFiles: () => void;
  addAttachmentImage: (image: TAttachmentImage) => void;
  deleteAttachmentImage: (name: string) => void;
  clearAttachmentImages: () => void;
}

type ThemeType = "light" | "dark";

export interface ThemeStoreState {
  themeId: string;
  themeType: ThemeType;
  scale: number;
  initialized: boolean;
  setThemeId: (id: string) => void;
  setScale: (scale: number) => void;
  initFromPlatform: () => void;
}

export interface RouterStoreState {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  goToChat: () => void;
  goToSettings: () => void;
  goToInitialSetup: () => void;
}

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
  selectCurrentChatProfile: (s: ProfilesStoreState) => Profile | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DARK_THEMES = [
  "theme-dark",
  "theme-night",
  "theme-contrast-dark",
] as const;

const getThemeType = (themeId: string): ThemeType =>
  DARK_THEMES.some((dark) => themeId.includes(dark.replace("theme-", "")))
    ? "dark"
    : "light";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateStoresConfig {
  keys?: Partial<StoreKeys>;
}

export function createStores(config?: CreateStoresConfig): Stores {
  const keys: StoreKeys = { ...DEFAULT_STORE_KEYS, ...config?.keys };

  // Services (scoped to this store instance)
  const profilesService = new ProfilesService();
  const threadsService = new ThreadsService();
  const serversService = new ServersService(
    keys.mcpServers,
    keys.disabledTools
  );
  const promptsService = new PromptsService();
  const chatEngine = new ChatEngine();

  // Task profile key list & field mapping
  const TASK_PROFILE_KEYS = [
    keys.chatProfile,
    keys.summarizationProfile,
    keys.translationProfile,
    keys.textAnalysisProfile,
    keys.imageGenerationProfile,
    keys.ocrProfile,
    keys.visionProfile,
  ] as const;

  const TASK_FIELD_MAP: Record<string, keyof ProfilesStoreState> = {
    [keys.chatProfile]: "chatProfile",
    [keys.summarizationProfile]: "summarizationProfile",
    [keys.translationProfile]: "translationProfile",
    [keys.textAnalysisProfile]: "textAnalysisProfile",
    [keys.imageGenerationProfile]: "imageGenerationProfile",
    [keys.ocrProfile]: "ocrProfile",
    [keys.visionProfile]: "visionProfile",
  };

  // --- Message Store ---
  const useMessageStore = create<MessageStoreState>((set, get) => ({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,

    fetchPrevMessages: async (threadId: string) => {
      const storage = getStorageInstance();
      const messages = await storage.messages.getByThread(threadId);
      set({ messages });
      getProviderInstance().setCurrentProviderPrevMessages(messages);
    },

    setIsStreamRunning: (value) => set({ isStreamRunning: value }),
    setIsRequestRunning: (value) => set({ isRequestRunning: value }),

    addMessage: (message) => {
      const { messages } = get();
      if (
        messages.length &&
        messages[messages.length - 1].status?.type === "incomplete"
      ) {
        set({ messages: [...messages.slice(0, -1), { ...message }] });
        return;
      }
      set({ messages: [...messages, message] });
    },

    updateLastMessage: (message) => {
      const { messages } = get();
      set({ messages: [...messages.slice(0, -1), message] });
    },

    stopMessage: () => {
      get().setIsStreamRunning(false);
      getProviderInstance().stopMessage();
    },

    clearMessages: () => {
      set({ messages: [] });
      getProviderInstance().setCurrentProviderPrevMessages([]);
    },
  }));

  // --- Profiles Store ---
  const useProfilesStore = create<ProfilesStoreState>()((set, get) => ({
    profiles: [],
    defaultProfile: null,
    chatProfile: null,
    summarizationProfile: null,
    translationProfile: null,
    textAnalysisProfile: null,
    imageGenerationProfile: null,
    ocrProfile: null,
    visionProfile: null,
    sessionChatProfile: null,

    extendedThinking: (() => {
      try {
        const saved = getSettingsInstance().get(keys.deepMode);
        if (!saved) return false;
        return JSON.parse(saved);
      } catch {
        return false;
      }
    })(),

    init: async () => {
      const { profiles, defaultProfile, taskProfiles } =
        await profilesService.init({
          defaultKey: keys.defaultProfile,
          taskKeys: [...TASK_PROFILE_KEYS],
        });

      const state: Record<string, unknown> = { profiles, defaultProfile };
      for (const key of TASK_PROFILE_KEYS) {
        state[TASK_FIELD_MAP[key]] = taskProfiles[key] ?? null;
      }
      set(state as Partial<ProfilesStoreState>);

      profilesService.applyCurrentChatProvider(
        null,
        taskProfiles[keys.chatProfile] ?? null,
        defaultProfile
      );
    },

    addProfile: async (data) => {
      const result = await profilesService.addProfile(data, get().profiles);
      if (result.success) {
        const isFirst = get().profiles.length === 0;
        set((state) => ({
          profiles: [result.profile, ...state.profiles],
        }));
        if (isFirst) get().setDefaultProfile(result.profile);
        return true;
      }
      return result.error;
    },

    editProfile: async (profile) => {
      const result = await profilesService.editProfile(profile, get().profiles);
      if (!result.success) return result.error;

      set((state) => {
        const profiles = state.profiles.map((p) =>
          p.id === profile.id ? profile : p
        );
        const updateIfMatch = (p: Profile | null) =>
          p?.id === profile.id ? profile : p;

        const defaultProfile = updateIfMatch(state.defaultProfile);
        const chatProfile = updateIfMatch(state.chatProfile);
        const summarizationProfile = updateIfMatch(state.summarizationProfile);
        const translationProfile = updateIfMatch(state.translationProfile);
        const textAnalysisProfile = updateIfMatch(state.textAnalysisProfile);
        const imageGenerationProfile = updateIfMatch(
          state.imageGenerationProfile
        );
        const ocrProfile = updateIfMatch(state.ocrProfile);
        const visionProfile = updateIfMatch(state.visionProfile);
        const sessionChatProfile = updateIfMatch(state.sessionChatProfile);

        profilesService.applyCurrentChatProvider(
          sessionChatProfile,
          chatProfile,
          defaultProfile
        );

        return {
          profiles,
          defaultProfile,
          chatProfile,
          summarizationProfile,
          translationProfile,
          textAnalysisProfile,
          imageGenerationProfile,
          ocrProfile,
          visionProfile,
          sessionChatProfile,
        };
      });
      return true;
    },

    deleteProfile: async (id) => {
      await profilesService.deleteProfile(id);
      set((state) => {
        const profiles = state.profiles.filter((p) => p.id !== id);

        const chatProfile = profilesService.clearTaskProfileIfMatch(
          state.chatProfile,
          id,
          keys.chatProfile
        );
        const summarizationProfile = profilesService.clearTaskProfileIfMatch(
          state.summarizationProfile,
          id,
          keys.summarizationProfile
        );
        const translationProfile = profilesService.clearTaskProfileIfMatch(
          state.translationProfile,
          id,
          keys.translationProfile
        );
        const textAnalysisProfile = profilesService.clearTaskProfileIfMatch(
          state.textAnalysisProfile,
          id,
          keys.textAnalysisProfile
        );
        const imageGenerationProfile = profilesService.clearTaskProfileIfMatch(
          state.imageGenerationProfile,
          id,
          keys.imageGenerationProfile
        );
        const ocrProfile = profilesService.clearTaskProfileIfMatch(
          state.ocrProfile,
          id,
          keys.ocrProfile
        );
        const visionProfile = profilesService.clearTaskProfileIfMatch(
          state.visionProfile,
          id,
          keys.visionProfile
        );
        const sessionChatProfile =
          state.sessionChatProfile?.id === id ? null : state.sessionChatProfile;

        const defaultProfile = profilesService.reassignDefault(
          profiles,
          id,
          state.defaultProfile,
          keys.defaultProfile
        );

        profilesService.applyCurrentChatProvider(
          sessionChatProfile,
          chatProfile,
          defaultProfile
        );

        return {
          profiles,
          defaultProfile,
          chatProfile,
          summarizationProfile,
          translationProfile,
          textAnalysisProfile,
          imageGenerationProfile,
          ocrProfile,
          visionProfile,
          sessionChatProfile,
        };
      });
    },

    getProfileById: (id) => get().profiles.find((p) => p.id === id) ?? null,

    getProfileByName: (name, ignoreCase) =>
      get().profiles.find((p) =>
        ignoreCase
          ? p.name.toLowerCase() === name.toLowerCase()
          : p.name === name
      ) ?? null,

    setDefaultProfile: (profile) => {
      profilesService.setTaskProfile(keys.defaultProfile, profile);
      set((state) => {
        profilesService.applyCurrentChatProvider(
          state.sessionChatProfile,
          state.chatProfile,
          profile
        );
        return { defaultProfile: profile };
      });
    },

    setChatProfile: (profile) => {
      profilesService.setTaskProfile(keys.chatProfile, profile);
      set((state) => {
        profilesService.applyCurrentChatProvider(
          state.sessionChatProfile,
          profile,
          state.defaultProfile
        );
        return { chatProfile: profile };
      });
    },

    setSummarizationProfile: (profile) => {
      profilesService.setTaskProfile(keys.summarizationProfile, profile);
      set({ summarizationProfile: profile });
    },

    setTranslationProfile: (profile) => {
      profilesService.setTaskProfile(keys.translationProfile, profile);
      set({ translationProfile: profile });
    },

    setTextAnalysisProfile: (profile) => {
      profilesService.setTaskProfile(keys.textAnalysisProfile, profile);
      set({ textAnalysisProfile: profile });
    },

    setImageGenerationProfile: (profile) => {
      profilesService.setTaskProfile(keys.imageGenerationProfile, profile);
      set({ imageGenerationProfile: profile });
    },

    setOcrProfile: (profile) => {
      profilesService.setTaskProfile(keys.ocrProfile, profile);
      set({ ocrProfile: profile });
    },

    setVisionProfile: (profile) => {
      profilesService.setTaskProfile(keys.visionProfile, profile);
      set({ visionProfile: profile });
    },

    setSessionChatProfile: (profile) => {
      set((state) => {
        profilesService.applyCurrentChatProvider(
          profile,
          state.chatProfile,
          state.defaultProfile
        );
        return { sessionChatProfile: profile };
      });
    },

    toggleExtendedThinking: () => {
      set((state) => {
        const next = !state.extendedThinking;
        getSettingsInstance().set(keys.deepMode, JSON.stringify(next));
        return { extendedThinking: next };
      });
    },
  }));

  // Selector
  const selectCurrentChatProfile = (s: ProfilesStoreState) =>
    s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

  // --- Threads Store ---

  const needsMigrationToProfile = (
    thread: Thread | undefined
  ): thread is Thread => !!(thread?.provider || thread?.model);

  const applyThreadContextFromThread = (thread?: Thread) => {
    const { getProfileById, setSessionChatProfile } =
      useProfilesStore.getState();
    const profile = thread?.profileId ? getProfileById(thread.profileId) : null;
    setSessionChatProfile(profile);
  };

  const useThreadsStore = create<ThreadsStoreState>((set, get) => ({
    threadId: crypto.randomUUID(),
    threads: [],

    initThreads: async () => {
      const threads = await threadsService.loadAll();
      set({ threads });
    },

    insertThread: (title, opts) => {
      const { threadId, threads } = get();
      const thread = threadsService.createThread(
        threadId,
        title,
        opts?.profileId
      );
      set({ threads: [thread, ...threads] });
    },

    insertNewMessageToThread: (opts) => {
      const { threadId, threads } = get();
      threadsService.touchThread(threadId, opts);
      set({
        threads: threads.map((thread) => {
          if (thread.threadId === threadId) {
            return {
              ...thread,
              ...(opts && "profileId" in opts
                ? { profileId: opts.profileId }
                : {}),
              lastEditDate: Date.now(),
            };
          }
          return thread;
        }),
      });
    },

    migrateThreadFromProviderModelToProfile: (thread) => {
      const { profiles, chatProfile, defaultProfile } =
        useProfilesStore.getState();
      const migratedThread = threadsService.migrateThreadToProfile(
        thread,
        profiles,
        chatProfile,
        defaultProfile
      );
      set((state) => ({
        threads: state.threads.map((t) =>
          t.threadId === thread.threadId ? migratedThread : t
        ),
      }));
      return migratedThread;
    },

    onSwitchToNewThread: () => {
      applyThreadContextFromThread(undefined);
      set({ threadId: crypto.randomUUID() });
    },

    onSwitchToThread: (id) => {
      const { threads, migrateThreadFromProviderModelToProfile } = get();
      let thread = threads.find((t) => t.threadId === id);
      if (needsMigrationToProfile(thread)) {
        thread = migrateThreadFromProviderModelToProfile(thread);
      }
      applyThreadContextFromThread(thread);
      set({ threadId: id });
    },

    onDownloadThread: async (id) => {
      const thread = get().threads.find((t) => t.threadId === id);
      await threadsService.downloadThread(id, thread?.title);
    },

    onRenameThread: (id, title) => {
      set({
        threads: get().threads.map((thread) => {
          if (thread.threadId === id) return { ...thread, title };
          return thread;
        }),
      });
      threadsService.renameThread(id, title);
    },

    onDeleteThread: (id) => {
      const thisStore = get();
      if (thisStore.threadId === id) {
        thisStore.onSwitchToNewThread();
      }
      set({
        threads: thisStore.threads.filter((t) => t.threadId !== id),
      });
      threadsService.deleteThread(id);
    },

    onClearThreadHistory: async (id) => {
      await threadsService.clearHistory(id);
      if (get().threadId === id) {
        useMessageStore.getState().clearMessages();
      }
    },
  }));

  // --- Servers Store ---
  const useServersStore = create<ServersStoreState>((set, get) => ({
    servers: {},
    tools: [],
    disabledTools: {},
    manageToolData: undefined,
    webSearchEnabled: false,

    initServers: () => {
      serversService.initServers();
    },

    getTools: async () => {
      const result = await serversService.buildToolsList();
      set({
        tools: result.tools,
        servers: result.servers,
        disabledTools: result.disabledTools,
        webSearchEnabled: result.webSearchEnabled,
      });
    },

    changeToolStatus: (type, name, enabled) => {
      const { tools, servers, disabledTools, webSearchEnabled } = get();
      const result = serversService.changeToolStatus(type, name, enabled, {
        tools,
        servers,
        disabledTools,
        webSearchEnabled,
      });
      if (result) {
        set({
          tools: result.tools,
          servers: result.servers,
          disabledTools: result.disabledTools,
          webSearchEnabled: result.webSearchEnabled,
        });
      }
    },

    callTools: async (name, args) => {
      return serversService.callTools(name, args, get().disabledTools);
    },

    checkAllowAlways: (type, name) => {
      return serversService.checkAllowAlways(type, name);
    },

    setAllowAlways: (value, type, name) => {
      serversService.setAllowAlways(value, type, name);
    },

    setManageToolData: (data) => {
      set({ manageToolData: data });
    },

    getConfig: () => serversService.getConfig(),

    saveConfig: (config) => {
      serversService.saveConfig(config);
    },

    deleteCustomServer: (name) => {
      serversService.deleteCustomServer(name);
    },

    getCustomServersLogs: () => serversService.getCustomServersLogs(),

    getWebSearchEnabled: () => serversService.getWebSearchEnabled(),
  }));

  // --- Prompts Store ---
  const usePromptsStore = create<PromptsStoreState>((set, get) => ({
    prompts: [],
    folders: [],

    initPrompts: async () => {
      const { prompts, folders } = await promptsService.loadAll();
      set({ prompts, folders });
    },

    addPrompt: (text, folderId) => {
      const prompt = promptsService.createPrompt(text, folderId);
      set({ prompts: [prompt, ...get().prompts] });
    },

    editPrompt: (id, updates) => {
      const prompts = promptsService.updatePrompt(get().prompts, id, updates);
      set({ prompts });
    },

    removePrompt: (id) => {
      set({ prompts: get().prompts.filter((p) => p.id !== id) });
      promptsService.deletePrompt(id);
    },

    addFolder: (name) => {
      const folder = promptsService.createFolder(name);
      set({ folders: [folder, ...get().folders] });
      return folder.id;
    },

    renameFolder: (id, name) => {
      const folders = promptsService.renameFolder(get().folders, id, name);
      set({ folders });
    },

    removeFolder: (id) => {
      set({
        folders: get().folders.filter((f) => f.id !== id),
        prompts: get().prompts.filter((p) => p.folderId !== id),
      });
      promptsService.deleteFolder(id);
    },
  }));

  // --- Attachments Store ---
  const useAttachmentsStore = create<AttachmentsStoreState>((set, get) => ({
    attachmentFiles: [],
    attachmentImages: [],

    addAttachmentFile: (file) => {
      if (get().attachmentFiles.length >= 5) return;
      set({
        attachmentFiles: [...get().attachmentFiles, file],
      });
    },

    deleteAttachmentFile: (path) => {
      set({
        attachmentFiles: get().attachmentFiles.filter((f) => f.path !== path),
      });
    },

    clearAttachmentFiles: () => set({ attachmentFiles: [] }),

    addAttachmentImage: (image) => {
      if (get().attachmentImages.length >= 5) return;
      set({
        attachmentImages: [...get().attachmentImages, image],
      });
    },

    deleteAttachmentImage: (name) => {
      set({
        attachmentImages: get().attachmentImages.filter((i) => i.name !== name),
      });
    },

    clearAttachmentImages: () => set({ attachmentImages: [] }),
  }));

  // --- Theme Store ---
  const useThemeStore = create<ThemeStoreState>((set, get) => ({
    themeId: "theme-light",
    themeType: "light",
    scale: 1,
    initialized: false,

    setThemeId: (id) => set({ themeId: id, themeType: getThemeType(id) }),

    setScale: (scale) => set({ scale }),

    initFromPlatform: () => {
      if (get().initialized) return;
      const platform = getPlatformInstance();
      if (!platform) return;
      const themeId = platform.env.theme;
      set({
        themeId,
        themeType: getThemeType(themeId),
        scale: platform.env.devicePixelRatio,
        initialized: true,
      });
    },
  }));

  // --- Router Store ---
  const useRouter = create<RouterStoreState>((set) => ({
    currentPage: "chat",
    setCurrentPage: (page) => set({ currentPage: page }),
    goToChat: () => set({ currentPage: "chat" }),
    goToSettings: () => set({ currentPage: "settings" }),
    goToInitialSetup: () => set({ currentPage: "initial-setup" }),
  }));

  return {
    useMessageStore,
    useProfilesStore,
    useThreadsStore,
    useServersStore,
    usePromptsStore,
    useAttachmentsStore,
    useThemeStore,
    useRouter,
    chatEngine,
    selectCurrentChatProfile,
  };
}
