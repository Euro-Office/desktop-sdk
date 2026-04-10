import type { ThreadMessageLike } from "@assistant-ui/react";
import { create } from "zustand";
import type { TMCPItem } from "@/lib/types";
import { ServersService } from "../../npm_lib/services/servers";

const service = new ServersService("mcpServers", "disabledTools");

type UseServersStoreProps = {
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
  setManageToolData: (data: UseServersStoreProps["manageToolData"]) => void;
  saveConfig: (config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => void;
  getConfig: () => Record<string, Record<string, unknown>>;
  deleteCustomServer: (name: string) => void;
  getCustomServersLogs: () => Record<string, string[]>;
  getWebSearchEnabled: () => boolean;
};

const useServersStore = create<UseServersStoreProps>((set, get) => ({
  servers: {},
  tools: [],
  disabledTools: {},
  manageToolData: undefined,
  webSearchEnabled: false,

  initServers: () => {
    service.initServers();
  },

  getTools: async () => {
    const result = await service.buildToolsList();
    set({
      tools: result.tools,
      servers: result.servers,
      disabledTools: result.disabledTools,
      webSearchEnabled: result.webSearchEnabled,
    });
  },

  changeToolStatus: (type: string, name: string, enabled: boolean) => {
    const { tools, servers, disabledTools, webSearchEnabled } = get();
    const result = service.changeToolStatus(type, name, enabled, {
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

  callTools: async (name: string, args: Record<string, unknown>) => {
    return service.callTools(name, args, get().disabledTools);
  },

  checkAllowAlways: (type: string, name: string) => {
    return service.checkAllowAlways(type, name);
  },

  setAllowAlways: (value: boolean, type: string, name: string) => {
    service.setAllowAlways(value, type, name);
  },

  setManageToolData: (data: UseServersStoreProps["manageToolData"]) => {
    set({ manageToolData: data });
  },

  getConfig: () => {
    return service.getConfig();
  },

  saveConfig: (config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => {
    service.saveConfig(config);
  },

  deleteCustomServer: (name: string) => {
    service.deleteCustomServer(name);
  },

  getCustomServersLogs: () => {
    return service.getCustomServersLogs();
  },

  getWebSearchEnabled: () => {
    return service.getWebSearchEnabled();
  },
}));

export default useServersStore;
