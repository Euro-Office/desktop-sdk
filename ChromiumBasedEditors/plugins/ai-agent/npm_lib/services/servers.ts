import { getSettingsInstance } from "../settings/settings-holder";
import { getServersInstance } from "../tools/tools-holder";
import type { TMCPItem } from "../types";

const MAX_TOOL_COUNT = 100;
const MAX_TOOL_COUNT_WITH_WEB_SEARCH = MAX_TOOL_COUNT + 2;

export type ToolsListResult = {
  tools: TMCPItem[];
  servers: Record<string, TMCPItem[]>;
  disabledTools: Record<string, string[]>;
  webSearchEnabled: boolean;
};

export type ChangeToolStatusResult = {
  tools: TMCPItem[];
  servers: Record<string, TMCPItem[]>;
  disabledTools: Record<string, string[]>;
  webSearchEnabled: boolean;
} | null;

export class ServersService {
  constructor(
    private serversKey: string,
    private disabledToolsKey: string
  ) {}

  initServers(): void {
    const settings = getSettingsInstance();
    const customServers = settings.get(this.serversKey);

    if (customServers) {
      try {
        const parsed = JSON.parse(customServers);
        getServersInstance().setCustomServers(parsed);
        getServersInstance().startCustomServers();
      } catch {
        // Ignore invalid JSON in settings
      }
    }
  }

  async buildToolsList(): Promise<ToolsListResult> {
    const allTools = await getServersInstance().getTools();
    const settings = getSettingsInstance();
    const disabledToolsStr = settings.get(this.disabledToolsKey);

    const tools: TMCPItem[] = [];
    const servers: Record<string, TMCPItem[]> = {};
    let webSearchEnabled = false;

    let parsedDisabledTools: Record<string, string[]> | null = null;
    if (disabledToolsStr) {
      try {
        parsedDisabledTools = JSON.parse(disabledToolsStr);
      } catch {
        // Ignore invalid JSON
      }
    }

    if (parsedDisabledTools) {
      const disabledTools = parsedDisabledTools;

      Object.entries(allTools).forEach(([type, serverTools]) => {
        if (type === "web-search") {
          servers[type] = [...serverTools];

          if (disabledTools["web-search"]?.length) {
            return;
          }

          const items = serverTools.map((tool) => ({
            ...tool,
            name: `${type}_${tool.name}`,
          }));

          disabledTools[type] = [];
          tools.push(...items);
          webSearchEnabled = serverTools.length > 0;
          return;
        }

        servers[type] = serverTools.map((tool) => {
          if (!disabledTools[type]) {
            disabledTools[type] = [];
          }
          const enabled = !disabledTools[type].includes(tool.name);

          const maxCount = webSearchEnabled
            ? MAX_TOOL_COUNT_WITH_WEB_SEARCH
            : MAX_TOOL_COUNT;
          if (enabled && tools.length >= maxCount) {
            disabledTools[type].push(tool.name);
            return { ...tool, enabled: false };
          }

          if (enabled) tools.push({ ...tool, name: `${type}_${tool.name}` });
          return { ...tool, enabled };
        });
      });

      return { tools, servers, disabledTools, webSearchEnabled };
    }

    const disabledTools: Record<string, string[]> = {};

    Object.entries(allTools).forEach(([type, serverTools]) => {
      disabledTools[type] = [];

      if (type === "web-search") {
        servers[type] = [...serverTools];
        const items = serverTools.map((tool) => ({
          ...tool,
          name: `${type}_${tool.name}`,
          enabled: true,
        }));
        tools.push(...items);
        webSearchEnabled = serverTools.length > 0;
        return;
      }

      const serverToolsWithStatus = serverTools.map((t, index) => {
        if (
          tools.length + index >=
          (webSearchEnabled ? MAX_TOOL_COUNT_WITH_WEB_SEARCH : MAX_TOOL_COUNT)
        ) {
          disabledTools[type].push(t.name);
          return { ...t, enabled: false };
        }
        return { ...t, enabled: true };
      });

      servers[type] = serverToolsWithStatus;
      tools.push(
        ...serverToolsWithStatus
          .filter((tool) => tool.enabled)
          .map((tool) => ({ ...tool, name: `${type}_${tool.name}` }))
      );
    });

    return { tools, servers, disabledTools, webSearchEnabled };
  }

