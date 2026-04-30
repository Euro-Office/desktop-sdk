import type { WebSearchConfig, WebSearchStorage } from "@onlyoffice/ai-chat";

const KEY = "storage:webSearch";

export class LocalStorageWebSearchStorage implements WebSearchStorage {
  async create(config: WebSearchConfig): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(config));
  }

  async read(): Promise<WebSearchConfig | null> {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WebSearchConfig) : null;
  }

  async update(config: WebSearchConfig): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(config));
  }

  async upsert(config: WebSearchConfig): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(config));
  }

  async delete(): Promise<void> {
    localStorage.removeItem(KEY);
  }
}
