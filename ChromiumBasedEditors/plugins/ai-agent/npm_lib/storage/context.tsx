import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { StorageAdapter } from "./types";
import { IndexedDBStorage } from "./indexeddb";
import { setStorageInstance } from "./storage-holder";

const StorageContext = createContext<StorageAdapter | null>(null);

/** Access the current StorageAdapter instance from any component */
export function useStorage(): StorageAdapter {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage() must be used inside <StorageProvider>");
  return ctx;
}

interface StorageProviderProps {
  /** Custom storage implementation. If omitted, IndexedDBStorage is used */
  storage?: StorageAdapter;
  children: React.ReactNode;
}

/**
 * Initializes and provides the storage layer.
 * Renders children only after storage.init() completes.
 * Also sets the global storage-holder so Zustand stores can access it.
 */
export function StorageProvider({ storage: externalStorage, children }: StorageProviderProps) {
  const storageInstance = useMemo(
    () => externalStorage ?? new IndexedDBStorage(),
    [externalStorage],
  );

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setStorageInstance(storageInstance);

    storageInstance.init().then(() => setIsReady(true));

    return () => {
      storageInstance.close();
    };
  }, [storageInstance]);

  if (!isReady) return null;

  return (
    <StorageContext.Provider value={storageInstance}>
      {children}
    </StorageContext.Provider>
  );
}
