import type { SettingsAdapter } from "./types";

/**
 * Global settings instance holder.
 * Zustand stores can't access React context, so they get settings from here.
 * Set by the host app during initialization, before any store operations.
 */
let settingsInstance: SettingsAdapter | null = null;

export function setSettingsInstance(settings: SettingsAdapter): void {
  settingsInstance = settings;
}

export function getSettingsInstance(): SettingsAdapter {
  if (!settingsInstance) {
    throw new Error(
      "Settings not initialized. Call setSettingsInstance() first."
    );
  }
  return settingsInstance;
}
