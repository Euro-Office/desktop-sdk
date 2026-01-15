import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomServers } from "../CustomServers";

// =============================================================================
// Mock Setup
// =============================================================================

const mockDispatchEvent = vi.fn();
const mockFetch = vi.fn();

// Track processes
let processCount = 0;
let lastProcess: {
  start: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  stdin: ReturnType<typeof vi.fn>;
  onprocess: (t: number, message: string) => void;
};

class MockExternalProcess {
  start = vi.fn();
  end = vi.fn();
  stdin = vi.fn();
  onprocess: (t: number, message: string) => void = () => {
    /* noop */
  };

  constructor(_cmd: string, _env: Record<string, string>) {
    processCount++;
    lastProcess = this;
  }
}

const mockWindow = {
  ExternalProcess: MockExternalProcess,
  dispatchEvent: mockDispatchEvent,
  CustomEvent: class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  },
};

vi.stubGlobal("window", mockWindow);
vi.stubGlobal("fetch", mockFetch);

// Helper to create mock fetch response with text() method
const createMockResponse = (data: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  text: () => Promise.resolve(JSON.stringify(data)),
});

// Helper to create mock SSE-formatted response
const createSSEMockResponse = (data: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  text: () =>
    Promise.resolve(`event: message\ndata: ${JSON.stringify(data)}\n\n`),
});

