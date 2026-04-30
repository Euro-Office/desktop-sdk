import type { McpServerConfig, McpServersStorage } from "@onlyoffice/ai-chat";

const KEY = "storage:mcpServers";

function read(): Record<string, McpServerConfig> {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Record<string, McpServerConfig>) : {};
}

function write(map: Record<string, McpServerConfig>): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export class LocalStorageMcpServersStorage implements McpServersStorage {
  async create(name: string, config: McpServerConfig): Promise<void> {
    const map = read();
    map[name] = config;
    write(map);
  }

  async readByName(name: string): Promise<McpServerConfig | null> {
    return read()[name] ?? null;
  }

  async readAll(): Promise<Record<string, McpServerConfig>> {
    return read();
  }

  async update(name: string, config: McpServerConfig): Promise<void> {
    const map = read();
    map[name] = config;
    write(map);
  }

  async replaceAll(servers: Record<string, McpServerConfig>): Promise<void> {
    write(servers);
  }

  async delete(name: string): Promise<void> {
    const map = read();
    delete map[name];
    write(map);
  }
}
