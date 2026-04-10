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
  });
});
