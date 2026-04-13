import { getStorageInstance } from "../storage/storage-holder";
import type { Prompt, PromptFolder } from "../types";

export type PromptUpdates = {
  name?: string;
  text?: string;
  folderId?: string | null;
};

export class PromptsService {
  async loadAll(): Promise<{ prompts: Prompt[]; folders: PromptFolder[] }> {
    const storage = getStorageInstance();
    const [prompts, folders] = await Promise.all([
      storage.prompts.getAll(),
      storage.promptFolders.getAll(),
    ]);
    return { prompts, folders };
  }

  createPrompt(text: string, folderId?: string): Prompt {
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

    getStorageInstance().prompts.create(prompt).catch(console.error);
    return prompt;
  }

  updatePrompt(
    prompts: Prompt[],
    id: string,
    updates: PromptUpdates
  ): Prompt[] {
    getStorageInstance().prompts.update(id, updates).catch(console.error);
    return prompts.map((p) => {
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
    });
  }

  deletePrompt(id: string): void {
    getStorageInstance().prompts.delete(id).catch(console.error);
  }

  createFolder(name: string): PromptFolder {
    const id = crypto.randomUUID();
    const now = Date.now();
    const folder: PromptFolder = { id, name, createdAt: now, updatedAt: now };
    getStorageInstance().promptFolders.create(folder).catch(console.error);
    return folder;
  }

  renameFolder(
    folders: PromptFolder[],
    id: string,
    name: string
  ): PromptFolder[] {
    getStorageInstance().promptFolders.update(id, name).catch(console.error);
    return folders.map((f) => {
      if (f.id !== id) return f;
      return { ...f, name, updatedAt: Date.now() };
    });
  }

  deleteFolder(id: string, prompts: Prompt[]): Prompt[] {
    getStorageInstance().promptFolders.delete(id).catch(console.error);
    // Reset folderId on orphaned prompts
    const updated = prompts.map((p) => {
      if (p.folderId !== id) return p;
      getStorageInstance()
        .prompts.update(p.id, { folderId: null })
        .catch(console.error);
      return { ...p, folderId: undefined };
    });
    return updated;
  }
}
