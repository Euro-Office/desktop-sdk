import type { StorageAdapter } from "./types";

/**
 * Global storage instance holder.
 * Zustand stores can't access React context, so they get storage from here.
 * Set by App.tsx during initialization, before any store operations.
 */
let storageInstance: StorageAdapter | null = null;

export function setStorageInstance(storage: StorageAdapter): void {
  storageInstance = storage;
}

export function getStorageInstance(): StorageAdapter {
  if (!storageInstance) {
    throw new Error("Storage not initialized. Call setStorageInstance() first.");
  }
  return storageInstance;
}
