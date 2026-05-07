import type { PreferencesStorage } from "@onlyoffice/ai-chat";

const DEEP_MODE_KEY = "onlyoffice_ai_preferences_deep_mode";

export class LocalStoragePreferencesStorage implements PreferencesStorage {
  async createDeepMode(value: boolean): Promise<void> {
    localStorage.setItem(DEEP_MODE_KEY, JSON.stringify(value));
  }

  async readDeepMode(): Promise<boolean | null> {
    const raw = localStorage.getItem(DEEP_MODE_KEY);
    return raw !== null ? (JSON.parse(raw) as boolean) : null;
  }

  async updateDeepMode(value: boolean): Promise<void> {
    localStorage.setItem(DEEP_MODE_KEY, JSON.stringify(value));
  }

  async upsertDeepMode(value: boolean): Promise<void> {
    localStorage.setItem(DEEP_MODE_KEY, JSON.stringify(value));
  }

  async deleteDeepMode(): Promise<void> {
    localStorage.removeItem(DEEP_MODE_KEY);
  }
}
