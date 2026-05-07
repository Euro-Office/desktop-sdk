import type { ToolPrefsStorage } from "@onlyoffice/ai-chat";

const DISABLED_KEY = "onlyoffice_ai_tool_prefs_disabled";
const ALLOW_ALWAYS_KEY = "onlyoffice_ai_tool_prefs_allow_always";

export class LocalStorageToolPrefsStorage implements ToolPrefsStorage {
  async createDisabled(disabled: Record<string, string[]>): Promise<void> {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(disabled));
  }

  async readDisabled(): Promise<Record<string, string[]>> {
    const raw = localStorage.getItem(DISABLED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  }

  async updateDisabled(disabled: Record<string, string[]>): Promise<void> {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(disabled));
  }

  async upsertDisabled(disabled: Record<string, string[]>): Promise<void> {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(disabled));
  }

  async deleteDisabled(): Promise<void> {
    localStorage.removeItem(DISABLED_KEY);
  }

  async createAllowAlways(tokens: string[]): Promise<void> {
    localStorage.setItem(ALLOW_ALWAYS_KEY, JSON.stringify(tokens));
  }

  async readAllowAlways(): Promise<string[]> {
    const raw = localStorage.getItem(ALLOW_ALWAYS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }

  async updateAllowAlways(tokens: string[]): Promise<void> {
    localStorage.setItem(ALLOW_ALWAYS_KEY, JSON.stringify(tokens));
  }

  async upsertAllowAlways(tokens: string[]): Promise<void> {
    localStorage.setItem(ALLOW_ALWAYS_KEY, JSON.stringify(tokens));
  }

  async deleteAllowAlways(): Promise<void> {
    localStorage.removeItem(ALLOW_ALWAYS_KEY);
  }
}
