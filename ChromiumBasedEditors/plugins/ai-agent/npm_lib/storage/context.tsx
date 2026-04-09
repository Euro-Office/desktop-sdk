import { createContext, useContext, useEffect, useState } from "react";
import type { StorageAdapter } from "./types";
import { setStorageInstance } from "./storage-holder";

const StorageContext = createContext<StorageAdapter | null>(null);

/** Access the current StorageAdapter instance from any component */
export function useStorage(): StorageAdapter {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage() must be used inside <StorageProvider>");
  return ctx;
}

interface StorageProviderProps {
  /** Storage implementation. Required — no default provided */
  storage: StorageAdapter;
  children: React.ReactNode;
}

/**
 * Initializes and provides the storage layer.
 * Renders children only after storage.init() completes.
 * Also sets the global storage-holder so Zustand stores can access it.
 */
export function StorageProvider({ storage, children }: StorageProviderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setStorageInstance(storage);

    storage.init().then(() => setIsReady(true));

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
