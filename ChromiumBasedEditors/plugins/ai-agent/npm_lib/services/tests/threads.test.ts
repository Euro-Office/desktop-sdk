import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile, Thread } from "../../types";

// ---------------------------------------------------------------------------
// Mocks — hoisted before module evaluation
// ---------------------------------------------------------------------------

const mockStorage = {
  threads: {
    getAll: vi.fn(),
    create: vi.fn(),
    touch: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  messages: {
    getByThread: vi.fn(),
    deleteByThread: vi.fn(),
  },
};

const mockPlatform = {
  file: { saveAsFile: vi.fn() },
  process: null,
  env: { platform: "desktop" },
  hostTools: null,
};

const mockCtx = {
  storage: mockStorage,
  platform: mockPlatform,
  settings: {} as never,
  provider: {} as never,
  servers: {} as never,
  eventBus: {} as never,
};

vi.mock("../../utils", () => ({
  convertMessagesToMd: vi.fn(() => "# Exported content"),
  removeSpecialCharacter: vi.fn((s: string) => s.replace(/[\\/:*"<>|?]/g, "")),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeThread = (overrides: Partial<Thread> = {}): Thread => ({
  threadId: "thread-1",
  title: "Test Thread",
  lastEditDate: 1000,
  ...overrides,
});

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: "profile-1",
  name: "Default Profile",
  providerType: "openai",
  baseUrl: "https://api.openai.com",
  key: "sk-test",
  modelId: "gpt-4",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThreadsService", () => {
  let service: InstanceType<typeof import("../threads").ThreadsService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage.threads.getAll.mockResolvedValue([]);
    mockStorage.threads.create.mockResolvedValue(undefined);
    mockStorage.threads.touch.mockResolvedValue(undefined);
    mockStorage.threads.update.mockResolvedValue(undefined);
    mockStorage.threads.delete.mockResolvedValue(undefined);
    mockStorage.messages.getByThread.mockResolvedValue([]);
    mockStorage.messages.deleteByThread.mockResolvedValue(undefined);

    const { ThreadsService } = await import("../threads");
    service = new ThreadsService(mockCtx as any);
  });

  // -----------------------------------------------------------------------
  // loadAll
  // -----------------------------------------------------------------------

  describe("loadAll", () => {
    it("calls getAll and returns threads", async () => {
      const threads = [makeThread()];
      mockStorage.threads.getAll.mockResolvedValue(threads);

      const result = await service.loadAll();

      expect(mockStorage.threads.getAll).toHaveBeenCalledOnce();
      expect(result).toEqual(threads);
    });
  });

  // -----------------------------------------------------------------------
  // createThread
  // -----------------------------------------------------------------------

  describe("createThread", () => {
    it("creates thread with lastEditDate, calls storage.create, returns thread", () => {
      const result = service.createThread("t-1", "My Chat", "profile-1");

      expect(result.threadId).toBe("t-1");
      expect(result.title).toBe("My Chat");
      expect(result.profileId).toBe("profile-1");
      expect(result.lastEditDate).toBeTypeOf("number");
      expect(mockStorage.threads.create).toHaveBeenCalledWith(
        "t-1",
        "My Chat",
        undefined,
        undefined,
        "profile-1"
      );
    });

    it("creates thread without profileId when omitted", () => {
      const result = service.createThread("t-2", "No Profile");

      expect(result.profileId).toBeUndefined();
      expect(mockStorage.threads.create).toHaveBeenCalledWith(
        "t-2",
        "No Profile",
        undefined,
        undefined,
        undefined
      );
    });
  });

  // -----------------------------------------------------------------------
  // touchThread
  // -----------------------------------------------------------------------

  describe("touchThread", () => {
    it("calls storage.touch with profileId updates", () => {
      service.touchThread("t-1", { profileId: "profile-2" });

      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t-1", {
        profileId: "profile-2",
      });
    });

    it("calls touch with empty object when no updates provided", () => {
      service.touchThread("t-1");

      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t-1", {});
    });
  });

  // -----------------------------------------------------------------------
  // migrateThreadToProfile
  // -----------------------------------------------------------------------

  describe("migrateThreadToProfile", () => {
    const threadWithProvider = makeThread({
      threadId: "t-migrate",
      provider: {
        type: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
      },
      model: { id: "gpt-4", name: "GPT-4" },
    });

    it("uses exact match (provider+model+key)", () => {
      const exactProfile = makeProfile({
        id: "exact",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
      });
      const partialProfile = makeProfile({
        id: "partial",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-other",
        modelId: "gpt-4",
      });
      const chatProfile = makeProfile({ id: "chat" });
      const defaultProfile = makeProfile({ id: "default" });

      const result = service.migrateThreadToProfile(
        threadWithProvider,
        [partialProfile, exactProfile],
        chatProfile,
        defaultProfile
      );

      expect(result.profileId).toBe("exact");
      expect(result.provider).toBeUndefined();
      expect(result.model).toBeUndefined();
      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t-migrate", {
        profileId: "exact",
        provider: null,
        model: null,
      });
    });

    it("uses partial match (provider+model, different key)", () => {
      const partialProfile = makeProfile({
        id: "partial",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-different",
        modelId: "gpt-4",
      });
      const chatProfile = makeProfile({ id: "chat" });

      const result = service.migrateThreadToProfile(
        threadWithProvider,
        [partialProfile],
        chatProfile,
        null
      );

      expect(result.profileId).toBe("partial");
    });

    it("falls back to chatProfile when no match", () => {
      const unrelatedProfile = makeProfile({
        id: "unrelated",
        providerType: "anthropic",
        modelId: "claude-3",
      });
      const chatProfile = makeProfile({ id: "chat-fallback" });

      const result = service.migrateThreadToProfile(
        threadWithProvider,
        [unrelatedProfile],
        chatProfile,
        null
      );

      expect(result.profileId).toBe("chat-fallback");
    });

    it("falls back to defaultProfile when no chatProfile", () => {
      const defaultProfile = makeProfile({ id: "default-fallback" });

      const result = service.migrateThreadToProfile(
        threadWithProvider,
        [],
        null,
        defaultProfile
      );

      expect(result.profileId).toBe("default-fallback");
    });

    it("calls storage.touch to clear provider/model", () => {
      service.migrateThreadToProfile(threadWithProvider, [], null, null);

      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t-migrate", {
        profileId: null,
        provider: null,
        model: null,
      });
    });
  });

  // -----------------------------------------------------------------------
  // downloadThread
  // -----------------------------------------------------------------------

  describe("downloadThread", () => {
    it("fetches messages, converts to md, calls saveAsFile", async () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];
      mockStorage.messages.getByThread.mockResolvedValue(messages);

      await service.downloadThread("t-1", "My Chat");

      expect(mockStorage.messages.getByThread).toHaveBeenCalledWith("t-1");
      expect(mockPlatform.file.saveAsFile).toHaveBeenCalledWith(
        "# Exported content",
        "My Chat.docx"
      );
    });

    it("uses default title when threadTitle is undefined", async () => {
      mockStorage.messages.getByThread.mockResolvedValue([]);

      await service.downloadThread("t-1");

      expect(mockPlatform.file.saveAsFile).toHaveBeenCalledWith(
        expect.any(String),
        "Chat Export.docx"
      );
    });
  });

  // -----------------------------------------------------------------------
  // renameThread
  // -----------------------------------------------------------------------

  describe("renameThread", () => {
    it("calls storage.update with id and title", () => {
      service.renameThread("t-1", "New Title");

      expect(mockStorage.threads.update).toHaveBeenCalledWith(
        "t-1",
        "New Title"
      );
    });
  });

  // -----------------------------------------------------------------------
  // deleteThread
  // -----------------------------------------------------------------------

  describe("deleteThread", () => {
    it("deletes messages first, then deletes thread", async () => {
      const callOrder: string[] = [];
      mockStorage.messages.deleteByThread.mockImplementation(async () => {
        callOrder.push("deleteMessages");
      });
      mockStorage.threads.delete.mockImplementation(async () => {
        callOrder.push("deleteThread");
      });

      await service.deleteThread("t-1");

      expect(callOrder).toEqual(["deleteMessages", "deleteThread"]);
      expect(mockStorage.messages.deleteByThread).toHaveBeenCalledWith("t-1");
      expect(mockStorage.threads.delete).toHaveBeenCalledWith("t-1");
    });
  });

  // -----------------------------------------------------------------------
  // clearHistory
  // -----------------------------------------------------------------------

  describe("clearHistory", () => {
    it("deletes only messages, not the thread", async () => {
      await service.clearHistory("t-1");

      expect(mockStorage.messages.deleteByThread).toHaveBeenCalledWith("t-1");
      expect(mockStorage.threads.delete).not.toHaveBeenCalled();
    });
  });
});
