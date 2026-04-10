import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TMCPItem } from "@/lib/types";

// --- localStorage mock (hoisted) ---

const { localStorageMap } = vi.hoisted(() => {
  const map = new Map<string, string>();
  const mock = {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => map.set(key, value)),
    removeItem: vi.fn((key: string) => map.delete(key)),
    clear: vi.fn(() => map.clear()),
    get length() {
      return map.size;
    },
    key: vi.fn(),
  };
  // @ts-expect-error — setting global before modules load
  globalThis.localStorage = mock;
  return { localStorageMap: map };
});

// --- Mocks ---

const mockServers = {
  getTools: vi.fn(),
  callTools: vi.fn(),
  checkAllowAlways: vi.fn(),
  setAllowAlways: vi.fn(),
  setCustomServers: vi.fn(),
  startCustomServers: vi.fn(),
  deleteCustomServer: vi.fn(),
  getServerType: vi.fn(),
  getCustomServersLogs: vi.fn(),
  getWebSearchEnabled: vi.fn(),
  setWebSearchData: vi.fn(),
};

const mockSettings = {
  get: vi.fn((key: string) => localStorageMap.get(key) ?? null),
  set: vi.fn((key: string, value: string) => localStorageMap.set(key, value)),
  remove: vi.fn((key: string) => localStorageMap.delete(key)),
};

vi.mock("../../../npm_lib/tools/tools-holder", () => ({
  getServersInstance: () => mockServers,
}));

vi.mock("../../../npm_lib/settings/settings-holder", () => ({
  getSettingsInstance: () => mockSettings,
}));

import useServersStore from "../useServersStore";

// --- Helpers ---

const makeTool = (name: string): TMCPItem => ({
  name,
  description: `Tool ${name}`,
  inputSchema: {},
});

