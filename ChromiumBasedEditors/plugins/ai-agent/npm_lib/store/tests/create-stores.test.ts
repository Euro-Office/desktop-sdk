import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STORE_KEYS } from "../../config";

// ---------------------------------------------------------------------------
// Mocks — hoisted before module evaluation
// ---------------------------------------------------------------------------

const { localStorageMap } = vi.hoisted(() => {
  const map = new Map<string, string>();
  return { localStorageMap: map };
});

const mockStorage = {
  profiles: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  threads: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  messages: {
    getByThread: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByThread: vi.fn().mockResolvedValue(undefined),
  },
  prompts: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByFolder: vi.fn().mockResolvedValue(undefined),
  },
  promptFolders: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
};

const mockSettings = {
  get: vi.fn((key: string) => localStorageMap.get(key) ?? null),
  set: vi.fn((key: string, value: string) => localStorageMap.set(key, value)),
  remove: vi.fn((key: string) => localStorageMap.delete(key)),
};

const mockProvider = {
  setCurrentProvider: vi.fn(),
  setCurrentProviderModel: vi.fn(),
  setCurrentProviderTools: vi.fn(),
  setCurrentProviderPrevMessages: vi.fn(),
  stopMessage: vi.fn(),
  checkNewProvider: vi.fn().mockResolvedValue(true),
  getProvidersModels: vi.fn().mockResolvedValue({ models: [], errors: {} }),
};

const mockPlatform = {
  env: {
    theme: "theme-dark",
    systemTheme: "dark",
    locale: "en",
    devicePixelRatio: 2,
    onEnvironmentChange: vi.fn(),
  },
  file: null,
  process: null,
  hostTools: null,
};

vi.mock("../../storage/storage-holder", () => ({
  getStorageInstance: () => mockStorage,
}));

vi.mock("../../settings/settings-holder", () => ({
  getSettingsInstance: () => mockSettings,
}));

vi.mock("../../providers/provider-holder", () => ({
  getProviderInstance: () => mockProvider,
}));

vi.mock("../../platform/platform-holder", () => ({
  getPlatformInstance: () => mockPlatform,
}));

// ---------------------------------------------------------------------------
// Service mocks — hoisted so they exist before module evaluation
// ---------------------------------------------------------------------------

