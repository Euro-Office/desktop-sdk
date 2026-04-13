import { getSettingsInstance } from "../settings/settings-holder";
import type { TMCPItem } from "../types";
import { CustomServers } from "./sources/CustomServers";
import { HostToolSource } from "./sources/HostToolSource";
import { WebSearch, type WebSearchData } from "./sources/WebSearch";

const ALLOW_ALWAYS_TOOLS = "allowAlwaysTools";

class Servers {
  hostToolSource: HostToolSource;
  customServers: CustomServers;
  webSearch: WebSearch;

  allowAlways: string[];

  constructor() {
    this.hostToolSource = new HostToolSource();
    this.customServers = new CustomServers();
    this.webSearch = new WebSearch();

    const raw = getSettingsInstance().get(ALLOW_ALWAYS_TOOLS);
    this.allowAlways = raw ? raw.split(",").filter(Boolean) : [];
  }

  checkAllowAlways = (type: string, name: string) => {
    if (type === "web-search") {
      return true;
    }

    // Check if host tool group auto-allows this tool
    if (this.hostToolSource.getGroupIds().includes(type)) {
      if (this.hostToolSource.isAutoAllow(type, name)) {
        return true;
      }
    }

    if (this.allowAlways.includes(`${type}_${name}`)) {
      return true;
    }

    return false;
  };

  setAllowAlways = (value: boolean, type: string, name: string) => {
    if (type === "web-search") {
      return;
    }

    if (value) {
      this.allowAlways.push(`${type}_${name}`);
    } else {
      this.allowAlways = this.allowAlways.filter(
        (tool) => tool !== `${type}_${name}`
      );
    }

    getSettingsInstance().set(ALLOW_ALWAYS_TOOLS, this.allowAlways.join(","));
  };

  getTools = async () => {
    const [hostToolsByGroup, webSearchTools, customServersTools] =
      await Promise.all([
        this.hostToolSource.getToolsByGroup(),
        this.webSearch.getTools(),
        this.customServers.getTools(),
      ]);

    const items: Record<string, TMCPItem[]> = {
      ...hostToolsByGroup,
      "web-search": webSearchTools,
      ...customServersTools,
    };

    return items;
  };

  callTools = async (
    type: string,
    name: string,
    args: Record<string, unknown>
  ) => {
    // Check if this is a host tool group
    if (this.hostToolSource.getGroupIds().includes(type)) {
      return this.hostToolSource.callTool(name, args);
    }

    if (type === "web-search") {
      return await this.webSearch.callTools(name, args);
    }

    // Call MCP server tool
    return await this.customServers.callToolFromMCP(type, name, args);
  };

  getServerType = (name: string) => {
    // Check host tool groups first
    for (const groupId of this.hostToolSource.getGroupIds()) {
      if (name.startsWith(`${groupId}_`)) {
        return groupId;
      }
    }

    if (name.startsWith("web-search_")) {
      return "web-search";
    }

    return this.customServers.getServerType(name);
  };

  setCustomServers = (servers: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => {
    this.customServers.setCustomServers(servers);
  };

  startCustomServers = () => {
    this.customServers.startCustomServers();
  };

  restartCustomServer = (type: string) => {
    this.customServers.restartCustomServer(type);
  };

  deleteCustomServer = (type: string) => {
    this.customServers.deleteCustomServer(type);
  };

  getCustomServers = () => {
    return this.customServers.customServers;
  };

  getCustomServersStoped = () => {
    return this.customServers.stoppedCustomServers;
  };

  getCustomServersLogs = () => {
    return this.customServers.customServersLogs;
  };

  setWebSearchData = (data: WebSearchData) => {
    this.webSearch.setWebSearchData(data);
  };

  getWebSearchData = () => {
    return this.webSearch.getWebSearchData();
  };

  getWebSearchEnabled = () => {
    return this.webSearch.getWebSearchEnabled();
  };
}

export default Servers;