const resetStore = () => {
  useServersStore.setState({
    servers: {},
    tools: [],
    disabledTools: {},
    manageToolData: undefined,
    webSearchEnabled: false,
  });
};

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  localStorageMap.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe("useServersStore", () => {
  describe("initServers", () => {
    it("loads MCP config from localStorage and starts servers", () => {
      const config = { mcpServers: { my: { command: "node", args: [] } } };
      localStorageMap.set("mcpServers", JSON.stringify(config));

      useServersStore.getState().initServers();

      expect(mockServers.setCustomServers).toHaveBeenCalledWith(config);
      expect(mockServers.startCustomServers).toHaveBeenCalledOnce();
    });

    it("does nothing when no config in localStorage", () => {
      useServersStore.getState().initServers();

      expect(mockServers.setCustomServers).not.toHaveBeenCalled();
    });
  });

  describe("getTools", () => {
    it("builds tools list with type prefix from all sources (first run, no disabled)", async () => {
      mockServers.getTools.mockResolvedValue({
        "desktop-editor": [makeTool("paste"), makeTool("copy")],
      });

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      expect(state.tools).toHaveLength(2);
      expect(state.tools[0].name).toBe("desktop-editor_paste");
      expect(state.tools[1].name).toBe("desktop-editor_copy");
      expect(state.servers["desktop-editor"]).toHaveLength(2);
    });

    it("respects disabledTools from localStorage", async () => {
      mockServers.getTools.mockResolvedValue({
        "desktop-editor": [makeTool("paste"), makeTool("copy")],
      });
      localStorageMap.set(
        "disabledTools",
        JSON.stringify({ "desktop-editor": ["paste"] })
      );

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      // Only "copy" should be in the active tools
      expect(state.tools).toHaveLength(1);
      expect(state.tools[0].name).toBe("desktop-editor_copy");
    });

    it("enables web search tools and sets webSearchEnabled", async () => {
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("crawl")],
      });

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      expect(state.webSearchEnabled).toBe(true);
      expect(state.tools.some((t) => t.name === "web-search_search")).toBe(
        true
      );
    });

    it("auto-disables tools beyond MAX_TOOL_COUNT on first run", async () => {
      // Create 101 tools — first 100 enabled, 101st auto-disabled
      const tools: TMCPItem[] = [];
      for (let i = 0; i < 101; i++) {
        tools.push(makeTool(`tool${i}`));
      }
      mockServers.getTools.mockResolvedValue({ server: tools });

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      // Only 100 should be in active tools
      expect(state.tools).toHaveLength(100);
      // 101st should be disabled
      expect(state.disabledTools.server).toContain("tool100");
    });

    it("auto-disables tools beyond MAX_TOOL_COUNT when disabledTools exists in localStorage", async () => {
      const tools: TMCPItem[] = [];
      for (let i = 0; i < 101; i++) {
        tools.push(makeTool(`tool${i}`));
      }
      mockServers.getTools.mockResolvedValue({ server: tools });
      localStorageMap.set("disabledTools", JSON.stringify({ server: [] }));

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      expect(state.tools).toHaveLength(100);
      expect(state.disabledTools.server).toContain("tool100");
    });

    it("accounts for web search tools in MAX_TOOL_COUNT limit (first run)", async () => {
      const wsTools = [makeTool("search"), makeTool("crawl")];
      const regularTools: TMCPItem[] = [];
      for (let i = 0; i < 101; i++) {
        regularTools.push(makeTool(`tool${i}`));
      }
      mockServers.getTools.mockResolvedValue({
        "web-search": wsTools,
        server: regularTools,
      });

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      // web-search takes 2 slots, so only 100 regular tools fit (MAX_TOOL_COUNT_WITH_WEB_SEARCH = 102)
      expect(state.webSearchEnabled).toBe(true);
      expect(state.disabledTools.server).toContain("tool100");
    });

    it("enables web search when disabledTools exists but web-search is not disabled", async () => {
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("crawl")],
        server: [makeTool("tool1")],
      });
      localStorageMap.set(
        "disabledTools",
        JSON.stringify({ "web-search": [], server: [] })
      );

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      expect(state.webSearchEnabled).toBe(true);
      expect(state.tools.some((t) => t.name === "web-search_search")).toBe(
        true
      );
    });

    it("creates new disabledTools entry for unknown server type", async () => {
      mockServers.getTools.mockResolvedValue({
        "new-server": [makeTool("tool1")],
      });
      localStorageMap.set("disabledTools", JSON.stringify({}));

      await useServersStore.getState().getTools();

      const state = useServersStore.getState();
      expect(state.disabledTools["new-server"]).toEqual([]);
    });

    it("disables web search when all web tools are disabled", async () => {
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search")],
      });
      localStorageMap.set(
        "disabledTools",
        JSON.stringify({ "web-search": ["search"] })
      );

      await useServersStore.getState().getTools();

      expect(useServersStore.getState().webSearchEnabled).toBe(false);
    });
  });

  describe("changeToolStatus", () => {
    it("enables a previously disabled tool", async () => {
      // Setup initial state with disabled tool
      mockServers.getTools.mockResolvedValue({
        "desktop-editor": [makeTool("paste")],
      });
      localStorageMap.set(
        "disabledTools",
        JSON.stringify({ "desktop-editor": ["paste"] })
      );
      await useServersStore.getState().getTools();

      useServersStore
        .getState()
        .changeToolStatus("desktop-editor", "paste", true);

      const state = useServersStore.getState();
      expect(state.tools.some((t) => t.name === "desktop-editor_paste")).toBe(
        true
      );
      expect(state.disabledTools["desktop-editor"]).not.toContain("paste");
    });

    it("disables an enabled tool", async () => {
      mockServers.getTools.mockResolvedValue({
        "desktop-editor": [makeTool("paste")],
      });
      await useServersStore.getState().getTools();

      useServersStore
        .getState()
        .changeToolStatus("desktop-editor", "paste", false);

      const state = useServersStore.getState();
      expect(state.tools.some((t) => t.name === "desktop-editor_paste")).toBe(
        false
      );
      expect(state.disabledTools["desktop-editor"]).toContain("paste");
    });

    it("enables web search (all tools at once)", async () => {
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("crawl")],
      });
      localStorageMap.set(
        "disabledTools",
        JSON.stringify({ "web-search": ["search", "crawl"] })
      );
      await useServersStore.getState().getTools();

      useServersStore.getState().changeToolStatus("web-search", "search", true);

      expect(useServersStore.getState().webSearchEnabled).toBe(true);
      expect(useServersStore.getState().disabledTools["web-search"]).toEqual(
        []
      );
    });

    it("disables web search (all tools at once)", async () => {
      mockServers.getTools.mockResolvedValue({
        "web-search": [makeTool("search"), makeTool("crawl")],
      });
      await useServersStore.getState().getTools();

      useServersStore
        .getState()
        .changeToolStatus("web-search", "search", false);

      expect(useServersStore.getState().webSearchEnabled).toBe(false);
    });

    it("does nothing when tool not found in servers", async () => {
      useServersStore.setState({
        servers: { server: [makeTool("existing")] },
        tools: [],
        disabledTools: { server: [] },
      });

      useServersStore
        .getState()
        .changeToolStatus("server", "nonexistent", true);

      // No changes, no crash
      expect(useServersStore.getState().tools).toHaveLength(0);
    });

    it("rejects enabling tool when at max capacity with web search enabled", async () => {
      const tools: TMCPItem[] = [];
      for (let i = 0; i < 102; i++) {
        tools.push({ ...makeTool(`tool${i}`), name: `server_tool${i}` });
      }
      useServersStore.setState({
        tools,
        servers: {
          server: [
            ...tools.map((t) => ({
              ...t,
              name: t.name.replace("server_", ""),
            })),
            makeTool("extra"),
          ],
        },
        disabledTools: { server: ["extra"] },
        webSearchEnabled: true,
      });

      useServersStore.getState().changeToolStatus("server", "extra", true);

      // Should not have added (at MAX_TOOL_COUNT_WITH_WEB_SEARCH)
      expect(useServersStore.getState().tools).toHaveLength(102);
    });

    it("rejects enabling tool when at max capacity", async () => {
      // Fill up to MAX_TOOL_COUNT
      const tools: TMCPItem[] = [];
      for (let i = 0; i < 100; i++) {
        tools.push({ ...makeTool(`tool${i}`), name: `server_tool${i}` });
      }
      useServersStore.setState({
        tools,
        servers: {
          server: [
            ...tools.map((t) => ({
              ...t,
              name: t.name.replace("server_", ""),
            })),
            makeTool("extra"),
          ],
        },
        disabledTools: { server: ["extra"] },
        webSearchEnabled: false,
      });

      useServersStore.getState().changeToolStatus("server", "extra", true);

      // Should not have added the tool (still at max)
      expect(useServersStore.getState().tools).toHaveLength(100);
    });

    it("persists disabledTools to localStorage", async () => {
      mockServers.getTools.mockResolvedValue({
        "desktop-editor": [makeTool("paste")],
      });
      await useServersStore.getState().getTools();

      useServersStore
        .getState()
        .changeToolStatus("desktop-editor", "paste", false);

      expect(mockSettings.set).toHaveBeenCalledWith(
        "disabledTools",
        expect.any(String)
      );
    });
  });

  describe("callTools", () => {
    it("routes call to correct server via Servers instance", async () => {
      mockServers.getServerType.mockReturnValue("desktop-editor");
      mockServers.callTools.mockResolvedValue({ result: "ok" });
      useServersStore.setState({ disabledTools: { "desktop-editor": [] } });

      const result = await useServersStore
        .getState()
        .callTools("desktop-editor_paste", { text: "hi" });

      expect(mockServers.getServerType).toHaveBeenCalledWith(
        "desktop-editor_paste"
      );
      expect(mockServers.callTools).toHaveBeenCalledWith(
        "desktop-editor",
        "paste",
        { text: "hi" }
      );
      expect(result).toEqual({ result: "ok" });
    });

    it("returns undefined for disabled tools", async () => {
      mockServers.getServerType.mockReturnValue("desktop-editor");
      useServersStore.setState({
        disabledTools: { "desktop-editor": ["paste"] },
      });

      const result = await useServersStore
        .getState()
        .callTools("desktop-editor_paste", {});

      expect(mockServers.callTools).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe("checkAllowAlways / setAllowAlways", () => {
    it("delegates to Servers instance", () => {
      mockServers.checkAllowAlways.mockReturnValue(true);

      const result = useServersStore
        .getState()
        .checkAllowAlways("mcp", "tool1");

      expect(mockServers.checkAllowAlways).toHaveBeenCalledWith("mcp", "tool1");
      expect(result).toBe(true);
    });

    it("sets allow always via Servers instance", () => {
      useServersStore.getState().setAllowAlways(true, "mcp", "tool1");

      expect(mockServers.setAllowAlways).toHaveBeenCalledWith(
        true,
        "mcp",
        "tool1"
      );
    });
  });

  describe("saveConfig", () => {
    it("persists config and restarts servers", () => {
      const config = {
        mcpServers: { test: { command: "node", args: ["server.js"] } },
      };

      useServersStore.getState().saveConfig(config);

      expect(mockSettings.set).toHaveBeenCalledWith(
        "mcpServers",
        JSON.stringify(config)
      );
      expect(mockServers.setCustomServers).toHaveBeenCalledWith(config);
      expect(mockServers.startCustomServers).toHaveBeenCalledOnce();
    });

    it("wraps config with empty mcpServers when key is missing", () => {
      const config = {} as {
        mcpServers: Record<string, Record<string, unknown>>;
      };

      useServersStore.getState().saveConfig(config);

      const expected = { mcpServers: {} };
      expect(mockServers.setCustomServers).toHaveBeenCalledWith(expected);
    });
  });

  describe("getConfig", () => {
    it("reads config from localStorage", () => {
      const config = { mcpServers: { test: {} } };
      localStorageMap.set("mcpServers", JSON.stringify(config));

      const result = useServersStore.getState().getConfig();

      expect(result).toEqual(config);
    });

    it("returns empty config when nothing stored", () => {
      const result = useServersStore.getState().getConfig();

      expect(result).toEqual({ mcpServers: {} });
    });
  });

  describe("deleteCustomServer", () => {
    it("deletes server and updates config", () => {
      const config = {
        mcpServers: { server1: { cmd: "a" }, server2: { cmd: "b" } },
      };
      localStorageMap.set("mcpServers", JSON.stringify(config));

      useServersStore.getState().deleteCustomServer("server1");

      expect(mockServers.deleteCustomServer).toHaveBeenCalledWith("server1");
      const raw = localStorageMap.get("mcpServers") ?? "{}";
      const saved = JSON.parse(raw);
      expect(saved.mcpServers.server1).toBeUndefined();
      expect(saved.mcpServers.server2).toBeDefined();
    });
  });

  describe("setManageToolData", () => {
    it("sets and clears manage tool data", () => {
      const data = {
        message: { role: "assistant" as const, content: [] },
        idx: 0,
        messageUID: "uid-1",
      };

      useServersStore.getState().setManageToolData(data);
      expect(useServersStore.getState().manageToolData).toEqual(data);

      useServersStore.getState().setManageToolData(undefined);
      expect(useServersStore.getState().manageToolData).toBeUndefined();
    });
  });

  describe("getCustomServersLogs", () => {
    it("delegates to Servers instance", () => {
      const logs = { server1: ["log1", "log2"] };
      mockServers.getCustomServersLogs.mockReturnValue(logs);

      expect(useServersStore.getState().getCustomServersLogs()).toEqual(logs);
    });
  });

  describe("getWebSearchEnabled", () => {
    it("delegates to Servers instance", () => {
      mockServers.getWebSearchEnabled.mockReturnValue(true);

      expect(useServersStore.getState().getWebSearchEnabled()).toBe(true);
    });
  });
});
