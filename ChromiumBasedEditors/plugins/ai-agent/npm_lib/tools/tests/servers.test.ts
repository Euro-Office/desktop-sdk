import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TMCPItem } from "../../types";

const mockSettings = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  remove: vi.fn(),
};

const mockPlatform = {
  file: null,
  process: null,
  env: { platform: "desktop" },
  hostTools: null,
};

const mockEventBus = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

const mockHostToolSource = {
  getGroupIds: vi.fn().mockReturnValue([]),
  getToolsByGroup: vi.fn().mockResolvedValue({}),
  isAutoAllow: vi.fn().mockReturnValue(false),
  callTool: vi.fn().mockResolvedValue("host-result"),
};

const mockCustomServers = {
  getTools: vi.fn().mockResolvedValue({}),
  callToolFromMCP: vi.fn().mockResolvedValue("custom-result"),
  getServerType: vi.fn().mockReturnValue("my-server"),
};

const mockWebSearch = {
  getTools: vi.fn().mockResolvedValue([]),
  callTools: vi.fn().mockResolvedValue("web-result"),
};

vi.mock("../sources/HostToolSource", () => ({
  HostToolSource: class {
    constructor() {
      return mockHostToolSource;
    }
  },
}));

vi.mock("../sources/CustomServers", () => ({
  CustomServers: class {
    constructor() {
      return mockCustomServers;
    }
  },
}));

vi.mock("../sources/WebSearch", () => ({
  WebSearch: class {
    constructor() {
      return mockWebSearch;
    }
  },
}));

import Servers from "../servers";

describe("Servers", () => {
  let servers: Servers;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.get.mockReturnValue(null);
    mockHostToolSource.getGroupIds.mockReturnValue([]);
    mockHostToolSource.getToolsByGroup.mockResolvedValue({});
    mockHostToolSource.isAutoAllow.mockReturnValue(false);
    mockCustomServers.getTools.mockResolvedValue({});
    mockWebSearch.getTools.mockResolvedValue([]);
    servers = new Servers(mockSettings as any, mockPlatform as any, mockEventBus as any);
  });

  describe("constructor", () => {
    it("reads allowAlways from localStorage", () => {
      expect(mockSettings.get).toHaveBeenCalledWith("allowAlwaysTools");
    });

    it("parses stored allowAlways tools", () => {
      mockSettings.get.mockReturnValue("server_tool1,server_tool2");
      const s = new Servers(mockSettings as any, mockPlatform as any, mockEventBus as any);
      expect(s.allowAlways).toEqual(["server_tool1", "server_tool2"]);
    });

    it("defaults to empty array when localStorage returns null", () => {
      expect(servers.allowAlways).toEqual([]);
    });
  });

  describe("checkAllowAlways", () => {
    it("returns true for web-search type", () => {
      expect(servers.checkAllowAlways("web-search", "web_search")).toBe(true);
    });

    it("returns true if hostToolSource.isAutoAllow returns true", () => {
      mockHostToolSource.getGroupIds.mockReturnValue(["desktop-editor"]);
      mockHostToolSource.isAutoAllow.mockReturnValue(true);
      expect(servers.checkAllowAlways("desktop-editor", "read_file")).toBe(
        true
      );
    });

    it("returns true if tool is in allowAlways list", () => {
      servers.allowAlways = ["myserver_mytool"];
      expect(servers.checkAllowAlways("myserver", "mytool")).toBe(true);
    });

    it("returns false otherwise", () => {
      expect(servers.checkAllowAlways("unknown", "unknown_tool")).toBe(false);
    });
  });

  describe("setAllowAlways", () => {
    it("adds tool to list and saves to localStorage", () => {
      servers.setAllowAlways(true, "myserver", "mytool");
      expect(servers.allowAlways).toContain("myserver_mytool");
      expect(mockSettings.set).toHaveBeenCalledWith(
        "allowAlwaysTools",
        "myserver_mytool"
      );
    });

    it("removes tool from list and saves to localStorage", () => {
      servers.allowAlways = ["myserver_mytool", "other_tool"];
      servers.setAllowAlways(false, "myserver", "mytool");
      expect(servers.allowAlways).not.toContain("myserver_mytool");
      expect(servers.allowAlways).toContain("other_tool");
      expect(mockSettings.set).toHaveBeenCalledWith(
        "allowAlwaysTools",
        "other_tool"
      );
    });

    it("ignores web-search type", () => {
      servers.setAllowAlways(true, "web-search", "web_search");
      expect(servers.allowAlways).toEqual([]);
      expect(mockSettings.set).not.toHaveBeenCalled();
    });
  });

  describe("getTools", () => {
    it("aggregates tools from all 3 sources", async () => {
      const hostTools: Record<string, TMCPItem[]> = {
        "desktop-editor": [
          { name: "read_file", description: "Read", inputSchema: {} },
        ],
      };
      const webTools: TMCPItem[] = [
        { name: "web_search", description: "Search", inputSchema: {} },
      ];
      const customTools: Record<string, TMCPItem[]> = {
        "my-mcp": [
          { name: "custom_tool", description: "Custom", inputSchema: {} },
        ],
      };

      mockHostToolSource.getToolsByGroup.mockResolvedValue(hostTools);
      mockWebSearch.getTools.mockResolvedValue(webTools);
      mockCustomServers.getTools.mockResolvedValue(customTools);

      const result = await servers.getTools();

      expect(result).toEqual({
        "desktop-editor": hostTools["desktop-editor"],
        "web-search": webTools,
        "my-mcp": customTools["my-mcp"],
      });
    });
  });

  describe("callTools", () => {
    it("routes to hostToolSource for host group", async () => {
      mockHostToolSource.getGroupIds.mockReturnValue(["desktop-editor"]);
      const result = await servers.callTools("desktop-editor", "read_file", {
        path: "/test",
      });
      expect(mockHostToolSource.callTool).toHaveBeenCalledWith("read_file", {
        path: "/test",
      });
      expect(result).toBe("host-result");
    });

    it("routes to webSearch for web-search type", async () => {
      const result = await servers.callTools("web-search", "web_search", {
        query: "test",
      });
      expect(mockWebSearch.callTools).toHaveBeenCalledWith("web_search", {
        query: "test",
      });
      expect(result).toBe("web-result");
    });

    it("routes to customServers for other types", async () => {
      const result = await servers.callTools("my-mcp", "custom_tool", {
        arg: "val",
      });
      expect(mockCustomServers.callToolFromMCP).toHaveBeenCalledWith(
        "my-mcp",
        "custom_tool",
        { arg: "val" }
      );
      expect(result).toBe("custom-result");
    });
  });

  describe("getServerType", () => {
    it("checks hostToolSource groups first", () => {
      mockHostToolSource.getGroupIds.mockReturnValue(["desktop-editor"]);
      const result = servers.getServerType("desktop-editor_read_file");
      expect(result).toBe("desktop-editor");
    });

    it("returns web-search for web-search prefixed names", () => {
      const result = servers.getServerType("web-search_web_search");
      expect(result).toBe("web-search");
    });

    it("falls through to customServers for other names", () => {
      mockCustomServers.getServerType.mockReturnValue("my-mcp");
      const result = servers.getServerType("my-mcp_custom_tool");
      expect(result).toBe("my-mcp");
      expect(mockCustomServers.getServerType).toHaveBeenCalledWith(
        "my-mcp_custom_tool"
      );
    });
  });
});
