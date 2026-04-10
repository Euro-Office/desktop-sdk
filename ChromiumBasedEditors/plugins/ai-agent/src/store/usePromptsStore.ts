import { create } from "zustand";
import type { Prompt, PromptFolder } from "@/lib/types";
import { PromptsService } from "../../npm_lib/services/prompts";

const service = new PromptsService();

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
    const { prompts, folders } = await service.loadAll();
    set({ prompts, folders });
  },

  addPrompt: (text: string, folderId?: string) => {
    const prompt = service.createPrompt(text, folderId);
    set({ prompts: [prompt, ...get().prompts] });
  },

  editPrompt: (id, updates) => {
    const prompts = service.updatePrompt(get().prompts, id, updates);
    set({ prompts });
  },

  removePrompt: (id) => {
    set({ prompts: get().prompts.filter((p) => p.id !== id) });
    service.deletePrompt(id);
  },

  addFolder: (name: string) => {
    const folder = service.createFolder(name);
    set({ folders: [folder, ...get().folders] });
    return folder.id;
  },

  renameFolder: (id, name) => {
    const folders = service.renameFolder(get().folders, id, name);
    set({ folders });
  },

  removeFolder: (id) => {
    set({
      folders: get().folders.filter((f) => f.id !== id),
      prompts: get().prompts.filter((p) => p.folderId !== id),
    });
    service.deleteFolder(id);
  },
}));

export default usePromptsStore;
