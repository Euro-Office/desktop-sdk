import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to ensure mocks are available when vi.mock is hoisted
const {
  localStorageMock,
  desktopEditorGetToolsMock,
  desktopEditorCallToolsMock,
  webSearchGetToolsMock,
  webSearchCallToolsMock,
  webSearchSetDataMock,
  webSearchGetDataMock,
  webSearchGetEnabledMock,
  customServersGetToolsMock,
  customServersCallToolMock,
  customServersGetServerTypeMock,
  customServersSetMock,
  customServersStartMock,
  customServersRestartMock,
  customServersDeleteMock,
} = vi.hoisted(() => {
  // Create localStorage mock and attach to global before any imports
  const storageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => storageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storageMock.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storageMock.store[key];
    }),
    clear: vi.fn(() => {
      storageMock.store = {};
    }),
  };

  Object.defineProperty(global, "localStorage", {
    value: storageMock,
    writable: true,
  });

  // Mock window for CustomServers
  Object.defineProperty(global, "window", {
    value: {
      AscDesktopEditor: undefined,
      dispatchEvent: vi.fn(),
    },
    writable: true,
  });

  return {
    localStorageMock: storageMock,
    desktopEditorGetToolsMock: vi.fn(),
    desktopEditorCallToolsMock: vi.fn(),
    webSearchGetToolsMock: vi.fn(),
    webSearchCallToolsMock: vi.fn(),
    webSearchSetDataMock: vi.fn(),
    webSearchGetDataMock: vi.fn(),
    webSearchGetEnabledMock: vi.fn(),
    customServersGetToolsMock: vi.fn(),
    customServersCallToolMock: vi.fn(),
    customServersGetServerTypeMock: vi.fn(),
    customServersSetMock: vi.fn(),
    customServersStartMock: vi.fn(),
    customServersRestartMock: vi.fn(),
    customServersDeleteMock: vi.fn(),
  };
});

// Mock the dependencies
vi.mock("../DesktopEditor", () => ({
  DesktopEditorTool: class {
    getTools = desktopEditorGetToolsMock;
    callTools = desktopEditorCallToolsMock;
  },
}));

vi.mock("../WebSearch", () => ({
  WebSearch: class {
    getTools = webSearchGetToolsMock;
    callTools = webSearchCallToolsMock;
    setWebSearchData = webSearchSetDataMock;
    getWebSearchData = webSearchGetDataMock;
    getWebSearchEnabled = webSearchGetEnabledMock;
  },
}));

vi.mock("../CustomServers", () => ({
  CustomServers: class {
    getTools = customServersGetToolsMock;
    callToolFromMCP = customServersCallToolMock;
    getServerType = customServersGetServerTypeMock;
    setCustomServers = customServersSetMock;
    startCustomServers = customServersStartMock;
    restartCustomServer = customServersRestartMock;
    deleteCustomServer = customServersDeleteMock;
    customServers = { "test-server": {} };
    stoppedCustomServers: string[] = [];
    customServersLogs = { "test-server": "logs" };
  },
}));

// Import after mocks
import servers from "../index";

