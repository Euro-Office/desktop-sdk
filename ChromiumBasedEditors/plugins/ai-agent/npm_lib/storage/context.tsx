import { createContext, useContext, useEffect, useState } from "react";
import { setStorageInstance } from "./storage-holder";
import type { StorageAdapter } from "./types";

const StorageContext = createContext<StorageAdapter | null>(null);

/** Access the current StorageAdapter instance from any component */
export function useStorage(): StorageAdapter {
  const ctx = useContext(StorageContext);
  if (!ctx)
    throw new Error("useStorage() must be used inside <StorageProvider>");
  return ctx;
}

interface StorageProviderProps {
  /** Storage implementation. Required — no default provided */
  storage: StorageAdapter;
  children: React.ReactNode;
}

/**
 * Initializes and provides the storage layer.
 * Sets the global holder synchronously so Zustand stores can access it immediately.
 * Renders children only after storage.init() completes.
 */
export function StorageProvider({ storage, children }: StorageProviderProps) {
  // Set holder synchronously — Zustand stores may call getStorageInstance() during render
  setStorageInstance(storage);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    storage
      .init()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error("Storage init failed:", err);
      });

    return () => {
      storage.close();
    };
  }, [storage]);

  if (!isReady) return null;

  return (
    <StorageContext.Provider value={storage}>
      {children}
    </StorageContext.Provider>
  );
}
