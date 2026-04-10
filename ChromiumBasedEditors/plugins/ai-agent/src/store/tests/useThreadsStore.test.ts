import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Thread } from "@/lib/types";
import useThreadsStore from "../useThreadsStore";

// --- Mocks ---

const mockStorage = {
  threads: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    touch: vi.fn(),
    delete: vi.fn(),
  },
  messages: {
    getByThread: vi.fn(),
    deleteByThread: vi.fn(),
  },
};

const mockPlatform = {
  file: {
    saveAsFile: vi.fn(),
  },
};

const mockSetSessionChatProfile = vi.fn();
const mockGetProfileById = vi.fn();
const mockClearMessages = vi.fn();

// Mutable state returned by the profiles store mock — tests can mutate these.
const profilesStoreState = {
  getProfileById: mockGetProfileById,
  setSessionChatProfile: mockSetSessionChatProfile,
  profiles: [] as unknown[],
  chatProfile: null as unknown,
  defaultProfile: null as unknown,
};

vi.mock("../../../npm_lib/storage/storage-holder", () => ({
  getStorageInstance: () => mockStorage,
}));

vi.mock("../../../npm_lib/platform/platform-holder", () => ({
  getPlatformInstance: () => mockPlatform,
}));

vi.mock("../useProfilesStore", () => ({
  default: {
    getState: () => profilesStoreState,
  },
}));

vi.mock("../useMessageStore", () => ({
  default: {
    getState: () => ({
      clearMessages: mockClearMessages,
    }),
  },
}));

// --- Helpers ---

const resetStore = () => {
  useThreadsStore.setState({
    threadId: "initial-thread",
    threads: [],
  });
};

