import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks - hoisted before module evaluation
// ---------------------------------------------------------------------------

const { mockSettings, mockServers } = vi.hoisted(() => {
  return {
    mockSettings: {
      get: vi.fn() as ReturnType<typeof vi.fn>,
      set: vi.fn() as ReturnType<typeof vi.fn>,
      remove: vi.fn() as ReturnType<typeof vi.fn>,
    },
    mockServers: {
      getTools: vi.fn() as ReturnType<typeof vi.fn>,
      setCustomServers: vi.fn() as ReturnType<typeof vi.fn>,
      startCustomServers: vi.fn() as ReturnType<typeof vi.fn>,
      callTools: vi.fn() as ReturnType<typeof vi.fn>,
      getServerType: vi.fn() as ReturnType<typeof vi.fn>,
      checkAllowAlways: vi.fn() as ReturnType<typeof vi.fn>,
      setAllowAlways: vi.fn() as ReturnType<typeof vi.fn>,
      deleteCustomServer: vi.fn() as ReturnType<typeof vi.fn>,
      getCustomServersLogs: vi.fn() as ReturnType<typeof vi.fn>,
      getWebSearchEnabled: vi.fn() as ReturnType<typeof vi.fn>,
    },
  };
});

vi.mock("../../settings/settings-holder", () => ({
  getSettingsInstance: () => mockSettings,
}));

vi.mock("../../tools/tools-holder", () => ({
  getServersInstance: () => mockServers,
}));

import { ServersService } from "../servers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SERVERS_KEY = "test_servers";
const DISABLED_TOOLS_KEY = "test_disabled_tools";

function makeTool(name: string, description = "desc") {
  return { name, description, inputSchema: {} };
}

