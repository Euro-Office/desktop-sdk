import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prompt, PromptFolder } from "../../types";

// ---------------------------------------------------------------------------
// Mocks — hoisted before module evaluation
// ---------------------------------------------------------------------------

const mockStorage = {
  prompts: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  promptFolders: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockCtx = {
  storage: mockStorage,
  settings: {} as never,
  platform: {} as never,
  provider: {} as never,
  servers: {} as never,
  eventBus: {} as never,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: "prompt-1",
  name: "hello world",
  text: "hello world, how are you?",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const makeFolder = (overrides: Partial<PromptFolder> = {}): PromptFolder => ({
  id: "folder-1",
  name: "My Folder",
  createdAt: 2000,
  updatedAt: 2000,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptsService", () => {
  let service: InstanceType<typeof import("../prompts").PromptsService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Resolve promises by default so .catch() doesn't blow up
    mockStorage.prompts.create.mockResolvedValue(undefined);
    mockStorage.prompts.update.mockResolvedValue(undefined);
    mockStorage.prompts.delete.mockResolvedValue(undefined);
    mockStorage.promptFolders.create.mockResolvedValue(undefined);
    mockStorage.promptFolders.update.mockResolvedValue(undefined);
    mockStorage.promptFolders.delete.mockResolvedValue(undefined);

    const { PromptsService } = await import("../prompts");
    service = new PromptsService(mockCtx as any);
  });

  // -----------------------------------------------------------------------
  // loadAll
  // -----------------------------------------------------------------------

  describe("loadAll", () => {
    it("calls getAll on both stores and returns combined result", async () => {
      const prompts = [makePrompt()];
      const folders = [makeFolder()];
      mockStorage.prompts.getAll.mockResolvedValue(prompts);
      mockStorage.promptFolders.getAll.mockResolvedValue(folders);

      const result = await service.loadAll();

      expect(mockStorage.prompts.getAll).toHaveBeenCalledOnce();
      expect(mockStorage.promptFolders.getAll).toHaveBeenCalledOnce();
      expect(result).toEqual({ prompts, folders });
    });
  });

  // -----------------------------------------------------------------------
  // createPrompt
  // -----------------------------------------------------------------------

  describe("createPrompt", () => {
    it("generates id, truncates name to 15 chars, calls storage.create, returns prompt with timestamps", () => {
      const text =
        "This is a really long prompt text that exceeds fifteen characters";
      const result = service.createPrompt(text, "folder-1");

      expect(result.id).toBeDefined();
      expect(result.name).toBe(text.slice(0, 15));
      expect(result.text).toBe(text);
      expect(result.folderId).toBe("folder-1");
      expect(result.createdAt).toBeTypeOf("number");
      expect(result.updatedAt).toBeTypeOf("number");
      expect(result.createdAt).toBe(result.updatedAt);
      expect(mockStorage.prompts.create).toHaveBeenCalledWith(result);
    });

    it("omits folderId when not provided", () => {
      const result = service.createPrompt("short text");

      expect(result.folderId).toBeUndefined();
      expect(mockStorage.prompts.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ folderId: expect.anything() })
      );
    });
  });

  // -----------------------------------------------------------------------
  // updatePrompt
  // -----------------------------------------------------------------------

  describe("updatePrompt", () => {
    it("returns new array with updated prompt and calls storage.update", () => {
      const p1 = makePrompt({ id: "p1", name: "old" });
      const p2 = makePrompt({ id: "p2", name: "other" });

      const result = service.updatePrompt([p1, p2], "p1", {
        name: "new name",
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("new name");
      expect(result[0].updatedAt).toBeGreaterThanOrEqual(p1.updatedAt);
      // Second prompt untouched
      expect(result[1]).toBe(p2);
      expect(mockStorage.prompts.update).toHaveBeenCalledWith("p1", {
        name: "new name",
      });
    });

    it("sets folderId to undefined when updates contain folderId: null", () => {
      const p = makePrompt({ id: "p1", folderId: "folder-1" });

      const result = service.updatePrompt([p], "p1", { folderId: null });

      expect(result[0].folderId).toBeUndefined();
      expect(mockStorage.prompts.update).toHaveBeenCalledWith("p1", {
        folderId: null,
      });
    });
  });

  // -----------------------------------------------------------------------
  // deletePrompt
  // -----------------------------------------------------------------------

  describe("deletePrompt", () => {
    it("calls storage.delete with the id", () => {
      service.deletePrompt("p1");

      expect(mockStorage.prompts.delete).toHaveBeenCalledWith("p1");
    });
  });

  // -----------------------------------------------------------------------
  // createFolder
  // -----------------------------------------------------------------------

  describe("createFolder", () => {
    it("generates id, timestamps, calls storage, returns folder", () => {
      const result = service.createFolder("New Folder");

      expect(result.id).toBeDefined();
      expect(result.name).toBe("New Folder");
      expect(result.createdAt).toBeTypeOf("number");
      expect(result.updatedAt).toBeTypeOf("number");
      expect(result.createdAt).toBe(result.updatedAt);
      expect(mockStorage.promptFolders.create).toHaveBeenCalledWith(result);
    });
  });

  // -----------------------------------------------------------------------
  // renameFolder
  // -----------------------------------------------------------------------

  describe("renameFolder", () => {
    it("returns new array with renamed folder and calls storage.update", () => {
      const f1 = makeFolder({ id: "f1", name: "Old" });
      const f2 = makeFolder({ id: "f2", name: "Other" });

      const result = service.renameFolder([f1, f2], "f1", "Renamed");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Renamed");
      expect(result[0].updatedAt).toBeGreaterThanOrEqual(f1.updatedAt);
      expect(result[1]).toBe(f2);
      expect(mockStorage.promptFolders.update).toHaveBeenCalledWith(
        "f1",
        "Renamed"
      );
    });
  });

  // -----------------------------------------------------------------------
  // deleteFolder
  // -----------------------------------------------------------------------

  describe("deleteFolder", () => {
    it("calls storage.delete with the id and resets orphaned prompts", () => {
      const prompts = [
        {
          id: "p1",
          name: "in folder",
          text: "t",
          folderId: "f1",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "p2",
          name: "other",
          text: "t",
          folderId: "f2",
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      const result = service.deleteFolder("f1", prompts);

      expect(mockStorage.promptFolders.delete).toHaveBeenCalledWith("f1");
      expect(mockStorage.prompts.update).toHaveBeenCalledWith("p1", {
        folderId: null,
      });
      expect(result[0].folderId).toBeUndefined();
      expect(result[1].folderId).toBe("f2");
    });
  });
});