const {
  mockProfilesService,
  mockThreadsService,
  mockServersService,
  mockPromptsService,
  mockChatEngine,
} = vi.hoisted(() => ({
  mockProfilesService: {
    init: vi.fn(),
    addProfile: vi.fn(),
    editProfile: vi.fn(),
    deleteProfile: vi.fn(),
    clearTaskProfileIfMatch: vi.fn(),
    reassignDefault: vi.fn(),
    applyCurrentChatProvider: vi.fn(),
    setTaskProfile: vi.fn(),
    loadProfileById: vi.fn(),
    selectCurrentChatProfile: vi.fn(),
  },
  mockThreadsService: {
    loadAll: vi.fn().mockResolvedValue([]),
    createThread: vi.fn(
      (threadId: string, title: string, profileId?: string) => ({
        threadId,
        title,
        profileId,
        lastEditDate: Date.now(),
      })
    ),
    touchThread: vi.fn(),
    migrateThreadToProfile: vi.fn(),
    downloadThread: vi.fn().mockResolvedValue(undefined),
    renameThread: vi.fn(),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn().mockResolvedValue(undefined),
  },
  mockServersService: {
    initServers: vi.fn(),
    buildToolsList: vi.fn().mockResolvedValue({
      tools: [],
      servers: {},
      disabledTools: {},
      webSearchEnabled: false,
    }),
    changeToolStatus: vi.fn(),
    callTools: vi.fn(),
    checkAllowAlways: vi.fn(),
    setAllowAlways: vi.fn(),
    getConfig: vi.fn().mockReturnValue({}),
    saveConfig: vi.fn(),
    deleteCustomServer: vi.fn(),
    getCustomServersLogs: vi.fn().mockReturnValue({}),
    getWebSearchEnabled: vi.fn().mockReturnValue(false),
  },
  mockPromptsService: {
    loadAll: vi.fn().mockResolvedValue({ prompts: [], folders: [] }),
    createPrompt: vi.fn(),
    updatePrompt: vi.fn(),
    deletePrompt: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
  },
  mockChatEngine: {
    sendMessage: vi.fn(),
    approveToolCall: vi.fn(),
    denyToolCall: vi.fn(),
    handleToolCall: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock("../../services/profiles", () => ({
  ProfilesService: class {
    init = mockProfilesService.init;
    addProfile = mockProfilesService.addProfile;
    editProfile = mockProfilesService.editProfile;
    deleteProfile = mockProfilesService.deleteProfile;
    clearTaskProfileIfMatch = mockProfilesService.clearTaskProfileIfMatch;
    reassignDefault = mockProfilesService.reassignDefault;
    applyCurrentChatProvider = mockProfilesService.applyCurrentChatProvider;
    setTaskProfile = mockProfilesService.setTaskProfile;
    loadProfileById = mockProfilesService.loadProfileById;
    selectCurrentChatProfile = mockProfilesService.selectCurrentChatProfile;
  },
}));

vi.mock("../../services/threads", () => ({
  ThreadsService: class {
    loadAll = mockThreadsService.loadAll;
    createThread = mockThreadsService.createThread;
    touchThread = mockThreadsService.touchThread;
    migrateThreadToProfile = mockThreadsService.migrateThreadToProfile;
    downloadThread = mockThreadsService.downloadThread;
    renameThread = mockThreadsService.renameThread;
    deleteThread = mockThreadsService.deleteThread;
    clearHistory = mockThreadsService.clearHistory;
  },
}));

vi.mock("../../services/servers", () => ({
  ServersService: class {
    // biome-ignore lint/complexity/noUselessConstructor: accepts constructor args from create-stores
    // biome-ignore lint/suspicious/noEmptyBlockStatements: mock constructor
    constructor(_mcpKey: string, _disabledKey: string) {}
    initServers = mockServersService.initServers;
    buildToolsList = mockServersService.buildToolsList;
    changeToolStatus = mockServersService.changeToolStatus;
    callTools = mockServersService.callTools;
    checkAllowAlways = mockServersService.checkAllowAlways;
    setAllowAlways = mockServersService.setAllowAlways;
    getConfig = mockServersService.getConfig;
    saveConfig = mockServersService.saveConfig;
    deleteCustomServer = mockServersService.deleteCustomServer;
    getCustomServersLogs = mockServersService.getCustomServersLogs;
    getWebSearchEnabled = mockServersService.getWebSearchEnabled;
  },
}));

vi.mock("../../services/prompts", () => ({
  PromptsService: class {
    loadAll = mockPromptsService.loadAll;
    createPrompt = mockPromptsService.createPrompt;
    updatePrompt = mockPromptsService.updatePrompt;
    deletePrompt = mockPromptsService.deletePrompt;
    createFolder = mockPromptsService.createFolder;
    renameFolder = mockPromptsService.renameFolder;
    deleteFolder = mockPromptsService.deleteFolder;
  },
}));

vi.mock("../../services/chat-engine", () => ({
  ChatEngine: class {
    sendMessage = mockChatEngine.sendMessage;
    approveToolCall = mockChatEngine.approveToolCall;
    denyToolCall = mockChatEngine.denyToolCall;
    handleToolCall = mockChatEngine.handleToolCall;
    stop = mockChatEngine.stop;
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import type { Profile, Thread } from "../../types";
import { createStores } from "../create-stores";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeProfile = (overrides?: Partial<Profile>): Profile => ({
  id: crypto.randomUUID(),
  name: "Test Profile",
  providerType: "openai",
  baseUrl: "https://api.openai.com",
  key: "sk-test",
  modelId: "gpt-4",
  ...overrides,
});

const makeThread = (overrides?: Partial<Thread>): Thread => ({
  threadId: crypto.randomUUID(),
  title: "Test Thread",
  lastEditDate: Date.now(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createStores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMap.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Factory basics ----

  it("returns all 8 stores, chatEngine, and selectCurrentChatProfile", () => {
    const stores = createStores();
    expect(stores.useMessageStore).toBeDefined();
    expect(stores.useProfilesStore).toBeDefined();
    expect(stores.useThreadsStore).toBeDefined();
    expect(stores.useServersStore).toBeDefined();
    expect(stores.usePromptsStore).toBeDefined();
    expect(stores.useAttachmentsStore).toBeDefined();
    expect(stores.useThemeStore).toBeDefined();
    expect(stores.useRouter).toBeDefined();
    expect(stores.chatEngine).toBeDefined();
    expect(stores.selectCurrentChatProfile).toBeTypeOf("function");
  });

  it("creates independent store instances", () => {
    const stores1 = createStores();
    const stores2 = createStores();

    stores1.useRouter.getState().goToSettings();
    expect(stores1.useRouter.getState().currentPage).toBe("settings");
    expect(stores2.useRouter.getState().currentPage).toBe("chat");
  });

  it("uses default keys when no config provided", () => {
    const stores = createStores();
    // Toggle extended thinking — should use default deepMode key
    stores.useProfilesStore.getState().toggleExtendedThinking();
    expect(mockSettings.set).toHaveBeenCalledWith(
      DEFAULT_STORE_KEYS.deepMode,
      "true"
    );
  });

  it("accepts custom keys via config", () => {
    const stores = createStores({
      keys: { deepMode: "my-custom-deep-mode" },
    });
    stores.useProfilesStore.getState().toggleExtendedThinking();
    expect(mockSettings.set).toHaveBeenCalledWith(
      "my-custom-deep-mode",
      "true"
    );
  });

  // ---- Router Store ----

  describe("useRouter", () => {
    it("starts on chat page", () => {
      const { useRouter } = createStores();
      expect(useRouter.getState().currentPage).toBe("chat");
    });

    it("setCurrentPage sets arbitrary page", () => {
      const { useRouter } = createStores();
      useRouter.getState().setCurrentPage("history");
      expect(useRouter.getState().currentPage).toBe("history");
    });

    it("navigates between pages", () => {
      const { useRouter } = createStores();
      useRouter.getState().goToSettings();
      expect(useRouter.getState().currentPage).toBe("settings");
      useRouter.getState().goToChat();
      expect(useRouter.getState().currentPage).toBe("chat");
      useRouter.getState().goToInitialSetup();
      expect(useRouter.getState().currentPage).toBe("initial-setup");
    });
  });

  // ---- Theme Store ----

  describe("useThemeStore", () => {
    it("starts with light theme", () => {
      const { useThemeStore } = createStores();
      expect(useThemeStore.getState().themeId).toBe("theme-light");
      expect(useThemeStore.getState().themeType).toBe("light");
    });

    it("sets theme and derives themeType", () => {
      const { useThemeStore } = createStores();
      useThemeStore.getState().setThemeId("theme-night");
      expect(useThemeStore.getState().themeType).toBe("dark");

      useThemeStore.getState().setThemeId("theme-white");
      expect(useThemeStore.getState().themeType).toBe("light");

      useThemeStore.getState().setThemeId("theme-contrast-dark");
      expect(useThemeStore.getState().themeType).toBe("dark");
    });

    it("setScale updates scale", () => {
      const { useThemeStore } = createStores();
      useThemeStore.getState().setScale(3);
      expect(useThemeStore.getState().scale).toBe(3);
    });

    it("initializes from platform once", () => {
      const { useThemeStore } = createStores();
      useThemeStore.getState().initFromPlatform();
      expect(useThemeStore.getState().themeId).toBe("theme-dark");
      expect(useThemeStore.getState().scale).toBe(2);
      expect(useThemeStore.getState().initialized).toBe(true);

      // Second call should not change anything
      mockPlatform.env.theme = "theme-light";
      useThemeStore.getState().initFromPlatform();
      expect(useThemeStore.getState().themeId).toBe("theme-dark");

      // Restore
      mockPlatform.env.theme = "theme-dark";
    });
  });

  // ---- Attachments Store ----

  describe("useAttachmentsStore", () => {
    it("adds and clears files", () => {
      const { useAttachmentsStore } = createStores();
      const file = { path: "/test.pdf", content: "data", type: "pdf" };

      useAttachmentsStore.getState().addAttachmentFile(file);
      expect(useAttachmentsStore.getState().attachmentFiles).toHaveLength(1);

      useAttachmentsStore.getState().clearAttachmentFiles();
      expect(useAttachmentsStore.getState().attachmentFiles).toHaveLength(0);
    });

    it("limits files to 5", () => {
      const { useAttachmentsStore } = createStores();
      for (let i = 0; i < 7; i++) {
        useAttachmentsStore
          .getState()
          .addAttachmentFile({ path: `/f${i}`, content: "", type: "" });
      }
      expect(useAttachmentsStore.getState().attachmentFiles).toHaveLength(5);
    });

    it("clears all attachment images", () => {
      const { useAttachmentsStore } = createStores();
      useAttachmentsStore
        .getState()
        .addAttachmentImage({ name: "a", base64: "" });
      useAttachmentsStore
        .getState()
        .addAttachmentImage({ name: "b", base64: "" });
      expect(useAttachmentsStore.getState().attachmentImages).toHaveLength(2);

      useAttachmentsStore.getState().clearAttachmentImages();
      expect(useAttachmentsStore.getState().attachmentImages).toHaveLength(0);
    });

    it("limits images to 5", () => {
      const { useAttachmentsStore } = createStores();
      for (let i = 0; i < 7; i++) {
        useAttachmentsStore
          .getState()
          .addAttachmentImage({ name: `img${i}`, base64: "" });
      }
      expect(useAttachmentsStore.getState().attachmentImages).toHaveLength(5);
    });

    it("deletes specific files and images", () => {
      const { useAttachmentsStore } = createStores();
      useAttachmentsStore
        .getState()
        .addAttachmentFile({ path: "/a", content: "", type: "" });
      useAttachmentsStore
        .getState()
        .addAttachmentFile({ path: "/b", content: "", type: "" });

      useAttachmentsStore.getState().deleteAttachmentFile("/a");
      expect(useAttachmentsStore.getState().attachmentFiles).toHaveLength(1);
      expect(useAttachmentsStore.getState().attachmentFiles[0].path).toBe("/b");

      useAttachmentsStore
        .getState()
        .addAttachmentImage({ name: "x", base64: "" });
      useAttachmentsStore
        .getState()
        .addAttachmentImage({ name: "y", base64: "" });
      useAttachmentsStore.getState().deleteAttachmentImage("x");
      expect(useAttachmentsStore.getState().attachmentImages).toHaveLength(1);
    });
  });

  // ---- Message Store ----

  describe("useMessageStore", () => {
    it("starts with empty messages", () => {
      const { useMessageStore } = createStores();
      expect(useMessageStore.getState().messages).toEqual([]);
      expect(useMessageStore.getState().isStreamRunning).toBe(false);
      expect(useMessageStore.getState().isRequestRunning).toBe(false);
    });

    it("adds and clears messages", () => {
      const { useMessageStore } = createStores();
      const msg = {
        role: "user" as const,
        content: [{ type: "text" as const, text: "hi" }],
      };

      useMessageStore.getState().addMessage(msg);
      expect(useMessageStore.getState().messages).toHaveLength(1);

      useMessageStore.getState().clearMessages();
      expect(useMessageStore.getState().messages).toHaveLength(0);
      expect(mockProvider.setCurrentProviderPrevMessages).toHaveBeenCalledWith(
        []
      );
    });

    it("updates last message", () => {
      const { useMessageStore } = createStores();
      const msg1 = {
        role: "user" as const,
        content: [{ type: "text" as const, text: "hi" }],
      };
      const msg2 = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "hello" }],
      };

      useMessageStore.getState().addMessage(msg1);
      useMessageStore.getState().addMessage(msg2);
      expect(useMessageStore.getState().messages).toHaveLength(2);

      const updated = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "hello world" }],
      };
      useMessageStore.getState().updateLastMessage(updated);
      expect(useMessageStore.getState().messages).toHaveLength(2);
      expect(useMessageStore.getState().messages[1]).toEqual(updated);
    });

    it("replaces incomplete message when adding", () => {
      const { useMessageStore } = createStores();
      const incomplete = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "partial" }],
        status: { type: "incomplete" as const, reason: "error" as const },
      };

      useMessageStore.getState().addMessage(incomplete);
      expect(useMessageStore.getState().messages).toHaveLength(1);

      const replacement = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "full" }],
      };
      useMessageStore.getState().addMessage(replacement);
      expect(useMessageStore.getState().messages).toHaveLength(1);
      expect(useMessageStore.getState().messages[0].content).toEqual(
        replacement.content
      );
    });

    it("fetches previous messages from storage", async () => {
      const stored = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "hi" }],
        },
      ];
      mockStorage.messages.getByThread.mockResolvedValue(stored);

      const { useMessageStore } = createStores();
      await useMessageStore.getState().fetchPrevMessages("thread-1");

      expect(mockStorage.messages.getByThread).toHaveBeenCalledWith("thread-1");
      expect(useMessageStore.getState().messages).toEqual(stored);
      expect(mockProvider.setCurrentProviderPrevMessages).toHaveBeenCalledWith(
        stored
      );
    });

    it("stopMessage stops stream and provider", () => {
      const { useMessageStore } = createStores();
      useMessageStore.setState({ isStreamRunning: true });
      useMessageStore.getState().stopMessage();
      expect(useMessageStore.getState().isStreamRunning).toBe(false);
      expect(mockProvider.stopMessage).toHaveBeenCalled();
    });
  });

  // ---- Prompts Store ----

  describe("usePromptsStore", () => {
    it("starts with empty prompts and folders", () => {
      const { usePromptsStore } = createStores();
      expect(usePromptsStore.getState().prompts).toEqual([]);
      expect(usePromptsStore.getState().folders).toEqual([]);
    });
  });

  // ---- Profiles Store ----

  describe("useProfilesStore", () => {
    it("starts with no profiles", () => {
      const { useProfilesStore } = createStores();
      const state = useProfilesStore.getState();
      expect(state.profiles).toEqual([]);
      expect(state.defaultProfile).toBeNull();
      expect(state.chatProfile).toBeNull();
    });

    it("reads extendedThinking from settings on creation", () => {
      localStorageMap.set(DEFAULT_STORE_KEYS.deepMode, "true");
      const { useProfilesStore } = createStores();
      expect(useProfilesStore.getState().extendedThinking).toBe(true);
    });

    it("toggleExtendedThinking persists to settings", () => {
      const { useProfilesStore } = createStores();
      expect(useProfilesStore.getState().extendedThinking).toBe(false);

      useProfilesStore.getState().toggleExtendedThinking();
      expect(useProfilesStore.getState().extendedThinking).toBe(true);
      expect(mockSettings.set).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.deepMode,
        "true"
      );
    });

    it("getProfileById returns matching profile", () => {
      const { useProfilesStore } = createStores();
      const profile = makeProfile({ id: "p1" });
      useProfilesStore.setState({ profiles: [profile] });

      expect(useProfilesStore.getState().getProfileById("p1")).toEqual(profile);
      expect(useProfilesStore.getState().getProfileById("p2")).toBeNull();
    });

    it("getProfileByName supports case-insensitive search", () => {
      const { useProfilesStore } = createStores();
      const profile = makeProfile({ name: "MyProfile" });
      useProfilesStore.setState({ profiles: [profile] });

      expect(
        useProfilesStore.getState().getProfileByName("myprofile", true)
      ).toEqual(profile);
      expect(
        useProfilesStore.getState().getProfileByName("myprofile", false)
      ).toBeNull();
    });
  });

  // ---- selectCurrentChatProfile ----

  describe("selectCurrentChatProfile", () => {
    it("prefers sessionChatProfile over chatProfile over defaultProfile", () => {
      const { useProfilesStore, selectCurrentChatProfile } = createStores();
      const defaultP = makeProfile({ name: "default" });
      const chatP = makeProfile({ name: "chat" });
      const sessionP = makeProfile({ name: "session" });

      useProfilesStore.setState({ defaultProfile: defaultP });
      expect(selectCurrentChatProfile(useProfilesStore.getState())).toEqual(
        defaultP
      );

      useProfilesStore.setState({ chatProfile: chatP });
      expect(selectCurrentChatProfile(useProfilesStore.getState())).toEqual(
        chatP
      );

      useProfilesStore.setState({ sessionChatProfile: sessionP });
      expect(selectCurrentChatProfile(useProfilesStore.getState())).toEqual(
        sessionP
      );
    });
  });

  // ---- Cross-store references ----

  describe("cross-store references", () => {
    it("threads store accesses profiles store for session profile", () => {
      const stores = createStores();
      const profile = makeProfile({ id: "p1" });
      stores.useProfilesStore.setState({
        profiles: [profile],
        defaultProfile: profile,
      });

      const thread = makeThread({ threadId: "t1", profileId: "p1" });
      stores.useThreadsStore.setState({ threads: [thread] });

      stores.useThreadsStore.getState().onSwitchToThread("t1");
      // Should set session chat profile via profiles store
      expect(stores.useProfilesStore.getState().sessionChatProfile).toEqual(
        profile
      );
    });

    it("threads store clears messages when clearing thread history", async () => {
      const stores = createStores();
      const msg = {
        role: "user" as const,
        content: [{ type: "text" as const, text: "hi" }],
      };
      stores.useMessageStore.getState().addMessage(msg);
      expect(stores.useMessageStore.getState().messages).toHaveLength(1);

      const threadId = stores.useThreadsStore.getState().threadId;
      await stores.useThreadsStore.getState().onClearThreadHistory(threadId);

      expect(stores.useMessageStore.getState().messages).toHaveLength(0);
    });
  });

  // ---- Servers Store ----

  describe("useServersStore", () => {
    it("starts with empty state", () => {
      const { useServersStore } = createStores();
      expect(useServersStore.getState().servers).toEqual({});
      expect(useServersStore.getState().tools).toEqual([]);
      expect(useServersStore.getState().manageToolData).toBeUndefined();
    });

    it("sets and clears manageToolData", () => {
      const { useServersStore } = createStores();
      const data = {
        message: { role: "assistant" as const, content: [] },
        idx: 0,
        messageUID: "uid-1",
      };

      useServersStore.getState().setManageToolData(data);
      expect(useServersStore.getState().manageToolData).toEqual(data);

      useServersStore.getState().setManageToolData(undefined);
      expect(useServersStore.getState().manageToolData).toBeUndefined();
    });
  });

  // ---- Threads Store ----

  describe("useThreadsStore", () => {
    it("starts with a random threadId and empty threads", () => {
      const { useThreadsStore } = createStores();
      expect(useThreadsStore.getState().threadId).toBeTruthy();
      expect(useThreadsStore.getState().threads).toEqual([]);
    });

    it("inserts a thread", () => {
      const { useThreadsStore } = createStores();
      useThreadsStore.getState().insertThread("My Chat", { profileId: "p1" });
      expect(useThreadsStore.getState().threads).toHaveLength(1);
      expect(useThreadsStore.getState().threads[0].title).toBe("My Chat");
    });

    it("switches to a new thread generating new ID", () => {
      const { useThreadsStore } = createStores();
      const oldId = useThreadsStore.getState().threadId;
      useThreadsStore.getState().onSwitchToNewThread();
      expect(useThreadsStore.getState().threadId).not.toBe(oldId);
    });

    it("renames a thread", () => {
      const { useThreadsStore } = createStores();
      const thread = makeThread({ threadId: "t1", title: "Old" });
      useThreadsStore.setState({ threads: [thread] });

      useThreadsStore.getState().onRenameThread("t1", "New");
      expect(useThreadsStore.getState().threads[0].title).toBe("New");
    });

    it("deletes a thread and switches if active", () => {
      const { useThreadsStore } = createStores();
      const thread = makeThread({ threadId: "t1" });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });

      useThreadsStore.getState().onDeleteThread("t1");
      expect(useThreadsStore.getState().threads).toHaveLength(0);
      expect(useThreadsStore.getState().threadId).not.toBe("t1");
    });

    it("initThreads loads threads from service", async () => {
      const threads = [
        makeThread({ threadId: "t1" }),
        makeThread({ threadId: "t2" }),
      ];
      mockThreadsService.loadAll.mockResolvedValue(threads);

      const { useThreadsStore } = createStores();
      await useThreadsStore.getState().initThreads();

      expect(mockThreadsService.loadAll).toHaveBeenCalled();
      expect(useThreadsStore.getState().threads).toEqual(threads);
    });

    it("insertNewMessageToThread updates thread lastEditDate and profileId", () => {
      const { useThreadsStore } = createStores();
      const thread = makeThread({
        threadId: "t1",
        lastEditDate: 1000,
      });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });

      useThreadsStore.getState().insertNewMessageToThread({ profileId: "p1" });

      expect(mockThreadsService.touchThread).toHaveBeenCalledWith("t1", {
        profileId: "p1",
      });
      const updated = useThreadsStore.getState().threads[0];
      expect(updated.profileId).toBe("p1");
      expect(updated.lastEditDate).toBeGreaterThan(1000);
    });

    it("insertNewMessageToThread without opts does not set profileId", () => {
      const { useThreadsStore } = createStores();
      const thread = makeThread({ threadId: "t1" });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });

      useThreadsStore.getState().insertNewMessageToThread();

      expect(mockThreadsService.touchThread).toHaveBeenCalledWith(
        "t1",
        undefined
      );
    });

    it("onSwitchToThread migrates thread with provider/model", () => {
      const profile = makeProfile({ id: "p1" });
      const migratedThread = makeThread({
        threadId: "t1",
        profileId: "p1",
      });
      mockThreadsService.migrateThreadToProfile.mockReturnValue(migratedThread);

      const stores = createStores();
      stores.useProfilesStore.setState({
        profiles: [profile],
        defaultProfile: profile,
      });
      const threadWithProvider = makeThread({
        threadId: "t1",
        provider: {
          type: "openai",
          baseUrl: "https://api.openai.com",
          key: "k",
        },
        model: { id: "gpt-4", name: "GPT-4" },
      } as Partial<Thread>);
      stores.useThreadsStore.setState({
        threads: [threadWithProvider],
      });

      stores.useThreadsStore.getState().onSwitchToThread("t1");

      expect(mockThreadsService.migrateThreadToProfile).toHaveBeenCalledWith(
        threadWithProvider,
        [profile],
        null,
        profile
      );
    });

    it("onDownloadThread calls service.downloadThread", async () => {
      const { useThreadsStore } = createStores();
      const thread = makeThread({ threadId: "t1", title: "My Chat" });
      useThreadsStore.setState({ threads: [thread] });

      await useThreadsStore.getState().onDownloadThread("t1");

      expect(mockThreadsService.downloadThread).toHaveBeenCalledWith(
        "t1",
        "My Chat"
      );
    });

    it("onDownloadThread with unknown thread passes undefined title", async () => {
      const { useThreadsStore } = createStores();
      useThreadsStore.setState({ threads: [] });

      await useThreadsStore.getState().onDownloadThread("unknown");

      expect(mockThreadsService.downloadThread).toHaveBeenCalledWith(
        "unknown",
        undefined
      );
    });
  });

  // ---- ProfilesStore service-backed methods ----

  describe("useProfilesStore — service-backed methods", () => {
    it("init() loads profiles and task profiles from service", async () => {
      const p1 = makeProfile({ id: "p1", name: "Default" });
      const p2 = makeProfile({ id: "p2", name: "Chat" });

      mockProfilesService.init.mockResolvedValue({
        profiles: [p1, p2],
        defaultProfile: p1,
        taskProfiles: {
          [DEFAULT_STORE_KEYS.chatProfile]: p2,
          [DEFAULT_STORE_KEYS.summarizationProfile]: null,
          [DEFAULT_STORE_KEYS.translationProfile]: null,
          [DEFAULT_STORE_KEYS.textAnalysisProfile]: null,
          [DEFAULT_STORE_KEYS.imageGenerationProfile]: null,
          [DEFAULT_STORE_KEYS.ocrProfile]: null,
          [DEFAULT_STORE_KEYS.visionProfile]: null,
        },
      });

      const { useProfilesStore } = createStores();
      await useProfilesStore.getState().init();

      const state = useProfilesStore.getState();
      expect(state.profiles).toEqual([p1, p2]);
      expect(state.defaultProfile).toEqual(p1);
      expect(state.chatProfile).toEqual(p2);
      expect(state.summarizationProfile).toBeNull();
      expect(mockProfilesService.applyCurrentChatProvider).toHaveBeenCalled();
    });

    it("addProfile() success — adds to profiles array", async () => {
      const newProfile = makeProfile({ id: "new-1", name: "New" });
      mockProfilesService.addProfile.mockResolvedValue({
        success: true,
        profile: newProfile,
      });

      const { useProfilesStore } = createStores();
      const result = await useProfilesStore.getState().addProfile({
        name: "New",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
      });

      expect(result).toBe(true);
      expect(useProfilesStore.getState().profiles).toContainEqual(newProfile);
    });

    it("addProfile() first profile — sets as default", async () => {
      const firstProfile = makeProfile({ id: "first", name: "First" });
      mockProfilesService.addProfile.mockResolvedValue({
        success: true,
        profile: firstProfile,
      });

      const { useProfilesStore } = createStores();
      // Ensure no profiles exist
      expect(useProfilesStore.getState().profiles).toHaveLength(0);

      await useProfilesStore.getState().addProfile({
        name: "First",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
      });

      expect(useProfilesStore.getState().defaultProfile).toEqual(firstProfile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalled();
    });

    it("addProfile() error — returns error data", async () => {
      const error = { field: "name" as const, message: "Duplicate name" };
      mockProfilesService.addProfile.mockResolvedValue({
        success: false,
        error,
      });

      const { useProfilesStore } = createStores();
      const result = await useProfilesStore.getState().addProfile({
        name: "Dup",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
      });

      expect(result).toEqual(error);
    });

    it("editProfile() success — updates matching profiles across all task fields", async () => {
      const original = makeProfile({ id: "p1", name: "Old Name" });
      const edited = { ...original, name: "New Name" };

      mockProfilesService.editProfile.mockResolvedValue({ success: true });

      const { useProfilesStore } = createStores();
      useProfilesStore.setState({
        profiles: [original],
        defaultProfile: original,
        chatProfile: original,
        summarizationProfile: null,
        sessionChatProfile: original,
      });

      const result = await useProfilesStore.getState().editProfile(edited);

      expect(result).toBe(true);
      const state = useProfilesStore.getState();
      expect(state.profiles[0].name).toBe("New Name");
      expect(state.defaultProfile?.name).toBe("New Name");
      expect(state.chatProfile?.name).toBe("New Name");
      expect(state.sessionChatProfile?.name).toBe("New Name");
    });

    it("editProfile() error — returns error and does not update state", async () => {
      const error = { field: "name" as const, message: "Duplicate name" };
      mockProfilesService.editProfile.mockResolvedValue({
        success: false,
        error,
      });

      const original = makeProfile({ id: "p1", name: "Old" });
      const { useProfilesStore } = createStores();
      useProfilesStore.setState({ profiles: [original] });

      const result = await useProfilesStore
        .getState()
        .editProfile({ ...original, name: "Dup" });

      expect(result).toEqual(error);
      expect(useProfilesStore.getState().profiles[0].name).toBe("Old");
    });

    it("deleteProfile() clears task profiles that match and reassigns default", async () => {
      const p1 = makeProfile({ id: "p1", name: "Profile 1" });
      const p2 = makeProfile({ id: "p2", name: "Profile 2" });

      mockProfilesService.deleteProfile.mockResolvedValue(undefined);
      mockProfilesService.clearTaskProfileIfMatch.mockImplementation(
        (profile: Profile | null, id: string) => {
          if (profile?.id === id) return null;
          return profile;
        }
      );
      mockProfilesService.reassignDefault.mockReturnValue(p2);

      const { useProfilesStore } = createStores();
      useProfilesStore.setState({
        profiles: [p1, p2],
        defaultProfile: p1,
        chatProfile: p1,
        summarizationProfile: null,
        translationProfile: null,
        textAnalysisProfile: null,
        imageGenerationProfile: null,
        ocrProfile: null,
        visionProfile: null,
        sessionChatProfile: null,
      });

      await useProfilesStore.getState().deleteProfile("p1");

      const state = useProfilesStore.getState();
      expect(state.profiles).toHaveLength(1);
      expect(state.profiles[0].id).toBe("p2");
      expect(state.chatProfile).toBeNull();
      expect(state.defaultProfile).toEqual(p2);
      expect(mockProfilesService.deleteProfile).toHaveBeenCalledWith("p1");
      expect(mockProfilesService.applyCurrentChatProvider).toHaveBeenCalled();
    });

    it("deleteProfile() clears sessionChatProfile if it matches", async () => {
      const p1 = makeProfile({ id: "p1" });

      mockProfilesService.deleteProfile.mockResolvedValue(undefined);
      mockProfilesService.clearTaskProfileIfMatch.mockReturnValue(null);
      mockProfilesService.reassignDefault.mockReturnValue(null);

      const { useProfilesStore } = createStores();
      useProfilesStore.setState({
        profiles: [p1],
        defaultProfile: p1,
        chatProfile: null,
        summarizationProfile: null,
        translationProfile: null,
        textAnalysisProfile: null,
        imageGenerationProfile: null,
        ocrProfile: null,
        visionProfile: null,
        sessionChatProfile: p1,
      });

      await useProfilesStore.getState().deleteProfile("p1");

      expect(useProfilesStore.getState().sessionChatProfile).toBeNull();
    });

    it("deleteProfile() clears all task profiles when they all match", async () => {
      const p1 = makeProfile({ id: "p1" });

      mockProfilesService.deleteProfile.mockResolvedValue(undefined);
      mockProfilesService.clearTaskProfileIfMatch.mockImplementation(
        (profile: Profile | null, id: string) => {
          if (profile?.id === id) return null;
          return profile;
        }
      );
      mockProfilesService.reassignDefault.mockReturnValue(null);

      const { useProfilesStore } = createStores();
      useProfilesStore.setState({
        profiles: [p1],
        defaultProfile: p1,
        chatProfile: p1,
        summarizationProfile: p1,
        translationProfile: p1,
        textAnalysisProfile: p1,
        imageGenerationProfile: p1,
        ocrProfile: p1,
        visionProfile: p1,
        sessionChatProfile: null,
      });

      await useProfilesStore.getState().deleteProfile("p1");

      const state = useProfilesStore.getState();
      expect(state.profiles).toHaveLength(0);
      expect(state.chatProfile).toBeNull();
      expect(state.summarizationProfile).toBeNull();
      expect(state.translationProfile).toBeNull();
      expect(state.textAnalysisProfile).toBeNull();
      expect(state.imageGenerationProfile).toBeNull();
      expect(state.ocrProfile).toBeNull();
      expect(state.visionProfile).toBeNull();
      expect(state.defaultProfile).toBeNull();
      // clearTaskProfileIfMatch called 7 times (one per task profile)
      expect(mockProfilesService.clearTaskProfileIfMatch).toHaveBeenCalledTimes(
        7
      );
    });

    it("editProfile() updates profile assigned as summarizationProfile", async () => {
      const original = makeProfile({ id: "p1", name: "Old" });
      const edited = { ...original, name: "Updated" };

      mockProfilesService.editProfile.mockResolvedValue({ success: true });

      const { useProfilesStore } = createStores();
      useProfilesStore.setState({
        profiles: [original],
        defaultProfile: null,
        chatProfile: null,
        summarizationProfile: original,
        translationProfile: null,
        textAnalysisProfile: null,
        imageGenerationProfile: null,
        ocrProfile: null,
        visionProfile: null,
        sessionChatProfile: null,
      });

      const result = await useProfilesStore.getState().editProfile(edited);

      expect(result).toBe(true);
      const state = useProfilesStore.getState();
      expect(state.summarizationProfile?.name).toBe("Updated");
      expect(state.profiles[0].name).toBe("Updated");
      expect(mockProfilesService.applyCurrentChatProvider).toHaveBeenCalled();
    });

    it("editProfile() updates profile assigned across all task profiles", async () => {
      const original = makeProfile({ id: "p1", name: "Old" });
      const edited = { ...original, name: "Everywhere" };

      mockProfilesService.editProfile.mockResolvedValue({ success: true });

      const { useProfilesStore } = createStores();
      useProfilesStore.setState({
        profiles: [original],
        defaultProfile: original,
        chatProfile: original,
        summarizationProfile: original,
        translationProfile: original,
        textAnalysisProfile: original,
        imageGenerationProfile: original,
        ocrProfile: original,
        visionProfile: original,
        sessionChatProfile: original,
      });

      await useProfilesStore.getState().editProfile(edited);

      const state = useProfilesStore.getState();
      expect(state.defaultProfile?.name).toBe("Everywhere");
      expect(state.chatProfile?.name).toBe("Everywhere");
      expect(state.summarizationProfile?.name).toBe("Everywhere");
      expect(state.translationProfile?.name).toBe("Everywhere");
      expect(state.textAnalysisProfile?.name).toBe("Everywhere");
      expect(state.imageGenerationProfile?.name).toBe("Everywhere");
      expect(state.ocrProfile?.name).toBe("Everywhere");
      expect(state.visionProfile?.name).toBe("Everywhere");
      expect(state.sessionChatProfile?.name).toBe("Everywhere");
    });

    it("setChatProfile sets chatProfile and calls applyCurrentChatProvider", () => {
      const profile = makeProfile({ id: "cp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setChatProfile(profile);

      expect(useProfilesStore.getState().chatProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.chatProfile,
        profile
      );
      expect(mockProfilesService.applyCurrentChatProvider).toHaveBeenCalled();
    });

    it("setChatProfile(null) clears chatProfile", () => {
      const { useProfilesStore } = createStores();
      const profile = makeProfile({ id: "cp1" });
      useProfilesStore.setState({ chatProfile: profile });

      useProfilesStore.getState().setChatProfile(null);

      expect(useProfilesStore.getState().chatProfile).toBeNull();
    });

    it("setSummarizationProfile persists via setTaskProfile", () => {
      const profile = makeProfile({ id: "sp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setSummarizationProfile(profile);

      expect(useProfilesStore.getState().summarizationProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.summarizationProfile,
        profile
      );
    });

    it("setTranslationProfile persists via setTaskProfile", () => {
      const profile = makeProfile({ id: "tp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setTranslationProfile(profile);

      expect(useProfilesStore.getState().translationProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.translationProfile,
        profile
      );
    });

    it("setTextAnalysisProfile persists via setTaskProfile", () => {
      const profile = makeProfile({ id: "tap1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setTextAnalysisProfile(profile);

      expect(useProfilesStore.getState().textAnalysisProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.textAnalysisProfile,
        profile
      );
    });

    it("setImageGenerationProfile persists via setTaskProfile", () => {
      const profile = makeProfile({ id: "igp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setImageGenerationProfile(profile);

      expect(useProfilesStore.getState().imageGenerationProfile).toEqual(
        profile
      );
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.imageGenerationProfile,
        profile
      );
    });

    it("setOcrProfile persists via setTaskProfile", () => {
      const profile = makeProfile({ id: "op1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setOcrProfile(profile);

      expect(useProfilesStore.getState().ocrProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.ocrProfile,
        profile
      );
    });

    it("setVisionProfile persists via setTaskProfile", () => {
      const profile = makeProfile({ id: "vp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setVisionProfile(profile);

      expect(useProfilesStore.getState().visionProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.visionProfile,
        profile
      );
    });

    it("setSessionChatProfile calls applyCurrentChatProvider", () => {
      const profile = makeProfile({ id: "scp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setSessionChatProfile(profile);

      expect(useProfilesStore.getState().sessionChatProfile).toEqual(profile);
      expect(mockProfilesService.applyCurrentChatProvider).toHaveBeenCalled();
    });

    it("setDefaultProfile calls setTaskProfile and applyCurrentChatProvider", () => {
      const profile = makeProfile({ id: "dp1" });
      const { useProfilesStore } = createStores();

      useProfilesStore.getState().setDefaultProfile(profile);

      expect(useProfilesStore.getState().defaultProfile).toEqual(profile);
      expect(mockProfilesService.setTaskProfile).toHaveBeenCalledWith(
        DEFAULT_STORE_KEYS.defaultProfile,
        profile
      );
      expect(mockProfilesService.applyCurrentChatProvider).toHaveBeenCalled();
    });
  });

  // ---- PromptsStore service-backed methods ----

  describe("usePromptsStore — service-backed methods", () => {
    it("initPrompts loads prompts and folders from service", async () => {
      const prompts = [{ id: "pr1", name: "p", text: "hello", createdAt: 1 }];
      const folders = [{ id: "f1", name: "Folder", createdAt: 1 }];
      mockPromptsService.loadAll.mockResolvedValue({ prompts, folders });

      const { usePromptsStore } = createStores();
      await usePromptsStore.getState().initPrompts();

      expect(usePromptsStore.getState().prompts).toEqual(prompts);
      expect(usePromptsStore.getState().folders).toEqual(folders);
    });

    it("addPrompt creates a prompt via service and prepends to state", () => {
      const prompt = { id: "pr2", name: "n", text: "test", createdAt: 2 };
      mockPromptsService.createPrompt.mockReturnValue(prompt);

      const { usePromptsStore } = createStores();
      usePromptsStore.getState().addPrompt("test");

      expect(usePromptsStore.getState().prompts[0]).toEqual(prompt);
    });

    it("editPrompt updates a prompt via service", () => {
      const original = { id: "pr3", name: "n", text: "old", createdAt: 3 };
      const updated = [{ ...original, text: "new" }];
      mockPromptsService.updatePrompt.mockReturnValue(updated);

      const { usePromptsStore } = createStores();
      usePromptsStore.setState({ prompts: [original] });
      usePromptsStore.getState().editPrompt("pr3", { text: "new" });

      expect(usePromptsStore.getState().prompts).toEqual(updated);
    });

    it("removePrompt removes from state and calls service", () => {
      const prompt = { id: "pr4", name: "n", text: "t", createdAt: 4 };

      const { usePromptsStore } = createStores();
      usePromptsStore.setState({ prompts: [prompt] });
      usePromptsStore.getState().removePrompt("pr4");

      expect(usePromptsStore.getState().prompts).toHaveLength(0);
      expect(mockPromptsService.deletePrompt).toHaveBeenCalledWith("pr4");
    });

    it("addFolder creates folder via service and returns id", () => {
      const folder = { id: "f2", name: "New Folder", createdAt: 5 };
      mockPromptsService.createFolder.mockReturnValue(folder);

      const { usePromptsStore } = createStores();
      const id = usePromptsStore.getState().addFolder("New Folder");

      expect(id).toBe("f2");
      expect(usePromptsStore.getState().folders[0]).toEqual(folder);
    });

    it("renameFolder updates folder name via service", () => {
      const folder = { id: "f3", name: "Old", createdAt: 6 };
      const renamed = [{ ...folder, name: "New" }];
      mockPromptsService.renameFolder.mockReturnValue(renamed);

      const { usePromptsStore } = createStores();
      usePromptsStore.setState({ folders: [folder] });
      usePromptsStore.getState().renameFolder("f3", "New");

      expect(usePromptsStore.getState().folders).toEqual(renamed);
    });

    it("removeFolder removes folder and its prompts", () => {
      const folder = { id: "f4", name: "F", createdAt: 7 };
      const promptInFolder = {
        id: "pr5",
        name: "n",
        text: "t",
        createdAt: 8,
        folderId: "f4",
      };
      const promptOutside = {
        id: "pr6",
        name: "n",
        text: "t",
        createdAt: 9,
      };

      const { usePromptsStore } = createStores();
      usePromptsStore.setState({
        folders: [folder],
        prompts: [promptInFolder, promptOutside],
      });
      usePromptsStore.getState().removeFolder("f4");

      expect(usePromptsStore.getState().folders).toHaveLength(0);
      expect(usePromptsStore.getState().prompts).toHaveLength(1);
      expect(usePromptsStore.getState().prompts[0].id).toBe("pr6");
      expect(mockPromptsService.deleteFolder).toHaveBeenCalledWith("f4");
    });
  });

  // ---- ServersStore service-backed methods ----

  describe("useServersStore — service-backed methods", () => {
    it("initServers calls service.initServers", () => {
      const { useServersStore } = createStores();
      useServersStore.getState().initServers();

      expect(mockServersService.initServers).toHaveBeenCalled();
    });

    it("getTools loads tools from service", async () => {
      mockServersService.buildToolsList.mockResolvedValue({
        tools: [{ name: "tool1", type: "custom" }],
        servers: { custom: [{ name: "tool1" }] },
        disabledTools: { custom: ["tool1"] },
        webSearchEnabled: true,
      });

      const { useServersStore } = createStores();
      await useServersStore.getState().getTools();

      expect(useServersStore.getState().tools).toEqual([
        { name: "tool1", type: "custom" },
      ]);
      expect(useServersStore.getState().webSearchEnabled).toBe(true);
    });

    it("getConfig delegates to service", () => {
      mockServersService.getConfig.mockReturnValue({ myServer: {} });

      const { useServersStore } = createStores();
      const config = useServersStore.getState().getConfig();

      expect(config).toEqual({ myServer: {} });
    });

    it("getWebSearchEnabled delegates to service", () => {
      mockServersService.getWebSearchEnabled.mockReturnValue(true);

      const { useServersStore } = createStores();
      expect(useServersStore.getState().getWebSearchEnabled()).toBe(true);
    });

    it("changeToolStatus updates state when service returns result", () => {
      const result = {
        tools: [{ name: "tool1", enabled: false }],
        servers: { custom: [{ name: "tool1" }] },
        disabledTools: { custom: ["tool1"] },
        webSearchEnabled: false,
      };
      mockServersService.changeToolStatus.mockReturnValue(result);

      const { useServersStore } = createStores();
      useServersStore.getState().changeToolStatus("custom", "tool1", false);

      expect(useServersStore.getState().disabledTools).toEqual({
        custom: ["tool1"],
      });
    });

    it("changeToolStatus with web-search type updates webSearchEnabled", () => {
      const result = {
        tools: [
          { name: "web-search_search", enabled: true },
          { name: "custom_read", enabled: true },
        ],
        servers: {
          "web-search": [{ name: "search", enabled: true }],
          custom: [{ name: "read", enabled: true }],
        },
        disabledTools: { "web-search": [], custom: [] },
        webSearchEnabled: true,
      };
      mockServersService.changeToolStatus.mockReturnValue(result);

      const { useServersStore } = createStores();
      useServersStore.getState().changeToolStatus("web-search", "search", true);

      expect(useServersStore.getState().webSearchEnabled).toBe(true);
      expect(useServersStore.getState().tools).toEqual(result.tools);
    });

    it("changeToolStatus does nothing when service returns null", () => {
      mockServersService.changeToolStatus.mockReturnValue(null);

      const { useServersStore } = createStores();
      useServersStore.getState().changeToolStatus("custom", "tool1", true);

      expect(useServersStore.getState().tools).toEqual([]);
    });

    it("callTools delegates to service", async () => {
      mockServersService.callTools.mockResolvedValue("result");

      const { useServersStore } = createStores();
      const result = await useServersStore
        .getState()
        .callTools("tool1", { arg: "val" });

      expect(result).toBe("result");
      expect(mockServersService.callTools).toHaveBeenCalledWith(
        "tool1",
        { arg: "val" },
        {}
      );
    });

    it("checkAllowAlways delegates to service", () => {
      mockServersService.checkAllowAlways.mockReturnValue(true);

      const { useServersStore } = createStores();
      expect(
        useServersStore.getState().checkAllowAlways("custom", "tool1")
      ).toBe(true);
    });

    it("setAllowAlways delegates to service", () => {
      const { useServersStore } = createStores();
      useServersStore.getState().setAllowAlways(true, "custom", "tool1");

      expect(mockServersService.setAllowAlways).toHaveBeenCalledWith(
        true,
        "custom",
        "tool1"
      );
    });

    it("saveConfig delegates to service", () => {
      const config = { mcpServers: { myServer: {} } };

      const { useServersStore } = createStores();
      useServersStore.getState().saveConfig(config);

      expect(mockServersService.saveConfig).toHaveBeenCalledWith(config);
    });

    it("deleteCustomServer delegates to service", () => {
      const { useServersStore } = createStores();
      useServersStore.getState().deleteCustomServer("myServer");

      expect(mockServersService.deleteCustomServer).toHaveBeenCalledWith(
        "myServer"
      );
    });

    it("getCustomServersLogs delegates to service", () => {
      mockServersService.getCustomServersLogs.mockReturnValue({
        server1: ["log1"],
      });

      const { useServersStore } = createStores();
      expect(useServersStore.getState().getCustomServersLogs()).toEqual({
        server1: ["log1"],
      });
    });
  });
});