const makeThread = (overrides?: Partial<Thread>): Thread => ({
  threadId: crypto.randomUUID(),
  title: "Test Thread",
  lastEditDate: Date.now(),
  ...overrides,
});

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  mockStorage.threads.create.mockResolvedValue(undefined);
  mockStorage.threads.update.mockResolvedValue(undefined);
  mockStorage.threads.touch.mockResolvedValue(undefined);
  mockStorage.threads.delete.mockResolvedValue(undefined);
  mockStorage.messages.deleteByThread.mockResolvedValue(undefined);

  // Reset mutable profiles state
  profilesStoreState.profiles = [];
  profilesStoreState.chatProfile = null;
  profilesStoreState.defaultProfile = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe("useThreadsStore", () => {
  describe("initThreads", () => {
    it("loads threads from storage", async () => {
      const threads = [makeThread({ title: "A" }), makeThread({ title: "B" })];
      mockStorage.threads.getAll.mockResolvedValue(threads);

      await useThreadsStore.getState().initThreads();

      expect(useThreadsStore.getState().threads).toEqual(threads);
    });
  });

  describe("insertThread", () => {
    it("adds thread to state and persists", () => {
      useThreadsStore.setState({ threadId: "t1" });

      useThreadsStore.getState().insertThread("New Thread");

      const threads = useThreadsStore.getState().threads;
      expect(threads).toHaveLength(1);
      expect(threads[0].threadId).toBe("t1");
      expect(threads[0].title).toBe("New Thread");
      expect(mockStorage.threads.create).toHaveBeenCalledWith(
        "t1",
        "New Thread",
        undefined,
        undefined,
        undefined
      );
    });

    it("passes profileId when provided", () => {
      useThreadsStore.setState({ threadId: "t1" });

      useThreadsStore
        .getState()
        .insertThread("Thread", { profileId: "prof-1" });

      expect(useThreadsStore.getState().threads[0].profileId).toBe("prof-1");
      expect(mockStorage.threads.create).toHaveBeenCalledWith(
        "t1",
        "Thread",
        undefined,
        undefined,
        "prof-1"
      );
    });

    it("prepends to existing threads", () => {
      const existing = makeThread({ title: "Old" });
      useThreadsStore.setState({ threadId: "t2", threads: [existing] });

      useThreadsStore.getState().insertThread("New");

      expect(useThreadsStore.getState().threads).toHaveLength(2);
      expect(useThreadsStore.getState().threads[0].title).toBe("New");
    });
  });

  describe("insertNewMessageToThread", () => {
    it("updates lastEditDate and profileId for current thread", () => {
      const thread = makeThread({
        threadId: "t1",
        lastEditDate: 1000,
      });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });

      useThreadsStore.getState().insertNewMessageToThread({ profileId: "p1" });

      const updated = useThreadsStore.getState().threads[0];
      expect(updated.lastEditDate).toBeGreaterThan(1000);
      expect(updated.profileId).toBe("p1");
      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t1", {
        profileId: "p1",
      });
    });

    it("does not update other threads", () => {
      const t1 = makeThread({ threadId: "t1", title: "Current" });
      const t2 = makeThread({
        threadId: "t2",
        title: "Other",
        lastEditDate: 500,
      });
      useThreadsStore.setState({ threadId: "t1", threads: [t1, t2] });

      useThreadsStore.getState().insertNewMessageToThread();

      expect(useThreadsStore.getState().threads[1].lastEditDate).toBe(500);
    });
  });

  describe("migrateThreadFromProviderModelToProfile", () => {
    it("matches profile by type + baseUrl + modelId + key and strips legacy fields", () => {
      const profile = {
        id: "p1",
        name: "Test",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-123",
        modelId: "gpt-4",
      };

      profilesStoreState.profiles = [profile];
      profilesStoreState.chatProfile = null;
      profilesStoreState.defaultProfile = null;

      const legacyThread: Thread = makeThread({
        threadId: "t1",
        provider: {
          type: "openai",
          baseUrl: "https://api.openai.com",
          key: "sk-123",
        },
        model: { id: "gpt-4", name: "GPT-4" },
      });
      useThreadsStore.setState({ threads: [legacyThread] });

      const result = useThreadsStore
        .getState()
        .migrateThreadFromProviderModelToProfile(legacyThread);

      expect(result.profileId).toBe("p1");
      expect(result.provider).toBeUndefined();
      expect(result.model).toBeUndefined();
      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t1", {
        profileId: "p1",
        provider: null,
        model: null,
      });
    });

    it("does not modify other threads during migration", () => {
      profilesStoreState.profiles = [];
      profilesStoreState.chatProfile = null;
      profilesStoreState.defaultProfile = null;

      const legacyThread: Thread = makeThread({
        threadId: "t1",
        provider: { type: "openai", baseUrl: "https://api.openai.com" },
        model: { id: "gpt-4", name: "GPT-4" },
      });
      const otherThread = makeThread({ threadId: "t2", title: "Other" });
      useThreadsStore.setState({ threads: [legacyThread, otherThread] });

      useThreadsStore
        .getState()
        .migrateThreadFromProviderModelToProfile(legacyThread);

      expect(useThreadsStore.getState().threads[1].title).toBe("Other");
    });

    it("falls back to chatProfile when no exact match", () => {
      const chatProfile = {
        id: "chat-p",
        name: "Chat",
        providerType: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
        modelId: "claude",
      };

      profilesStoreState.profiles = [];
      profilesStoreState.chatProfile = chatProfile;
      profilesStoreState.defaultProfile = null;

      const legacyThread: Thread = makeThread({
        threadId: "t1",
        provider: { type: "openai", baseUrl: "https://unknown.com" },
        model: { id: "unknown", name: "Unknown" },
      });
      useThreadsStore.setState({ threads: [legacyThread] });

      const result = useThreadsStore
        .getState()
        .migrateThreadFromProviderModelToProfile(legacyThread);

      expect(result.profileId).toBe("chat-p");
    });
  });

  describe("onSwitchToNewThread", () => {
    it("generates new threadId and resets session profile", () => {
      useThreadsStore.setState({ threadId: "old" });

      useThreadsStore.getState().onSwitchToNewThread();

      expect(useThreadsStore.getState().threadId).not.toBe("old");
      expect(mockSetSessionChatProfile).toHaveBeenCalledWith(null);
    });
  });

  describe("onSwitchToThread", () => {
    it("switches to existing thread", () => {
      const thread = makeThread({ threadId: "t2", profileId: "p1" });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });
      mockGetProfileById.mockReturnValue({
        id: "p1",
        name: "Test",
        providerType: "openai",
      });

      useThreadsStore.getState().onSwitchToThread("t2");

      expect(useThreadsStore.getState().threadId).toBe("t2");
      expect(mockSetSessionChatProfile).toHaveBeenCalled();
    });

    it("triggers migration for legacy thread with provider/model", () => {
      const legacyThread = makeThread({
        threadId: "t2",
        provider: { type: "openai", baseUrl: "https://api.openai.com" },
        model: { id: "gpt-4", name: "GPT-4" },
      });
      useThreadsStore.setState({ threadId: "t1", threads: [legacyThread] });
      mockGetProfileById.mockReturnValue(null);

      useThreadsStore.getState().onSwitchToThread("t2");

      expect(useThreadsStore.getState().threadId).toBe("t2");
      // Migration should have been called (touch with null provider/model)
      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t2", {
        profileId: null,
        provider: null,
        model: null,
      });
    });

    it("sets null session profile when thread has no profileId", () => {
      const thread = makeThread({ threadId: "t2" });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });
      mockGetProfileById.mockReturnValue(null);

      useThreadsStore.getState().onSwitchToThread("t2");

      expect(mockSetSessionChatProfile).toHaveBeenCalledWith(null);
    });
  });

  describe("onDownloadThread", () => {
    it("downloads thread as file via platform", async () => {
      const thread = makeThread({ threadId: "t1", title: "My Chat" });
      useThreadsStore.setState({ threads: [thread] });

      const messages: ThreadMessageLike[] = [
        { role: "user", content: [{ type: "text", text: "Hello" }] },
        { role: "assistant", content: [{ type: "text", text: "Hi" }] },
      ];
      mockStorage.messages.getByThread.mockResolvedValue(messages);

      await useThreadsStore.getState().onDownloadThread("t1");

      expect(mockStorage.messages.getByThread).toHaveBeenCalledWith("t1");
      expect(mockPlatform.file.saveAsFile).toHaveBeenCalledWith(
        expect.any(String),
        "My Chat.docx"
      );
    });

    it("uses fallback title when thread not found", async () => {
      useThreadsStore.setState({ threads: [] });
      mockStorage.messages.getByThread.mockResolvedValue([]);

      await useThreadsStore.getState().onDownloadThread("nonexistent");

      expect(mockPlatform.file.saveAsFile).toHaveBeenCalledWith(
        expect.any(String),
        "Chat Export.docx"
      );
    });
  });

  describe("onRenameThread", () => {
    it("updates thread title in state and storage", () => {
      const thread = makeThread({ threadId: "t1", title: "Old" });
      useThreadsStore.setState({ threads: [thread] });

      useThreadsStore.getState().onRenameThread("t1", "New Title");

      expect(useThreadsStore.getState().threads[0].title).toBe("New Title");
      expect(mockStorage.threads.update).toHaveBeenCalledWith(
        "t1",
        "New Title"
      );
    });

    it("does not modify other threads", () => {
      const t1 = makeThread({ threadId: "t1", title: "A" });
      const t2 = makeThread({ threadId: "t2", title: "B" });
      useThreadsStore.setState({ threads: [t1, t2] });

      useThreadsStore.getState().onRenameThread("t1", "Renamed");

      expect(useThreadsStore.getState().threads[1].title).toBe("B");
    });
  });

  describe("onDeleteThread", () => {
    it("removes thread and messages from storage", () => {
      const thread = makeThread({ threadId: "t2" });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });

      useThreadsStore.getState().onDeleteThread("t2");

      expect(useThreadsStore.getState().threads).toHaveLength(0);
      expect(mockStorage.messages.deleteByThread).toHaveBeenCalledWith("t2");
    });

    it("switches to new thread when deleting current", () => {
      const thread = makeThread({ threadId: "t1" });
      useThreadsStore.setState({ threadId: "t1", threads: [thread] });

      useThreadsStore.getState().onDeleteThread("t1");

      expect(useThreadsStore.getState().threadId).not.toBe("t1");
      expect(mockSetSessionChatProfile).toHaveBeenCalledWith(null);
    });
  });

  describe("onClearThreadHistory", () => {
    it("deletes messages from storage", async () => {
      useThreadsStore.setState({ threadId: "t1" });

      await useThreadsStore.getState().onClearThreadHistory("t1");

      expect(mockStorage.messages.deleteByThread).toHaveBeenCalledWith("t1");
    });

    it("clears message store if clearing current thread", async () => {
      useThreadsStore.setState({ threadId: "t1" });

      await useThreadsStore.getState().onClearThreadHistory("t1");

      expect(mockClearMessages).toHaveBeenCalledOnce();
    });

    it("does not clear message store if clearing different thread", async () => {
      useThreadsStore.setState({ threadId: "t1" });

      await useThreadsStore.getState().onClearThreadHistory("t2");

      expect(mockClearMessages).not.toHaveBeenCalled();
    });
  });
});
