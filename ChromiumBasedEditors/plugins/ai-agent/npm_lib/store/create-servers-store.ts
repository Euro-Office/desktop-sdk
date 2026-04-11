import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ServersService } from "../services/servers";
import type { TMCPItem } from "../types";

export interface ServersStoreState {
  servers: Record<string, TMCPItem[]>;
  tools: TMCPItem[];
  disabledTools: Record<string, string[]>;
  manageToolData?: {
    message: ThreadMessageLike;
    idx: number;
    messageUID: string;
  };
  webSearchEnabled: boolean;
  initServers: () => void;
  getTools: () => Promise<void>;
  changeToolStatus: (type: string, name: string, enabled: boolean) => void;
  callTools: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  checkAllowAlways: (type: string, name: string) => boolean;
  setAllowAlways: (value: boolean, type: string, name: string) => void;
  setManageToolData: (data: ServersStoreState["manageToolData"]) => void;
  saveConfig: (config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => void;
  getConfig: () => Record<string, Record<string, unknown>>;
  deleteCustomServer: (name: string) => void;
  getCustomServersLogs: () => Record<string, string[]>;
  getWebSearchEnabled: () => boolean;
}

export function createServersStore(deps: {
  serversService: ServersService;
}): UseBoundStore<StoreApi<ServersStoreState>> {
  const { serversService } = deps;

  return create<ServersStoreState>((set, get) => ({
    servers: {},
    tools: [],
    disabledTools: {},
    manageToolData: undefined,
    webSearchEnabled: false,

    initServers: () => {
      serversService.initServers();
    },

    getTools: async () => {
      const result = await serversService.buildToolsList();
      set({
        tools: result.tools,
        servers: result.servers,
        disabledTools: result.disabledTools,
        webSearchEnabled: result.webSearchEnabled,
      });
    },

    changeToolStatus: (type, name, enabled) => {
      const { tools, servers, disabledTools, webSearchEnabled } = get();
      const result = serversService.changeToolStatus(type, name, enabled, {
        tools,
        servers,
        disabledTools,
        webSearchEnabled,
      });
      if (result) {
        set({
          tools: result.tools,
          servers: result.servers,
          disabledTools: result.disabledTools,
          webSearchEnabled: result.webSearchEnabled,
        });
      }
    },

    callTools: async (name, args) => {
      return serversService.callTools(name, args, get().disabledTools);
    },

    checkAllowAlways: (type, name) => {
      return serversService.checkAllowAlways(type, name);
    },

    setAllowAlways: (value, type, name) => {
      serversService.setAllowAlways(value, type, name);
    },

    setManageToolData: (data) => {
      set({ manageToolData: data });
    },

    getConfig: () => serversService.getConfig(),

    saveConfig: (config) => {
      serversService.saveConfig(config);
    },

    deleteCustomServer: (name) => {
      serversService.deleteCustomServer(name);
    },

    getCustomServersLogs: () => serversService.getCustomServersLogs(),

    getWebSearchEnabled: () => serversService.getWebSearchEnabled(),
  }));
}
