import { createContext, useContext, useEffect, useMemo } from "react";
import type { PlatformAdapter } from "./types";
import { OnlyOfficePlatform } from "./onlyoffice";
import { NoopPlatform } from "./noop";
import { setPlatformInstance } from "./platform-holder";

const PlatformContext = createContext<PlatformAdapter | null>(null);

/** Access the current PlatformAdapter instance from any component */
export function usePlatform(): PlatformAdapter {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform() must be used inside <PlatformProvider>");
  return ctx;
}

interface PlatformProviderProps {
  /** Custom platform implementation. If omitted, auto-detects OnlyOffice or falls back to Noop */
  platform?: PlatformAdapter;
  children: React.ReactNode;
}

function isDesktopEditor(): boolean {
  return typeof window !== "undefined" && "AscDesktopEditor" in window;
}

/**
 * Provides platform-specific operations (file ops, process runner, environment, host tools).
 * Auto-detects OnlyOffice environment if no platform prop is passed.
 */
export function PlatformProvider({ platform, children }: PlatformProviderProps) {
  const platformInstance = useMemo(
    () => platform ?? (isDesktopEditor() ? new OnlyOfficePlatform() : new NoopPlatform()),
    [platform],
  );

  useEffect(() => {
    setPlatformInstance(platformInstance);
  }, [platformInstance]);

  return (
    <PlatformContext.Provider value={platformInstance}>
      {children}
    </PlatformContext.Provider>
  );
}
