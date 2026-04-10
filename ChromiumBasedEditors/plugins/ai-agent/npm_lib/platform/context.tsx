import { createContext, useContext } from "react";
import type { PlatformAdapter } from "./types";
import { setPlatformInstance } from "./platform-holder";

const PlatformContext = createContext<PlatformAdapter | null>(null);

/** Access the current PlatformAdapter instance from any component */
export function usePlatform(): PlatformAdapter {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform() must be used inside <PlatformProvider>");
  return ctx;
}

interface PlatformProviderProps {
  /** Platform implementation. Required — no default provided */
  platform: PlatformAdapter;
  children: React.ReactNode;
}

/**
 * Provides platform-specific operations (file ops, process runner, environment, host tools).
 * Sets the global platform-holder synchronously so Zustand stores can access it immediately.
 */
export function PlatformProvider({ platform, children }: PlatformProviderProps) {
  setPlatformInstance(platform);

  return (
    <PlatformContext.Provider value={platform}>
      {children}
    </PlatformContext.Provider>
  );
}
