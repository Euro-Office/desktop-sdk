import type { Prompt } from "@/lib/types";
import { chatDB } from "./index";

// Create prompt
export const createPrompt = async (prompt: Prompt): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["prompts"], "readwrite");
    const store = transaction.objectStore("prompts");
    const request = store.put(prompt);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Read single prompt
export const readPrompt = async (id: string): Promise<Prompt | null> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["prompts"], "readonly");
    const store = transaction.objectStore("prompts");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

// Read all prompts sorted by createdAt (latest first)
export const readAllPrompts = async (): Promise<Prompt[]> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["prompts"], "readonly");
    const store = transaction.objectStore("prompts");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const prompts = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(prompts);
    };
  });
};

// Update prompt
export const updatePrompt = async (
  id: string,
  updates: { name?: string; text?: string; folderId?: string | null }
): Promise<void> => {
  const db = chatDB.getDB();

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
};

// Delete all prompts in a folder
export const deletePromptsByFolderId = async (
  folderId: string
): Promise<void> => {
  const db = chatDB.getDB();

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
};

// Delete prompt
export const deletePrompt = async (id: string): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["prompts"], "readwrite");
    const store = transaction.objectStore("prompts");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
