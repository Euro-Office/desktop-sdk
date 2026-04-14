import { createContext, useContext } from "react";
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
 * Unlike StorageProvider, no async init — settings are synchronous (key-value).
 */
export function SettingsProvider({
  settings,
  children,
}: SettingsProviderProps) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}
