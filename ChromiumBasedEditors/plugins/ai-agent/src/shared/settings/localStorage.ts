import type { SettingsAdapter } from "@onlyoffice/ai-chat";

/**
 * SettingsAdapter backed by browser localStorage.
 * Host-specific implementation for the ONLYOFFICE Desktop Editor plugin.
 */
export class LocalStorageSettings implements SettingsAdapter {
  get(key: string): string | null {
    return localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
