import { createContext, useContext } from "react";
import { setSettingsInstance } from "./settings-holder";
import type { SettingsAdapter } from "./types";

const SettingsContext = createContext<SettingsAdapter | null>(null);

/** Access the current SettingsAdapter instance from any component */
export function useSettings(): SettingsAdapter {
  const ctx = useContext(SettingsContext);
  if (!ctx)
    throw new Error("useSettings() must be used inside <SettingsProvider>");
  return ctx;
}

interface SettingsProviderProps {
  /** Settings implementation. Required — no default provided */
  settings: SettingsAdapter;
  children: React.ReactNode;
}

/**
 * Provides the settings layer to the component tree.
 * Sets the global holder synchronously so Zustand stores can access it immediately.
 * Unlike StorageProvider, no async init — settings are synchronous (key-value).
 */
export function SettingsProvider({
  settings,
  children,
}: SettingsProviderProps) {
  // Set holder synchronously — stores may call getSettingsInstance() during render
  setSettingsInstance(settings);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}
