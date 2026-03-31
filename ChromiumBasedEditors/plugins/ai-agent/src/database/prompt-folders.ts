import type { PromptFolder } from "@/lib/types";
import { chatDB } from "./index";
import { deletePromptsByFolderId } from "./prompts";

// Create folder
export const createPromptFolder = async (
  folder: PromptFolder
): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["promptFolders"], "readwrite");
    const store = transaction.objectStore("promptFolders");
    const request = store.put(folder);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Read single folder
export const readPromptFolder = async (
  id: string
): Promise<PromptFolder | null> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["promptFolders"], "readonly");
    const store = transaction.objectStore("promptFolders");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

// Read all folders sorted by createdAt (latest first)
export const readAllPromptFolders = async (): Promise<PromptFolder[]> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["promptFolders"], "readonly");
    const store = transaction.objectStore("promptFolders");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const folders = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(folders);
    };
  });
};

// Update folder
export const updatePromptFolder = async (
  id: string,
  name: string
): Promise<void> => {
  const db = chatDB.getDB();

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
};

// Delete folder and all its prompts
export const deletePromptFolder = async (id: string): Promise<void> => {
  await deletePromptsByFolderId(id);

  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["promptFolders"], "readwrite");
    const store = transaction.objectStore("promptFolders");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
