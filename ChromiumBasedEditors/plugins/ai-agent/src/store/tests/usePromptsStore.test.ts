import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import usePromptsStore from "../usePromptsStore";

// --- Mocks ---

const mockStorage = {
  prompts: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    deleteByFolder: vi.fn(),
  },
  promptFolders: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
  },
};

vi.mock("../../../npm_lib/storage/storage-holder", () => ({
  getStorageInstance: () => mockStorage,
}));

// --- Helpers ---

const resetStore = () => {
  usePromptsStore.setState({ prompts: [], folders: [] });
};

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  mockStorage.prompts.create.mockResolvedValue(undefined);
  mockStorage.prompts.update.mockResolvedValue(undefined);
  mockStorage.prompts.delete.mockResolvedValue(undefined);
  mockStorage.promptFolders.create.mockResolvedValue(undefined);
  mockStorage.promptFolders.update.mockResolvedValue(undefined);
  mockStorage.promptFolders.delete.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe("usePromptsStore", () => {
  describe("initPrompts", () => {
    it("loads prompts and folders from storage", async () => {
      const prompts = [
        { id: "p1", name: "test", text: "hello", createdAt: 1, updatedAt: 1 },
      ];
      const folders = [
        { id: "f1", name: "folder", createdAt: 1, updatedAt: 1 },
      ];
      mockStorage.prompts.getAll.mockResolvedValue(prompts);
      mockStorage.promptFolders.getAll.mockResolvedValue(folders);

      await usePromptsStore.getState().initPrompts();

      expect(usePromptsStore.getState().prompts).toEqual(prompts);
      expect(usePromptsStore.getState().folders).toEqual(folders);
    });
  });

  describe("addPrompt", () => {
    it("creates prompt with auto-generated name from first 15 chars", () => {
      const text = "This is a long prompt text that exceeds fifteen characters";

      usePromptsStore.getState().addPrompt(text);

      const prompts = usePromptsStore.getState().prompts;
      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe("This is a long ");
      expect(prompts[0].text).toBe(text);
      expect(prompts[0].id).toBeTruthy();
      expect(prompts[0].createdAt).toBeGreaterThan(0);
      expect(prompts[0].updatedAt).toBe(prompts[0].createdAt);
    });

    it("creates prompt with folderId when provided", () => {
      usePromptsStore.getState().addPrompt("test", "folder-1");

      const prompts = usePromptsStore.getState().prompts;
      expect(prompts[0].folderId).toBe("folder-1");
    });

    it("creates prompt without folderId when not provided", () => {
      usePromptsStore.getState().addPrompt("test");

      const prompts = usePromptsStore.getState().prompts;
      expect(prompts[0].folderId).toBeUndefined();
    });

    it("persists to storage", () => {
      usePromptsStore.getState().addPrompt("test");

      expect(mockStorage.prompts.create).toHaveBeenCalledOnce();
    });

    it("prepends new prompt to list", () => {
      usePromptsStore.getState().addPrompt("first");
      usePromptsStore.getState().addPrompt("second");

      const prompts = usePromptsStore.getState().prompts;
      expect(prompts[0].text).toBe("second");
      expect(prompts[1].text).toBe("first");
    });
  });

  describe("editPrompt", () => {
    it("updates name field", () => {
      usePromptsStore.getState().addPrompt("original");
      const id = usePromptsStore.getState().prompts[0].id;

      usePromptsStore.getState().editPrompt(id, { name: "new name" });

      expect(usePromptsStore.getState().prompts[0].name).toBe("new name");
    });

    it("updates text field", () => {
      usePromptsStore.getState().addPrompt("original");
      const id = usePromptsStore.getState().prompts[0].id;

      usePromptsStore.getState().editPrompt(id, { text: "updated text" });

      expect(usePromptsStore.getState().prompts[0].text).toBe("updated text");
    });

    it("updates folderId", () => {
      usePromptsStore.getState().addPrompt("test");
      const id = usePromptsStore.getState().prompts[0].id;

      usePromptsStore.getState().editPrompt(id, { folderId: "f1" });
      expect(usePromptsStore.getState().prompts[0].folderId).toBe("f1");

      usePromptsStore.getState().editPrompt(id, { folderId: null });
      expect(usePromptsStore.getState().prompts[0].folderId).toBeUndefined();
    });

    it("bumps updatedAt timestamp", () => {
      usePromptsStore.getState().addPrompt("test");
      const id = usePromptsStore.getState().prompts[0].id;
      const originalUpdatedAt = usePromptsStore.getState().prompts[0].updatedAt;

      // Small delay to ensure timestamp differs
      vi.spyOn(Date, "now").mockReturnValue(originalUpdatedAt + 1000);
      usePromptsStore.getState().editPrompt(id, { name: "new" });

      expect(usePromptsStore.getState().prompts[0].updatedAt).toBeGreaterThan(
        originalUpdatedAt
      );
    });

    it("does not modify other prompts", () => {
      usePromptsStore.getState().addPrompt("first");
      usePromptsStore.getState().addPrompt("second");
      const secondId = usePromptsStore.getState().prompts[0].id;
      const firstName = usePromptsStore.getState().prompts[1].name;

      usePromptsStore.getState().editPrompt(secondId, { name: "changed" });

      expect(usePromptsStore.getState().prompts[1].name).toBe(firstName);
    });

    it("persists to storage", () => {
      usePromptsStore.getState().addPrompt("test");
      const id = usePromptsStore.getState().prompts[0].id;

      usePromptsStore.getState().editPrompt(id, { name: "new" });

      expect(mockStorage.prompts.update).toHaveBeenCalledWith(id, {
        name: "new",
      });
    });
  });

  describe("removePrompt", () => {
    it("removes prompt from state", () => {
      usePromptsStore.getState().addPrompt("first");
      usePromptsStore.getState().addPrompt("second");
      const id = usePromptsStore.getState().prompts[0].id;

      usePromptsStore.getState().removePrompt(id);

      expect(usePromptsStore.getState().prompts).toHaveLength(1);
    });

    it("persists deletion to storage", () => {
      usePromptsStore.getState().addPrompt("test");
      const id = usePromptsStore.getState().prompts[0].id;

      usePromptsStore.getState().removePrompt(id);

      expect(mockStorage.prompts.delete).toHaveBeenCalledWith(id);
    });
  });

  describe("addFolder", () => {
    it("creates folder and returns id", () => {
      const id = usePromptsStore.getState().addFolder("My Folder");

      expect(id).toBeTruthy();
      const folders = usePromptsStore.getState().folders;
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe("My Folder");
      expect(folders[0].id).toBe(id);
    });

    it("persists folder to storage", () => {
      usePromptsStore.getState().addFolder("test");

      expect(mockStorage.promptFolders.create).toHaveBeenCalledOnce();
    });
  });

  describe("renameFolder", () => {
    it("updates folder name", () => {
      const id = usePromptsStore.getState().addFolder("old");

      usePromptsStore.getState().renameFolder(id, "new");

      expect(usePromptsStore.getState().folders[0].name).toBe("new");
    });

    it("bumps updatedAt", () => {
      const id = usePromptsStore.getState().addFolder("test");
      const original = usePromptsStore.getState().folders[0].updatedAt;

      vi.spyOn(Date, "now").mockReturnValue(original + 1000);
      usePromptsStore.getState().renameFolder(id, "new");

      expect(usePromptsStore.getState().folders[0].updatedAt).toBeGreaterThan(
        original
      );
    });

    it("does not modify other folders", () => {
      const id1 = usePromptsStore.getState().addFolder("first");
      usePromptsStore.getState().addFolder("second");

      usePromptsStore.getState().renameFolder(id1, "renamed");

      // folders are prepended, so index 0 is "second" (newer), index 1 is "first" (older)
      // id1 = "first" which is at index 1. After rename, "second" at index 0 should be unchanged.
      expect(usePromptsStore.getState().folders[0].name).toBe("second");
    });
  });

  describe("removeFolder", () => {
    it("removes folder and all prompts in it", () => {
      const folderId = usePromptsStore.getState().addFolder("folder");
      usePromptsStore.getState().addPrompt("inside folder", folderId);
      usePromptsStore.getState().addPrompt("outside folder");

      usePromptsStore.getState().removeFolder(folderId);

      expect(usePromptsStore.getState().folders).toHaveLength(0);
      expect(usePromptsStore.getState().prompts).toHaveLength(1);
      expect(usePromptsStore.getState().prompts[0].text).toBe("outside folder");
    });

    it("persists deletion to storage", () => {
      const id = usePromptsStore.getState().addFolder("test");

      usePromptsStore.getState().removeFolder(id);

      expect(mockStorage.promptFolders.delete).toHaveBeenCalledWith(id);
    });
  });
});