describe("Servers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Setup default mock return values
    desktopEditorGetToolsMock.mockResolvedValue([{ name: "desktop_tool" }]);
    desktopEditorCallToolsMock.mockReturnValue("desktop result");
    webSearchGetToolsMock.mockResolvedValue([{ name: "web_search" }]);
    webSearchCallToolsMock.mockResolvedValue("search result");
    webSearchGetDataMock.mockReturnValue({ provider: "test", key: "test-key" });
    webSearchGetEnabledMock.mockReturnValue(true);
    customServersGetToolsMock.mockResolvedValue({
      "custom-server": [{ name: "custom_tool" }],
    });
    customServersCallToolMock.mockResolvedValue("mcp result");
    customServersGetServerTypeMock.mockReturnValue("custom-server");
  });

  describe("constructor", () => {
    it("should initialize with empty allowAlways when localStorage is empty", async () => {
      // The servers singleton is already created, but we can test checkAllowAlways
      expect(servers.checkAllowAlways("some-type", "some-name")).toBe(false);
    });
  });

  describe("checkAllowAlways", () => {
    it("should return true for web-search type", () => {
      expect(servers.checkAllowAlways("web-search", "any-name")).toBe(true);
    });

    it("should return false for unknown tools", () => {
      expect(servers.checkAllowAlways("unknown", "tool")).toBe(false);
    });

    it("should return true for tools in allowAlways list", () => {
      servers.setAllowAlways(true, "custom", "mytool");
      expect(servers.checkAllowAlways("custom", "mytool")).toBe(true);
    });
  });

  describe("setAllowAlways", () => {
    it("should ignore web-search type", () => {
      servers.setAllowAlways(true, "web-search", "search");
      // web-search is always allowed, so this should be a no-op
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("should add tool to allowAlways when value is true", () => {
      servers.setAllowAlways(true, "mcp", "tool1");
      expect(servers.checkAllowAlways("mcp", "tool1")).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("should remove tool from allowAlways when value is false", () => {
      servers.setAllowAlways(true, "mcp", "tool2");
      servers.setAllowAlways(false, "mcp", "tool2");
      expect(servers.checkAllowAlways("mcp", "tool2")).toBe(false);
    });
  });

  describe("getTools", () => {
    it("should return tools from all servers", async () => {
      const tools = await servers.getTools();

      expect(tools).toHaveProperty("desktop-editor");
      expect(tools).toHaveProperty("web-search");
      expect(tools).toHaveProperty("custom-server");
    });
  });

  describe("callTools", () => {
    it("should call desktop editor tools", async () => {
      const result = await servers.callTools("desktop-editor", "tool", {});
      expect(result).toBe("desktop result");
    });

    it("should call web search tools", async () => {
      const result = await servers.callTools("web-search", "web_search", {});
      expect(result).toBe("search result");
    });

    it("should call MCP server tools for other types", async () => {
      const result = await servers.callTools(
        "custom-server",
        "custom_tool",
        {}
      );
      expect(result).toBe("mcp result");
    });
  });

  describe("getServerType", () => {
    it("should return desktop-editor for desktop-editor tools", () => {
      expect(servers.getServerType("desktop-editor_tool")).toBe(
        "desktop-editor"
      );
    });

    it("should return web-search for web-search tools", () => {
      expect(servers.getServerType("web-search_tool")).toBe("web-search");
    });

    it("should delegate to customServers for other tools", () => {
      expect(servers.getServerType("other_tool")).toBe("custom-server");
    });
  });

  describe("custom server management", () => {
    it("should set custom servers", () => {
      servers.setCustomServers({ mcpServers: { test: {} } });
      expect(customServersSetMock).toHaveBeenCalled();
    });

    it("should start custom servers", () => {
      servers.startCustomServers();
      expect(customServersStartMock).toHaveBeenCalled();
    });

    it("should restart custom server", () => {
      servers.restartCustomServer("test");
      expect(customServersRestartMock).toHaveBeenCalledWith("test");
    });

    it("should delete custom server", () => {
      servers.deleteCustomServer("test");
      expect(customServersDeleteMock).toHaveBeenCalledWith("test");
    });

    it("should get custom servers", () => {
      const result = servers.getCustomServers();
      expect(result).toEqual({ "test-server": {} });
    });

    it("should get stopped custom servers", () => {
      const result = servers.getCustomServersStoped();
      expect(result).toEqual([]);
    });

    it("should get custom servers logs", () => {
      const result = servers.getCustomServersLogs();
      expect(result).toEqual({ "test-server": "logs" });
    });
  });

  describe("web search management", () => {
    it("should set web search data", () => {
      servers.setWebSearchData({ provider: "test", key: "test-key" });
      expect(webSearchSetDataMock).toHaveBeenCalledWith({
        provider: "test",
        key: "test-key",
      });
    });

    it("should get web search data", () => {
      const result = servers.getWebSearchData();
      expect(result).toEqual({ provider: "test", key: "test-key" });
    });

    it("should get web search enabled status", () => {
      const result = servers.getWebSearchEnabled();
      expect(result).toBe(true);
    });
  });
});
