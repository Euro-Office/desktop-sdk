import type { Prompt, PromptFolder } from "../../../src/lib/types";
import type { PromptFoldersStorage, PromptsStorage } from "../types";

export class IndexedDBPromptsStorage implements PromptsStorage {
  constructor(private getDB: () => IDBDatabase) {}

  async create(prompt: Prompt): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["prompts"], "readwrite");
      const store = transaction.objectStore("prompts");
      const request = store.put(prompt);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAll(): Promise<Prompt[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["prompts"], "readonly");
      const store = transaction.objectStore("prompts");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const prompts = request.result.sort(
          (a: Prompt, b: Prompt) => b.createdAt - a.createdAt,
        );
        resolve(prompts);
      };
    });
  }

  async getById(id: string): Promise<Prompt | null> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["prompts"], "readonly");
      const store = transaction.objectStore("prompts");
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null },
  ): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["prompts"], "readwrite");
      const store = transaction.objectStore("prompts");
      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error("Prompt not found"));
          return;
        }

        const updatedPrompt: Prompt = {
          ...existing,
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.text !== undefined && { text: updates.text }),
          ...(updates.folderId !== undefined && {
            folderId: updates.folderId ?? undefined,
          }),
          updatedAt: Date.now(),
        };

        const putRequest = store.put(updatedPrompt);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async delete(id: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["prompts"], "readwrite");
      const store = transaction.objectStore("prompts");
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteByFolder(folderId: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["prompts"], "readwrite");
      const store = transaction.objectStore("prompts");
      const index = store.index("folderId");
      const request = index.openCursor(IDBKeyRange.only(folderId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}

export class IndexedDBPromptFoldersStorage implements PromptFoldersStorage {
  constructor(
    private getDB: () => IDBDatabase,
    private prompts: IndexedDBPromptsStorage,
  ) {}

  async create(folder: PromptFolder): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["promptFolders"], "readwrite");
      const store = transaction.objectStore("promptFolders");
      const request = store.put(folder);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAll(): Promise<PromptFolder[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["promptFolders"], "readonly");
      const store = transaction.objectStore("promptFolders");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const folders = request.result.sort(
          (a: PromptFolder, b: PromptFolder) => b.createdAt - a.createdAt,
        );
        resolve(folders);
      };
    });
  }

  async getById(id: string): Promise<PromptFolder | null> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["promptFolders"], "readonly");
      const store = transaction.objectStore("promptFolders");
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async update(id: string, name: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["promptFolders"], "readwrite");
      const store = transaction.objectStore("promptFolders");
      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error("Prompt folder not found"));
          return;
        }

        const updatedFolder: PromptFolder = {
          ...existing,
          name,
          updatedAt: Date.now(),
        };

        const putRequest = store.put(updatedFolder);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async delete(id: string): Promise<void> {
    await this.prompts.deleteByFolder(id);

    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["promptFolders"], "readwrite");
      const store = transaction.objectStore("promptFolders");
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