describe("CustomServers", () => {
  let customServers: CustomServers;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    processCount = 0;
    customServers = new CustomServers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe("constructor", () => {
    it("should initialize with empty state", () => {
      expect(customServers.customServers).toEqual({});
      expect(customServers.startedCustomServers).toEqual({});
      expect(customServers.initedCustomServers).toEqual({});
      expect(customServers.stoppedCustomServers).toEqual([]);
      expect(customServers.tools).toEqual({});
      expect(customServers.httpServers).toEqual({});
    });
  });

  // ==========================================================================
  // setCustomServers
  // ==========================================================================

  describe("setCustomServers", () => {
    it("should set custom servers from config", () => {
      const config = {
        mcpServers: {
          filesystem: { command: "npx", args: ["-y", "mcp-fs"] },
        },
      };

      customServers.setCustomServers(config);

      expect(customServers.customServers).toEqual(config.mcpServers);
    });
  });

  // ==========================================================================
  // getServerType
  // ==========================================================================

  describe("getServerType", () => {
    it("should return server type from tool name", () => {
      customServers.setCustomServers({
        mcpServers: { filesystem: {}, github: {} },
      });

      expect(customServers.getServerType("filesystem_read")).toBe("filesystem");
      expect(customServers.getServerType("github_issue")).toBe("github");
    });

    it("should return empty string for unknown tool", () => {
      expect(customServers.getServerType("unknown_tool")).toBe("");
    });
  });

  // ==========================================================================
  // startCustomServers - Stdio
  // ==========================================================================

  describe("startCustomServers - Stdio", () => {
    it("should start configured servers", () => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx", args: ["test"] } },
      });

      const countBefore = processCount;
      customServers.startCustomServers();

      expect(processCount).toBeGreaterThan(countBefore);
      expect(lastProcess.start).toHaveBeenCalled();
    });

    it("should pass env variables", () => {
      customServers.setCustomServers({
        mcpServers: {
          test: { command: "cmd", env: { TOKEN: "abc" } },
        },
      });

      customServers.startCustomServers();

      expect(processCount).toBe(1);
    });

    it("should not restart if same command", () => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx", args: ["test"] } },
      });
      customServers.startCustomServers();
      customServers.startedCustomServers.test = "npx test";

      const countBefore = processCount;
      customServers.startCustomServers();

      expect(processCount).toBe(countBefore);
    });

    it("should initialize logs", () => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });

      customServers.startCustomServers();

      expect(customServers.customServersLogs.test).toBeDefined();
    });

    it("should end existing process when command changes", () => {
      // Line 234: end existing process when starting with different command
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx", args: ["old-cmd"] } },
      });
      customServers.startCustomServers();

      const oldProcess = customServers.customServersProcesses.test;
      customServers.startedCustomServers.test = "npx old-cmd";

      // Now change the command
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx", args: ["new-cmd"] } },
      });
      customServers.startCustomServers();

      expect(oldProcess.end).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // startCustomServers - HTTP
  // ==========================================================================

  describe("startCustomServers - HTTP", () => {
    it("should start HTTP server with url config", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpServer",
          result: { capabilities: {} },
        })
      );

      customServers.setCustomServers({
        mcpServers: {
          httpServer: {
            url: "https://api.example.com/mcp",
            headers: { Authorization: "Bearer token" },
          },
        },
      });

      customServers.startCustomServers();

      // Should not create a process for HTTP servers
      expect(processCount).toBe(0);
      expect(customServers.httpServers.httpServer).toBeDefined();
      expect(customServers.httpServers.httpServer.url).toBe(
        "https://api.example.com/mcp"
      );
    });

    it("should not restart HTTP server if same URL", () => {
      customServers.setCustomServers({
        mcpServers: {
          httpServer: { url: "https://api.example.com/mcp" },
        },
      });
      customServers.startedCustomServers.httpServer =
        "https://api.example.com/mcp";
      customServers.httpServers.httpServer = {
        url: "https://api.example.com/mcp",
      };

      customServers.startCustomServers();

      // Should not call fetch for already started server
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should abort existing HTTP server when URL changes", async () => {
      // Line 206: abort existing connection before starting new one
      const abortController = new AbortController();
      const abortSpy = vi.spyOn(abortController, "abort");

      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpServer",
          result: { capabilities: {} },
        })
      );

      customServers.httpServers.httpServer = {
        url: "https://old-url.com/mcp",
        abortController,
      };
      customServers.startedCustomServers.httpServer = "https://old-url.com/mcp";

      customServers.setCustomServers({
        mcpServers: {
          httpServer: { url: "https://new-url.com/mcp" },
        },
      });

      customServers.startCustomServers();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should use onlyoffice-proxy:// prefix for HTTP requests", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpServer",
          result: { capabilities: {} },
        })
      );

      customServers.setCustomServers({
        mcpServers: {
          httpServer: { url: "https://api.example.com/mcp" },
        },
      });

      customServers.startCustomServers();

      // Wait for async init
      await vi.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledWith(
        "onlyoffice-proxy://https://api.example.com/mcp",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  // ==========================================================================
  // restartCustomServer
  // ==========================================================================

  describe("restartCustomServer - Stdio", () => {
    beforeEach(() => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();
    });

    it("should end old and start new process", () => {
      const oldProcess = customServers.customServersProcesses.test;

      customServers.restartCustomServer("test");

      expect(oldProcess.end).toHaveBeenCalled();
      expect(lastProcess.start).toHaveBeenCalled();
    });

    it("should clear tools", () => {
      customServers.tools.test = [
        { name: "t", description: "", inputSchema: {} },
      ];

      customServers.restartCustomServer("test");

      expect(customServers.tools.test).toEqual([]);
    });
  });

  describe("restartCustomServer - HTTP", () => {
    it("should restart HTTP server", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpServer",
          result: { capabilities: {} },
        })
      );

      customServers.setCustomServers({
        mcpServers: {
          httpServer: { url: "https://example.com/mcp" },
        },
      });
      customServers.httpServers.httpServer = {
        url: "https://example.com/mcp",
        abortController: new AbortController(),
      };
      customServers.initedCustomServers.httpServer = true;

      customServers.restartCustomServer("httpServer");

      expect(customServers.initedCustomServers.httpServer).toBe(false);
      expect(customServers.tools.httpServer).toEqual([]);
      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    it("should restart HTTP server without abortController", async () => {
      // Line 267: branch where abortController is undefined
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpServer",
          result: { capabilities: {} },
        })
      );

      customServers.setCustomServers({
        mcpServers: {
          httpServer: { url: "https://example.com/mcp" },
        },
      });
      customServers.httpServers.httpServer = {
        url: "https://example.com/mcp",
        // No abortController
      };
      customServers.initedCustomServers.httpServer = true;

      customServers.restartCustomServer("httpServer");

      expect(customServers.initedCustomServers.httpServer).toBe(false);
    });

    it("should skip non-matching server type in restart", () => {
      // Line 255: early return when type !== serverType
      customServers.setCustomServers({
        mcpServers: {
          httpServer: { url: "https://example.com/mcp" },
        },
      });

      customServers.restartCustomServer("nonexistent");

      // Should not call fetch because no matching server
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // deleteCustomServer
  // ==========================================================================

  describe("deleteCustomServer - Stdio", () => {
    beforeEach(() => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();
    });

    it("should clean up all state", () => {
      const proc = customServers.customServersProcesses.test;

      customServers.deleteCustomServer("test");

      expect(proc.end).toHaveBeenCalled();
      expect(customServers.customServersProcesses.test).toBeUndefined();
      expect(customServers.customServers.test).toBeUndefined();
    });

    it("should dispatch tools-changed", () => {
      customServers.deleteCustomServer("test");

      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    it("should delete tools when they exist", () => {
      customServers.tools.test = [
        { name: "tool1", description: "test tool", inputSchema: {} },
      ];

      customServers.deleteCustomServer("test");

      expect(customServers.tools.test).toBeUndefined();
    });
  });

  describe("deleteCustomServer - HTTP", () => {
    it("should clean up HTTP server state", () => {
      const abortController = new AbortController();
      const abortSpy = vi.spyOn(abortController, "abort");

      customServers.httpServers.httpServer = {
        url: "https://example.com/mcp",
        abortController,
      };
      customServers.customServersLogs.httpServer = ["log"];
      customServers.startedCustomServers.httpServer = "https://example.com/mcp";
      customServers.customServers.httpServer = {
        url: "https://example.com/mcp",
      };
      customServers.tools.httpServer = [
        { name: "tool", description: "", inputSchema: {} },
      ];

      customServers.deleteCustomServer("httpServer");

      expect(abortSpy).toHaveBeenCalled();
      expect(customServers.httpServers.httpServer).toBeUndefined();
      expect(customServers.customServersLogs.httpServer).toBeUndefined();
      expect(customServers.startedCustomServers.httpServer).toBeUndefined();
      expect(customServers.tools.httpServer).toBeUndefined();
    });

    it("should clean up HTTP server without abortController", () => {
      // Line 321: branch where abortController is undefined
      customServers.httpServers.httpServer = {
        url: "https://example.com/mcp",
        // No abortController
      };
      customServers.customServersLogs.httpServer = ["log"];

      customServers.deleteCustomServer("httpServer");

      expect(customServers.httpServers.httpServer).toBeUndefined();
    });
  });

  // ==========================================================================
  // onProcess
  // ==========================================================================

  describe("onProcess", () => {
    beforeEach(() => {
      customServers.customServersLogs.test = [];
    });

    it("should log stdout (type 0)", () => {
      customServers.onProcess("test", 0, "message");

      expect(customServers.customServersLogs.test[0]).toContain("message");
    });

    it("should log stderr (type 1)", () => {
      customServers.onProcess("test", 1, "error");

      expect(customServers.customServersLogs.test[0]).toContain("error");
    });

    it("should mark stopped on type 2", () => {
      customServers.onProcess("test", 2, "stopped");

      expect(customServers.stoppedCustomServers).toContain("test");
    });

    it("should handle init response", () => {
      const msg = JSON.stringify({
        jsonrpc: "2.0",
        id: "init-test",
        result: {},
      });

      customServers.onProcess("test", 0, msg);

      expect(customServers.initedCustomServers.test).toBe(true);
    });

    it("should remove server from stoppedCustomServers on init response", () => {
      // Add server to stopped list first (line 111)
      customServers.stoppedCustomServers = ["test", "other"];

      const msg = JSON.stringify({
        jsonrpc: "2.0",
        id: "init-test",
        result: {},
      });

      customServers.onProcess("test", 0, msg);

      expect(customServers.stoppedCustomServers).not.toContain("test");
      expect(customServers.stoppedCustomServers).toContain("other");
    });

    it("should handle tools response", () => {
      const msg = JSON.stringify({
        jsonrpc: "2.0",
        id: "tools-test-123",
        result: { tools: [{ name: "tool1" }] },
      });

      customServers.onProcess("test", 0, msg);

      expect(customServers.tools.test).toEqual([{ name: "tool1" }]);
    });

    it("should handle unknown message type (default case)", () => {
      customServers.onProcess("test", 99, "unknown message");

      expect(customServers.customServersLogs.test).toEqual([]);
    });
  });

  // ==========================================================================
  // initCustomServer (Stdio)
  // ==========================================================================

  describe("initCustomServer", () => {
    it("should send init request periodically", () => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();

      vi.advanceTimersByTime(1000);

      const proc = customServers.customServersProcesses.test;
      const stdinMock = proc.stdin as unknown as ReturnType<typeof vi.fn>;
      expect(stdinMock).toHaveBeenCalled();

      const msg = stdinMock.mock.calls[0][0];
      expect(msg).toContain("initialize");
    });

    it("should return early if no process", () => {
      customServers.initCustomServer("nonexistent");
      // Should not throw
    });

    it("should stop after server is initialized", () => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();

      customServers.initedCustomServers.test = true;

      vi.advanceTimersByTime(1000);

      const proc = customServers.customServersProcesses.test;
      const calls = (proc.stdin as ReturnType<typeof vi.fn>).mock.calls;
      const hasToolsCall = calls.some((call: string[]) =>
        call[0].includes("tools/list")
      );
      expect(hasToolsCall).toBe(true);
    });
  });

  // ==========================================================================
  // initHttpServer
  // ==========================================================================

  describe("initHttpServer", () => {
    it("should send initialize request to HTTP server", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpTest",
          result: { capabilities: {} },
        })
      );

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
        headers: { "X-Custom": "header" },
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.initHttpServer("httpTest");

      expect(mockFetch).toHaveBeenCalledWith(
        "onlyoffice-proxy://https://example.com/mcp",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Custom": "header",
          },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe("initialize");
    });

    it("should mark server as initialized on success", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            jsonrpc: "2.0",
            id: "init-httpTest",
            result: { capabilities: {} },
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            jsonrpc: "2.0",
            id: "tools-httpTest-123",
            result: { tools: [] },
          })
        );

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.initHttpServer("httpTest");

      expect(customServers.initedCustomServers.httpTest).toBe(true);
    });

    it("should handle HTTP error during init", async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, false));

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.initHttpServer("httpTest");

      expect(customServers.stoppedCustomServers).toContain("httpTest");
    });

    it("should return early if no server", async () => {
      await customServers.initHttpServer("nonexistent");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should remove server from stoppedCustomServers on HTTP init", async () => {
      // Lines 385-386: filter stoppedCustomServers on successful init
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            jsonrpc: "2.0",
            id: "init-httpTest",
            result: { capabilities: {} },
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            jsonrpc: "2.0",
            id: "tools-httpTest-123",
            result: { tools: [] },
          })
        );

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];
      customServers.stoppedCustomServers = ["httpTest", "other"];

      await customServers.initHttpServer("httpTest");

      expect(customServers.stoppedCustomServers).not.toContain("httpTest");
      expect(customServers.stoppedCustomServers).toContain("other");
    });

    it("should parse SSE-formatted response", async () => {
      // Lines 49-52: SSE data: parsing
      mockFetch
        .mockResolvedValueOnce(
          createSSEMockResponse({
            jsonrpc: "2.0",
            id: "init-httpTest",
            result: { capabilities: {} },
          })
        )
        .mockResolvedValueOnce(
          createSSEMockResponse({
            jsonrpc: "2.0",
            id: "tools-httpTest-123",
            result: { tools: [{ name: "sse-tool" }] },
          })
        );

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.initHttpServer("httpTest");

      expect(customServers.initedCustomServers.httpTest).toBe(true);
    });

    it("should not initialize if response id does not match", async () => {
      // Line 383: branch where msg.id doesn't include init-${type}
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "wrong-id",
          result: { capabilities: {} },
        })
      );

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.initHttpServer("httpTest");

      // Should not be marked as initialized
      expect(customServers.initedCustomServers.httpTest).toBeFalsy();
    });

    it("should not initialize if response is not jsonrpc 2.0", async () => {
      // Line 383: branch where msg.jsonrpc !== "2.0"
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "1.0",
          id: "init-httpTest",
          result: { capabilities: {} },
        })
      );

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.initHttpServer("httpTest");

      // Should not be marked as initialized
      expect(customServers.initedCustomServers.httpTest).toBeFalsy();
    });
  });

  // ==========================================================================
  // getToolsFromHttpMCP
  // ==========================================================================

  describe("getToolsFromHttpMCP", () => {
    it("should handle HTTP error when getting tools", async () => {
      // Line 463: throw error on non-ok HTTP response
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.getToolsFromHttpMCP("httpTest");

      // Line 473: console.error should be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error getting tools from HTTP MCP server"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle network error when getting tools", async () => {
      // Line 473: catch block for network errors
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      mockFetch.mockRejectedValue(new Error("Network failure"));

      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
      };
      customServers.customServersLogs.httpTest = [];

      await customServers.getToolsFromHttpMCP("httpTest");

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should return early if server not found", async () => {
      await customServers.getToolsFromHttpMCP("nonexistent");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getToolsFromMCP (Stdio)
  // ==========================================================================

  describe("getToolsFromMCP", () => {
    it("should handle stdin error when getting tools", async () => {
      // Line 496: catch block for stdin errors
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();

      const proc = customServers.customServersProcesses.test;
      (proc.stdin as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("stdin error");
      });

      await customServers.getToolsFromMCP("test");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error getting tools from MCP server"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // callToolFromMCP - Stdio
  // ==========================================================================

  describe("callToolFromMCP - Stdio", () => {
    beforeEach(() => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();
      customServers.tools.test = [
        { name: "read_file", description: "Read", inputSchema: {} },
      ];
    });

    it("should throw if server not running", async () => {
      customServers.customServersProcesses = {};

      await expect(
        customServers.callToolFromMCP("test", "read_file", {})
      ).rejects.toThrow("MCP server test is not running");
    });

    it("should throw if tool not found", async () => {
      await expect(
        customServers.callToolFromMCP("test", "unknown", {})
      ).rejects.toThrow("Tool unknown not found");
    });

    it("should send tool call and resolve on response", async () => {
      const proc = customServers.customServersProcesses.test;
      const stdinMock = proc.stdin as unknown as ReturnType<typeof vi.fn>;

      const promise = customServers.callToolFromMCP("test", "read_file", {
        path: "/test",
      });

      const msg = stdinMock.mock.calls[0][0];
      const parsed = JSON.parse(msg.trim());

      proc.onprocess(
        0,
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { content: "data" },
        })
      );

      const result = await promise;
      expect(result).toBe(JSON.stringify({ content: "data" }));
    });

    it("should timeout after 30 seconds", async () => {
      const promise = customServers.callToolFromMCP("test", "read_file", {});

      vi.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow("Timeout");
    });

    it("should reject pending tool call on error response", async () => {
      const promise = customServers.callToolFromMCP("test", "read_file", {});

      const proc = customServers.customServersProcesses.test;
      const stdinMock = proc.stdin as ReturnType<typeof vi.fn>;
      const msg = stdinMock.mock.calls[0][0];
      const parsed = JSON.parse(msg.trim());

      proc.onprocess(
        0,
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          error: { code: -32000, message: "Tool failed" },
        })
      );

      await expect(promise).rejects.toThrow("Tool failed");
    });
  });

  // ==========================================================================
  // callToolFromMCP - HTTP
  // ==========================================================================

  describe("callToolFromMCP - HTTP", () => {
    beforeEach(() => {
      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer token" },
      };
      customServers.tools.httpTest = [
        { name: "search", description: "Search", inputSchema: {} },
      ];
      customServers.customServersLogs.httpTest = [];
    });

    it("should throw if HTTP server not running", async () => {
      customServers.httpServers = {};

      // When httpServers is empty, it falls through to stdio path
      await expect(
        customServers.callToolFromMCP("httpTest", "search", {})
      ).rejects.toThrow("MCP server httpTest is not running");
    });

    it("should throw if tool not found on HTTP server", async () => {
      await expect(
        customServers.callToolFromMCP("httpTest", "unknown", {})
      ).rejects.toThrow("Tool unknown not found");
    });

    it("should send tool call via fetch", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "call-httpTest-search-123",
          result: { results: ["item1"] },
        })
      );

      const result = await customServers.callToolFromMCP("httpTest", "search", {
        query: "test",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "onlyoffice-proxy://https://example.com/mcp",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token",
          },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe("tools/call");
      expect(body.params.name).toBe("search");
      expect(body.params.arguments).toEqual({ query: "test" });

      expect(result).toBe(JSON.stringify({ results: ["item1"] }));
    });

    it("should handle HTTP error in tool call", async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, false));

      await expect(
        customServers.callToolFromMCP("httpTest", "search", {})
      ).rejects.toThrow("HTTP 500");
    });

    it("should handle MCP error response in HTTP tool call", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "call-httpTest-search-123",
          error: { code: -32000, message: "Search failed" },
        })
      );

      await expect(
        customServers.callToolFromMCP("httpTest", "search", {})
      ).rejects.toThrow("Search failed");
    });

    it("should throw if HTTP server not found for direct call", async () => {
      // Line 522: direct call to callToolFromHttpMCP when server doesn't exist
      customServers.httpServers = {};

      await expect(
        customServers.callToolFromHttpMCP("httpTest", "search", {})
      ).rejects.toThrow("HTTP MCP server httpTest is not running");
    });

    it("should throw if no result in HTTP response", async () => {
      // Line 579: response without result field
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "call-httpTest-search-123",
          // No result or error field
        })
      );

      await expect(
        customServers.callToolFromMCP("httpTest", "search", {})
      ).rejects.toThrow("No result in response");
    });

    it("should parse SSE-formatted response in tool call", async () => {
      // Lines 49-52: SSE parsing in tool call context
      mockFetch.mockResolvedValue(
        createSSEMockResponse({
          jsonrpc: "2.0",
          id: "call-httpTest-search-123",
          result: { data: "sse-result" },
        })
      );

      const result = await customServers.callToolFromMCP("httpTest", "search", {
        query: "test",
      });

      expect(result).toBe(JSON.stringify({ data: "sse-result" }));
    });
  });

  // ==========================================================================
  // callToolFromStdioMCP error handling
  // ==========================================================================

  describe("callToolFromStdioMCP error handling", () => {
    beforeEach(() => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();
      customServers.tools.test = [
        { name: "read_file", description: "Read", inputSchema: {} },
      ];
    });

    it("should catch and rethrow stdin errors during tool call", async () => {
      // Line 669: catch block when stdin throws during tool call
      const proc = customServers.customServersProcesses.test;
      (proc.stdin as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Connection lost");
      });

      await expect(
        customServers.callToolFromStdioMCP("test", "read_file", {})
      ).rejects.toThrow(
        "Error calling MCP tool read_file on server test: Error: Connection lost"
      );
    });

    it("should use empty array when tools are not defined for server", async () => {
      // Branch coverage: tools[serverType] || []
      customServers.tools = {}; // No tools defined

      await expect(
        customServers.callToolFromStdioMCP("test", "read_file", {})
      ).rejects.toThrow("Tool read_file not found");
    });

    it("should ignore non-matching response ids", async () => {
      const proc = customServers.customServersProcesses.test;
      const stdinMock = proc.stdin as unknown as ReturnType<typeof vi.fn>;

      const promise = customServers.callToolFromStdioMCP("test", "read_file", {
        path: "/test",
      });

      const msg = stdinMock.mock.calls[0][0];
      const parsed = JSON.parse(msg.trim());

      // Send a response with different id (should be ignored)
      proc.onprocess(
        0,
        JSON.stringify({
          jsonrpc: "2.0",
          id: "different-id",
          result: { content: "wrong" },
        })
      );

      // Send correct response
      proc.onprocess(
        0,
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { content: "correct" },
        })
      );

      const result = await promise;
      expect(result).toBe(JSON.stringify({ content: "correct" }));
    });

    it("should ignore invalid JSON in responses", async () => {
      const proc = customServers.customServersProcesses.test;
      const stdinMock = proc.stdin as unknown as ReturnType<typeof vi.fn>;

      const promise = customServers.callToolFromStdioMCP("test", "read_file", {
        path: "/test",
      });

      const msg = stdinMock.mock.calls[0][0];
      const parsed = JSON.parse(msg.trim());

      // Send invalid JSON (should be ignored)
      proc.onprocess(0, "not valid json");

      // Send correct response
      proc.onprocess(
        0,
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { content: "data" },
        })
      );

      const result = await promise;
      expect(result).toBe(JSON.stringify({ content: "data" }));
    });

    it("should ignore stderr messages during tool call", async () => {
      const proc = customServers.customServersProcesses.test;
      const stdinMock = proc.stdin as unknown as ReturnType<typeof vi.fn>;

      const promise = customServers.callToolFromStdioMCP("test", "read_file", {
        path: "/test",
      });

      const msg = stdinMock.mock.calls[0][0];
      const parsed = JSON.parse(msg.trim());

      // Send stderr message (type 1), should be ignored
      proc.onprocess(
        1,
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { content: "stderr-data" },
        })
      );

      // Send correct stdout response
      proc.onprocess(
        0,
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: { content: "stdout-data" },
        })
      );

      const result = await promise;
      expect(result).toBe(JSON.stringify({ content: "stdout-data" }));
    });
  });

  // ==========================================================================
  // callToolFromHttpMCP edge cases
  // ==========================================================================

  describe("callToolFromHttpMCP edge cases", () => {
    beforeEach(() => {
      customServers.httpServers.httpTest = {
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer token" },
      };
      customServers.customServersLogs.httpTest = [];
    });

    it("should use empty array when tools are not defined for HTTP server", async () => {
      // Branch coverage: tools[serverType] || []
      customServers.tools = {}; // No tools defined

      await expect(
        customServers.callToolFromHttpMCP("httpTest", "search", {})
      ).rejects.toThrow("Tool search not found");
    });
  });

  // ==========================================================================
  // getTools
  // ==========================================================================

  describe("getTools", () => {
    it("should return tools object", () => {
      customServers.tools = {
        server1: [{ name: "t1", description: "", inputSchema: {} }],
      };

      expect(customServers.getTools()).toEqual(customServers.tools);
    });
  });

  // ==========================================================================
  // initCustomServer stdin error
  // ==========================================================================

  describe("initCustomServer stdin error", () => {
    it("should catch stdin errors", () => {
      customServers.setCustomServers({
        mcpServers: { test: { command: "npx" } },
      });
      customServers.startCustomServers();

      const proc = customServers.customServersProcesses.test;
      (proc.stdin as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("stdin error");
      });

      // Should not throw
      vi.advanceTimersByTime(1000);
    });
  });

  // ==========================================================================
  // Mixed servers (both stdio and HTTP)
  // ==========================================================================

  describe("Mixed servers", () => {
    it("should handle both stdio and HTTP servers", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          jsonrpc: "2.0",
          id: "init-httpServer",
          result: { capabilities: {} },
        })
      );

      customServers.setCustomServers({
        mcpServers: {
          stdioServer: { command: "npx", args: ["mcp-stdio"] },
          httpServer: { url: "https://api.example.com/mcp" },
        },
      });

      customServers.startCustomServers();

      expect(processCount).toBe(1); // Only stdio server creates process
      expect(customServers.httpServers.httpServer).toBeDefined();
      expect(customServers.customServersProcesses.stdioServer).toBeDefined();
    });

    it("should clean up deleted servers of both types", () => {
      // Setup stdio server
      customServers.setCustomServers({
        mcpServers: { stdioServer: { command: "npx" } },
      });
      customServers.startCustomServers();

      // Add HTTP server
      customServers.httpServers.httpServer = {
        url: "https://example.com/mcp",
        abortController: new AbortController(),
      };

      // Now update config to remove both
      customServers.setCustomServers({ mcpServers: {} });
      customServers.startCustomServers();

      expect(customServers.customServersProcesses.stdioServer).toBeUndefined();
      expect(customServers.httpServers.httpServer).toBeUndefined();
    });
  });
});