  changeToolStatus(
    type: string,
    name: string,
    enabled: boolean,
    currentState: {
      tools: TMCPItem[];
      servers: Record<string, TMCPItem[]>;
      disabledTools: Record<string, string[]>;
      webSearchEnabled: boolean;
    }
  ): ChangeToolStatusResult {
    const settings = getSettingsInstance();
    const { servers, disabledTools } = currentState;
    const tool = servers[type]?.find((t) => t.name === name);
    if (!tool) return null;

    let newTools: TMCPItem[];
    let newDisabledTools: Record<string, string[]>;
    let newWebSearchEnabled = currentState.webSearchEnabled;
    let newServers = servers;

    if (enabled) {
      if (type === "web-search") {
        newDisabledTools = { ...disabledTools, [type]: [] };
        newWebSearchEnabled = true;
        newServers = {
          ...servers,
          [type]: servers[type].map((t) => ({ ...t, enabled: true })),
        };
        newTools = currentState.tools;
        settings.set(this.disabledToolsKey, JSON.stringify(newDisabledTools));
        return {
          tools: newTools,
          servers: newServers,
          disabledTools: newDisabledTools,
          webSearchEnabled: newWebSearchEnabled,
        };
      }

      const maxCount = currentState.webSearchEnabled
        ? MAX_TOOL_COUNT_WITH_WEB_SEARCH
        : MAX_TOOL_COUNT;
      if (currentState.tools.length >= maxCount) return null;

      newDisabledTools = {
        ...disabledTools,
        [type]: disabledTools[type].filter((t) => t !== name),
      };
      newTools = [
        ...currentState.tools,
        { ...tool, name: `${type}_${tool.name}` },
      ];
      settings.set(this.disabledToolsKey, JSON.stringify(newDisabledTools));
    } else {
      const disabled = [...disabledTools[type], name];
      newDisabledTools = { ...disabledTools, [type]: disabled };

      if (type === "web-search") {
        newDisabledTools[type] = servers[type].map((t) => t.name);
        newWebSearchEnabled = false;
        newTools = currentState.tools.filter((t) => !t.name.includes(type));
      } else {
        newTools = currentState.tools.filter(
          (t) => t.name !== `${type}_${name}`
        );
      }

      settings.set(this.disabledToolsKey, JSON.stringify(newDisabledTools));
    }

    newServers = {
      ...servers,
      [type]: servers[type].map((t) => {
        if (t.name === name) return { ...t, enabled };
        return t;
      }),
    };

    return {
      tools: newTools,
      servers: newServers,
      disabledTools: newDisabledTools,
      webSearchEnabled: newWebSearchEnabled,
    };
  }

  async callTools(
    name: string,
    args: Record<string, unknown>,
    disabledTools: Record<string, string[]>
  ): Promise<unknown> {
    const servers = getServersInstance();
    const type = servers.getServerType(name);
    const toolName = name.replace(`${type}_`, "");

    if (disabledTools[type]?.includes(toolName)) return;

    return servers.callTools(type, toolName, args);
  }

  checkAllowAlways(type: string, name: string): boolean {
    return getServersInstance().checkAllowAlways(type, name);
  }

  setAllowAlways(value: boolean, type: string, name: string): void {
    getServersInstance().setAllowAlways(value, type, name);
  }

  getConfig(): Record<string, Record<string, unknown>> {
    const settings = getSettingsInstance();
    const raw = settings.get(this.serversKey);
    if (!raw) return { mcpServers: {} };
    try {
      return JSON.parse(raw);
    } catch {
      return { mcpServers: {} };
    }
  }

  saveConfig(config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }): void {
    const settings = getSettingsInstance();
    const currConfig = config.mcpServers ? config : { mcpServers: {} };
    settings.set(this.serversKey, JSON.stringify(currConfig));
    getServersInstance().setCustomServers(currConfig);
    getServersInstance().startCustomServers();
  }

  deleteCustomServer(name: string): void {
    getServersInstance().deleteCustomServer(name);
    const config = this.getConfig();
    delete config.mcpServers[name];
    getSettingsInstance().set(this.serversKey, JSON.stringify(config));
  }

  getCustomServersLogs(): Record<string, string[]> {
    return getServersInstance().getCustomServersLogs();
  }

  getWebSearchEnabled(): boolean {
    return getServersInstance().getWebSearchEnabled();
  }
}
