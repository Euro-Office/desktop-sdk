import { create } from "zustand";
import type { Prompt, PromptFolder } from "@/lib/types";
import { getStorageInstance } from "../../npm_lib/storage/storage-holder";

type UsePromptsStoreProps = {
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
};

const usePromptsStore = create<UsePromptsStoreProps>((set, get) => ({
  prompts: [],
  folders: [],

  initPrompts: async () => {
    const storage = getStorageInstance();
    const [prompts, folders] = await Promise.all([
      storage.prompts.getAll(),
      storage.promptFolders.getAll(),
    ]);
    set({ prompts, folders });
  },

  addPrompt: (text: string, folderId?: string) => {
    const id = crypto.randomUUID();
    const name = text.slice(0, 15);
    const now = Date.now();

    const prompt: Prompt = {
      id,
      name,
      text,
      ...(folderId && { folderId }),
      createdAt: now,
      updatedAt: now,
    };

    set({ prompts: [prompt, ...get().prompts] });
    getStorageInstance().prompts.create(prompt).catch(console.error);
  },

  editPrompt: (id, updates) => {
    set({
      prompts: get().prompts.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.text !== undefined && { text: updates.text }),
          ...(updates.folderId !== undefined && {
            folderId: updates.folderId ?? undefined,
          }),
          updatedAt: Date.now(),
        };
      }),
    });
    getStorageInstance().prompts.update(id, updates).catch(console.error);
  },

  removePrompt: (id) => {
    set({ prompts: get().prompts.filter((p) => p.id !== id) });
    getStorageInstance().prompts.delete(id).catch(console.error);
  },

  addFolder: (name: string) => {
    const id = crypto.randomUUID();
    const now = Date.now();

    const folder: PromptFolder = { id, name, createdAt: now, updatedAt: now };

    set({ folders: [folder, ...get().folders] });
    getStorageInstance().promptFolders.create(folder).catch(console.error);
    return id;
  },

  renameFolder: (id, name) => {
    set({
      folders: get().folders.map((f) => {
        if (f.id !== id) return f;
        return { ...f, name, updatedAt: Date.now() };
      }),
    });
    getStorageInstance().promptFolders.update(id, name).catch(console.error);
  },

  removeFolder: (id) => {
    set({
      folders: get().folders.filter((f) => f.id !== id),
      prompts: get().prompts.filter((p) => p.folderId !== id),
    });
    getStorageInstance().promptFolders.delete(id).catch(console.error);
  },
}));

export default usePromptsStore;
