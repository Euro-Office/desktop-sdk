import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { PromptsService } from "../services/prompts";
import type { Prompt, PromptFolder } from "../types";

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

export function createPromptsStore(deps: {
  promptsService: PromptsService;
}): UseBoundStore<StoreApi<PromptsStoreState>> {
  const { promptsService } = deps;

  return create<PromptsStoreState>((set, get) => ({
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
      const currentPrompts = get().prompts;
      const updatedPrompts = promptsService.deleteFolder(id, currentPrompts);
      set({
        folders: get().folders.filter((f) => f.id !== id),
        prompts: updatedPrompts,
      });
    },
  }));
}