function createService() {
  return new ServersService(SERVERS_KEY, DISABLED_TOOLS_KEY);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ServersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // initServers
  // -------------------------------------------------------------------------

  describe("initServers", () => {
    it("reads settings, parses JSON, sets custom servers and starts them", () => {
      const config = { mcpServers: { myServer: { command: "node" } } };
      mockSettings.get.mockReturnValue(JSON.stringify(config));

      const service = createService();
      service.initServers();

      expect(mockSettings.get).toHaveBeenCalledWith(SERVERS_KEY);
      expect(mockServers.setCustomServers).toHaveBeenCalledWith(config);
      expect(mockServers.startCustomServers).toHaveBeenCalled();
    });

    it("does nothing when no settings exist", () => {
      mockSettings.get.mockReturnValue(null);

      const service = createService();
      service.initServers();

      expect(mockServers.setCustomServers).not.toHaveBeenCalled();
      expect(mockServers.startCustomServers).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // buildToolsList
  // -------------------------------------------------------------------------

  describe("buildToolsList", () => {
    it("first run (no disabled tools) - tools get prefixed names", async () => {
      mockSettings.get.mockReturnValue(null);
      mockServers.getTools.mockResolvedValue({
        custom: [makeTool("read"), makeTool("write")],
      });

      const service = createService();
      const result = await service.buildToolsList();

      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("custom_read");
      expect(result.tools[1].name).toBe("custom_write");
      expect(result.servers.custom).toHaveLength(2);
      expect(result.disabledTools.custom).toEqual([]);
      expect(result.webSearchEnabled).toBe(false);
    });

    it("first run with web-search tools present", async () => {
      mockSettings.get.mockReturnValue(null);
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("contents")],
        custom: [makeTool("read")],
      });

      const service = createService();
      const result = await service.buildToolsList();

      expect(result.webSearchEnabled).toBe(true);
      expect(result.tools).toHaveLength(3);
      expect(result.tools[0].name).toBe("web-search_search");
      expect(result.tools[1].name).toBe("web-search_contents");
      expect(result.tools[2].name).toBe("custom_read");
    });

    it("with existing disabled tools, respects disabled list", async () => {
      const disabledTools = { custom: ["write"], "web-search": [] };
      mockSettings.get.mockImplementation((key: string) => {
        if (key === DISABLED_TOOLS_KEY) return JSON.stringify(disabledTools);
        return null;
      });
      mockServers.getTools.mockResolvedValue({
        custom: [makeTool("read"), makeTool("write")],
      });

      const service = createService();
      const result = await service.buildToolsList();

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe("custom_read");
      expect(result.servers.custom[1].enabled).toBe(false);
    });

    it("with disabledTools where web-search has items (disabled)", async () => {
      const disabledTools = {
        "web-search": ["search", "contents"],
        custom: [],
      };
      mockSettings.get.mockImplementation((key: string) => {
        if (key === DISABLED_TOOLS_KEY) return JSON.stringify(disabledTools);
        return null;
      });
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("contents")],
        custom: [makeTool("read")],
      });

      const service = createService();
      const result = await service.buildToolsList();

      // Web-search tools should be excluded (disabled)
      expect(result.webSearchEnabled).toBe(false);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe("custom_read");
      // web-search servers should still appear in servers map
      expect(result.servers["web-search"]).toBeDefined();
    });

    it("with disabledTools where a non-web-search type has disabled items", async () => {
      const disabledTools = {
        custom: ["write"],
        "web-search": [],
      };
      mockSettings.get.mockImplementation((key: string) => {
        if (key === DISABLED_TOOLS_KEY) return JSON.stringify(disabledTools);
        return null;
      });
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search")],
        custom: [makeTool("read"), makeTool("write")],
      });

      const service = createService();
      const result = await service.buildToolsList();

      // web-search enabled (empty disabled list), custom_write disabled
      expect(result.webSearchEnabled).toBe(true);
      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toContain("web-search_search");
      expect(result.tools.map((t) => t.name)).toContain("custom_read");
      expect(result.tools.map((t) => t.name)).not.toContain("custom_write");
      expect(result.servers.custom[1].enabled).toBe(false);
    });

    it("with disabledTools where type key is missing for a server", async () => {
      // disabledTools does not have the "newserver" key
      const disabledTools = { custom: [] };
      mockSettings.get.mockImplementation((key: string) => {
        if (key === DISABLED_TOOLS_KEY) return JSON.stringify(disabledTools);
        return null;
      });
      mockServers.getTools.mockResolvedValue({
        custom: [makeTool("read")],
        newserver: [makeTool("action")],
      });

      const service = createService();
      const result = await service.buildToolsList();

      // newserver tools should still be enabled (disabledTools[type] initialized to [])
      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toContain("newserver_action");
    });

    it("enforces MAX_TOOL_COUNT (100) and auto-disables excess tools", async () => {
      mockSettings.get.mockReturnValue(null);
      const tools = Array.from({ length: 105 }, (_, i) =>
        makeTool(`tool_${i}`)
      );
      mockServers.getTools.mockResolvedValue({ custom: tools });

      const service = createService();
      const result = await service.buildToolsList();

      expect(result.tools).toHaveLength(100);
      expect(result.disabledTools.custom).toHaveLength(5);
      expect(result.disabledTools.custom).toContain("tool_100");
      expect(result.disabledTools.custom).toContain("tool_104");
    });

    it("enforces MAX_TOOL_COUNT_WITH_WEB_SEARCH (102) when web-search present", async () => {
      mockSettings.get.mockReturnValue(null);
      const tools = Array.from({ length: 105 }, (_, i) =>
        makeTool(`tool_${i}`)
      );
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("contents")],
        custom: tools,
      });

      const service = createService();
      const result = await service.buildToolsList();

      // 2 web-search + 100 custom = 102
      expect(result.tools).toHaveLength(102);
      expect(result.webSearchEnabled).toBe(true);
      expect(result.disabledTools.custom).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // changeToolStatus
  // -------------------------------------------------------------------------

  describe("changeToolStatus", () => {
    const baseState = {
      tools: [
        { ...makeTool("read"), name: "custom_read" },
        { ...makeTool("write"), name: "custom_write" },
      ],
      servers: {
        custom: [
          { ...makeTool("read"), enabled: true },
          { ...makeTool("write"), enabled: true },
        ],
      },
      disabledTools: { custom: [] as string[] },
      webSearchEnabled: false,
    };

    it("enables a tool, updates disabled list, persists", () => {
      const state = {
        ...baseState,
        tools: [{ ...makeTool("read"), name: "custom_read" }],
        servers: {
          custom: [
            { ...makeTool("read"), enabled: true },
            { ...makeTool("write"), enabled: false },
          ],
        },
        disabledTools: { custom: ["write"] },
      };

      const service = createService();
      const result = service.changeToolStatus("custom", "write", true, state);

      expect(result).not.toBeNull();
      expect(result?.tools).toHaveLength(2);
      expect(result?.tools[1].name).toBe("custom_write");
      expect(result?.disabledTools.custom).not.toContain("write");
      expect(mockSettings.set).toHaveBeenCalledWith(
        DISABLED_TOOLS_KEY,
        expect.any(String)
      );
    });

    it("disables a tool", () => {
      const service = createService();
      const result = service.changeToolStatus(
        "custom",
        "write",
        false,
        baseState
      );

      expect(result).not.toBeNull();
      expect(result?.tools).toHaveLength(1);
      expect(result?.tools[0].name).toBe("custom_read");
      expect(result?.disabledTools.custom).toContain("write");
      expect(mockSettings.set).toHaveBeenCalled();
    });

    it("enables all web-search tools as a group", () => {
      const wsState = {
        tools: [{ ...makeTool("read"), name: "custom_read" }],
        servers: {
          custom: [{ ...makeTool("read"), enabled: true }],
          "web-search": [
            { ...makeTool("search"), enabled: false },
            { ...makeTool("contents"), enabled: false },
          ],
        },
        disabledTools: {
          custom: [],
          "web-search": ["search", "contents"],
        },
        webSearchEnabled: false,
      };

      const service = createService();
      const result = service.changeToolStatus(
        "web-search",
        "search",
        true,
        wsState
      );

      expect(result).not.toBeNull();
      expect(result?.webSearchEnabled).toBe(true);
      expect(result?.disabledTools["web-search"]).toEqual([]);
      expect(result?.servers["web-search"].every((t) => t.enabled)).toBe(true);
    });

    it("disables all web-search tools as a group", () => {
      const wsState = {
        tools: [
          { ...makeTool("search"), name: "web-search_search" },
          { ...makeTool("contents"), name: "web-search_contents" },
          { ...makeTool("read"), name: "custom_read" },
        ],
        servers: {
          custom: [{ ...makeTool("read"), enabled: true }],
          "web-search": [
            { ...makeTool("search"), enabled: true },
            { ...makeTool("contents"), enabled: true },
          ],
        },
        disabledTools: { custom: [], "web-search": [] },
        webSearchEnabled: true,
      };

      const service = createService();
      const result = service.changeToolStatus(
        "web-search",
        "search",
        false,
        wsState
      );

      expect(result).not.toBeNull();
      expect(result?.webSearchEnabled).toBe(false);
      expect(result?.disabledTools["web-search"]).toEqual([
        "search",
        "contents",
      ]);
      expect(result?.tools.every((t) => !t.name.includes("web-search"))).toBe(
        true
      );
    });

    it("returns null when tool not found", () => {
      const service = createService();
      const result = service.changeToolStatus(
        "custom",
        "nonexistent",
        true,
        baseState
      );

      expect(result).toBeNull();
    });

    it("returns null when enabling but already at max", () => {
      const maxTools = Array.from({ length: 100 }, (_, i) => ({
        ...makeTool(`tool_${i}`),
        name: `custom_tool_${i}`,
      }));
      const maxState = {
        tools: maxTools,
        servers: {
          custom: [
            ...maxTools.map((t) => ({ ...t, enabled: true })),
            { ...makeTool("overflow"), enabled: false },
          ],
        },
        disabledTools: { custom: ["overflow"] },
        webSearchEnabled: false,
      };

      const service = createService();
      const result = service.changeToolStatus(
        "custom",
        "overflow",
        true,
        maxState
      );

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // callTools
  // -------------------------------------------------------------------------

  describe("callTools", () => {
    it("calls server with extracted type/name", async () => {
      mockServers.getServerType.mockReturnValue("custom");
      mockServers.callTools.mockResolvedValue("result");

      const service = createService();
      const result = await service.callTools(
        "custom_read",
        { arg: 1 },
        {
          custom: [],
        }
      );

      expect(mockServers.getServerType).toHaveBeenCalledWith("custom_read");
      expect(mockServers.callTools).toHaveBeenCalledWith("custom", "read", {
        arg: 1,
      });
      expect(result).toBe("result");
    });

    it("returns undefined for disabled tool", async () => {
      mockServers.getServerType.mockReturnValue("custom");

      const service = createService();
      const result = await service.callTools(
        "custom_read",
        {},
        {
          custom: ["read"],
        }
      );

      expect(result).toBeUndefined();
      expect(mockServers.callTools).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // checkAllowAlways / setAllowAlways
  // -------------------------------------------------------------------------

  describe("checkAllowAlways", () => {
    it("delegates to servers", () => {
      mockServers.checkAllowAlways.mockReturnValue(true);

      const service = createService();
      const result = service.checkAllowAlways("custom", "read");

      expect(mockServers.checkAllowAlways).toHaveBeenCalledWith(
        "custom",
        "read"
      );
      expect(result).toBe(true);
    });
  });

  describe("setAllowAlways", () => {
    it("delegates to servers", () => {
      const service = createService();
      service.setAllowAlways(true, "custom", "read");

      expect(mockServers.setAllowAlways).toHaveBeenCalledWith(
        true,
        "custom",
        "read"
      );
    });
  });

  // -------------------------------------------------------------------------
  // getConfig / saveConfig
  // -------------------------------------------------------------------------

  describe("getConfig", () => {
    it("parses settings when present", () => {
      const config = { mcpServers: { s1: { command: "node" } } };
      mockSettings.get.mockReturnValue(JSON.stringify(config));

      const service = createService();
      const result = service.getConfig();

      expect(result).toEqual(config);
    });

    it("returns default when no settings", () => {
      mockSettings.get.mockReturnValue(null);

      const service = createService();
      const result = service.getConfig();

      expect(result).toEqual({ mcpServers: {} });
    });
  });

  describe("saveConfig", () => {
    it("persists config and restarts servers", () => {
      const config = { mcpServers: { s1: { command: "node" } } };

      const service = createService();
      service.saveConfig(config);

      expect(mockSettings.set).toHaveBeenCalledWith(
        SERVERS_KEY,
        JSON.stringify(config)
      );
      expect(mockServers.setCustomServers).toHaveBeenCalledWith(config);
      expect(mockServers.startCustomServers).toHaveBeenCalled();
    });

    it("normalizes config without mcpServers", () => {
      const config = {} as {
        mcpServers: Record<string, Record<string, unknown>>;
      };

      const service = createService();
      service.saveConfig(config);

      const expected = { mcpServers: {} };
      expect(mockSettings.set).toHaveBeenCalledWith(
        SERVERS_KEY,
        JSON.stringify(expected)
      );
      expect(mockServers.setCustomServers).toHaveBeenCalledWith(expected);
    });
  });

  // -------------------------------------------------------------------------
  // deleteCustomServer
  // -------------------------------------------------------------------------

  describe("deleteCustomServer", () => {
    it("deletes from servers and config", () => {
      const config = {
        mcpServers: { s1: { command: "node" }, s2: { command: "python" } },
      };
      mockSettings.get.mockReturnValue(JSON.stringify(config));

      const service = createService();
      service.deleteCustomServer("s1");

      expect(mockServers.deleteCustomServer).toHaveBeenCalledWith("s1");
      const savedConfig = JSON.parse(
        mockSettings.set.mock.calls[0][1] as string
      );
      expect(savedConfig.mcpServers).not.toHaveProperty("s1");
      expect(savedConfig.mcpServers).toHaveProperty("s2");
    });
  });

  // -------------------------------------------------------------------------
  // getCustomServersLogs / getWebSearchEnabled
  // -------------------------------------------------------------------------

  describe("getCustomServersLogs", () => {
    it("delegates to servers", () => {
      const logs = { s1: ["log1"] };
      mockServers.getCustomServersLogs.mockReturnValue(logs);

      const service = createService();
      expect(service.getCustomServersLogs()).toEqual(logs);
    });
  });

  describe("getWebSearchEnabled", () => {
    it("delegates to servers", () => {
      mockServers.getWebSearchEnabled.mockReturnValue(true);

      const service = createService();
      expect(service.getWebSearchEnabled()).toBe(true);
    });
  });
});
