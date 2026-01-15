import type { TMCPItem, TProcess } from "@/lib/types";

type THttpServer = {
  url: string;
  headers?: Record<string, string>;
  abortController?: AbortController;
};

const getParams = (config: Record<string, unknown>) => {
  let command = "";
  const env: Record<string, string> = {};
  let args = "";

  Object.entries(config).forEach(([key, value]) => {
    if (key === "env") {
      Object.entries(value as Record<string, string>).forEach(([k, v]) => {
        env[k] = v;
      });
    }

    if (key === "command") {
      command = value as string;
    }

    if (key === "args") {
      args = (value as string[]).join(" ");
    }
  });

  const commandLine = `${command} ${args}`;

  return { commandLine, env };
};

const isHttpServer = (config: Record<string, unknown>): boolean => {
  return typeof config.url === "string";
};

/**
 * Parse SSE-formatted response text to extract JSON-RPC messages.
 * SSE format: "event: message\ndata: {...json...}\n\n"
 */
const parseSSEResponse = (text: string): unknown[] => {
  const results: unknown[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const jsonStr = line.slice(6); // Remove "data: " prefix
      try {
        const parsed = JSON.parse(jsonStr);
        results.push(parsed);
      } catch {
        // Skip non-JSON data lines
      }
    }
  }

  // If no SSE format found, try parsing the whole text as JSON
  if (results.length === 0 && text.trim()) {
    try {
      results.push(JSON.parse(text));
    } catch {
      // Not valid JSON either
    }
  }

  return results;
};

const getHttpParams = (
  config: Record<string, unknown>
): { url: string; headers: Record<string, string> } => {
  const url = config.url as string;
  const headers = (config.headers as Record<string, string>) || {};
  return { url, headers };
};

class CustomServers {
  customServers: Record<string, Record<string, unknown>>;
  startedCustomServers: Record<string, string>;
  initedCustomServers: Record<string, boolean>;
  stoppedCustomServers: string[];
  customServersProcesses: Record<string, TProcess>;
  httpServers: Record<string, THttpServer>;
  customServersLogs: Record<string, string[]>;
  tools: Record<string, TMCPItem[]>;

  constructor() {
    this.customServers = {};
    this.startedCustomServers = {};
    this.initedCustomServers = {};
    this.customServersProcesses = {};
    this.httpServers = {};
    this.customServersLogs = {};
    this.tools = {};
    this.stoppedCustomServers = [];
  }

  onProcess = (type: string, t: number, message: string) => {
    try {
      const correctJson = JSON.parse(message);

      if (
        correctJson.jsonrpc === "2.0" &&
        correctJson.id &&
        correctJson.id.includes(`init-${type}`)
      ) {
        this.initedCustomServers[type] = true;
        this.stoppedCustomServers = this.stoppedCustomServers.filter(
          (s) => s !== type
        );
      }

      if (
        correctJson.jsonrpc === "2.0" &&
        correctJson.id &&
        correctJson.id.includes(`tools-${type}`)
      ) {
        this.tools[type] = correctJson.result.tools;
        window.dispatchEvent(new CustomEvent("tools-changed"));
      }
    } catch {
      // ignore
    }

    switch (t) {
      case 0: {
        this.customServersLogs[type].push(
          `${new Date().toLocaleString()}: ${message}\n`
        );
        break;
      }
      case 1: {
        this.customServersLogs[type].push(
          `${new Date().toLocaleString()}: ${message}\n`
        );
        break;
      }
      case 2: {
        this.customServersLogs[type].push(
          `${new Date().toLocaleString()}: [stop] ${message}\n`
        );
        this.stoppedCustomServers.push(type);
        break;
      }
      default:
        break;
    }
  };

  setCustomServers = (servers: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => {
    this.customServers = servers.mcpServers;
  };

  getServerType = (name: string) => {
    let type: string = "";

    Object.keys(this.customServers).forEach((serverType) => {
      if (name.includes(`${serverType}_`)) {
        type = serverType;
      }
    });

    return type;
  };

  startCustomServers = () => {
    const servers: string[] = [];
    Object.entries(this.customServers).forEach(([type, config]) => {
      servers.push(type);

      if (isHttpServer(config)) {
        this.startHttpServer(type, config);
      } else {
        this.startStdioServer(type, config);
      }
    });

    // remove deleted servers
    Object.keys(this.customServersProcesses).forEach((type) => {
      if (!servers.includes(type)) {
        this.deleteCustomServer(type);
      }
    });

    // remove deleted HTTP servers
    Object.keys(this.httpServers).forEach((type) => {
      if (!servers.includes(type)) {
        this.deleteCustomServer(type);
      }
    });
  };

  startHttpServer = (type: string, config: Record<string, unknown>) => {
    const { url, headers } = getHttpParams(config);

    if (this.startedCustomServers[type] === url) {
      return;
    }

    // Stop existing HTTP server if running
    if (this.httpServers[type]?.abortController) {
      this.httpServers[type].abortController.abort();
    }

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: HTTP MCP ${url}\n`,
    ];

    this.httpServers[type] = {
      url,
      headers,
      abortController: new AbortController(),
    };

    this.startedCustomServers[type] = url;
    this.initHttpServer(type);
  };

  startStdioServer = (type: string, config: Record<string, unknown>) => {
    const { commandLine, env } = getParams(config);

    if (
      this.startedCustomServers[type] &&
      this.startedCustomServers[type] === commandLine
    ) {
      return;
    }

    if (this.customServersProcesses[type]) {
      this.customServersProcesses[type].end();
    }

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: ${commandLine}\n`,
    ];

    const process = new window.ExternalProcess(commandLine, env);

    process.onprocess = this.onProcess.bind(this, type);

    this.customServersProcesses[type] = process;

    process.start();

    this.startedCustomServers[type] = commandLine;
    this.initCustomServer(type);
  };

  restartCustomServer = (type: string) => {
    Object.entries(this.customServers).forEach(([serverType, config]) => {
      if (type !== serverType) return;

      if (isHttpServer(config)) {
        this.restartHttpServer(type, config);
      } else {
        this.restartStdioServer(type, config);
      }
    });
  };

  restartHttpServer = (type: string, config: Record<string, unknown>) => {
    // Stop existing connection
    if (this.httpServers[type]?.abortController) {
      this.httpServers[type].abortController.abort();
    }

    const { url, headers } = getHttpParams(config);

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: HTTP MCP ${url}\n`,
    ];

    this.tools[type] = [];
    this.initedCustomServers[type] = false;

    this.httpServers[type] = {
      url,
      headers,
      abortController: new AbortController(),
    };

    this.initHttpServer(type);
    window.dispatchEvent(new CustomEvent("tools-changed"));
  };

  restartStdioServer = (type: string, config: Record<string, unknown>) => {
    this.customServersProcesses[type].end();

    const { commandLine, env } = getParams(config);

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: ${commandLine}\n`,
    ];

    this.tools[type] = [];

    const process = new window.ExternalProcess(commandLine, env);

    process.onprocess = this.onProcess.bind(this, type);

    this.customServersProcesses[type] = process;

    process.start();

    this.initCustomServer(type);
    window.dispatchEvent(new CustomEvent("tools-changed"));
  };

  deleteCustomServer = (type: string) => {
    // Stop stdio process if exists
    if (this.customServersProcesses[type]) {
      this.customServersProcesses[type].end();
      delete this.customServersProcesses[type];
    }
    // Stop HTTP connection if exists
    if (this.httpServers[type]) {
      if (this.httpServers[type].abortController) {
        this.httpServers[type].abortController.abort();
      }
      delete this.httpServers[type];
    }
    if (this.customServersLogs[type]) {
      delete this.customServersLogs[type];
    }
    if (this.startedCustomServers[type]) {
      delete this.startedCustomServers[type];
    }
    if (this.customServers[type]) {
      delete this.customServers[type];
    }
    if (this.tools[type]) {
      delete this.tools[type];
    }
    window.dispatchEvent(new CustomEvent("tools-changed"));
  };

  initHttpServer = async (type: string) => {
    const server = this.httpServers[type];
    if (!server) return;

    try {
      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: `init-${type}`,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: "ai-agent",
            version: "1.0.0",
          },
        },
      };

      const response = await fetch(`onlyoffice-proxy://${server.url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...server.headers,
        },
        body: JSON.stringify(initRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(type, 0, JSON.stringify(result));

        const msg = result as { jsonrpc?: string; id?: string };
        if (msg.jsonrpc === "2.0" && msg.id?.includes(`init-${type}`)) {
          this.initedCustomServers[type] = true;
          this.stoppedCustomServers = this.stoppedCustomServers.filter(
            (s) => s !== type
          );
          await this.getToolsFromHttpMCP(type);
          return;
        }
      }
    } catch (error) {
      console.error(`Error initializing HTTP MCP server ${type}:`, error);
      this.onProcess(type, 2, `Connection failed: ${error}`);
    }
  };

  initCustomServer = (type: string) => {
    const process = this.customServersProcesses[type];

    if (!process) {
      return;
    }

    const interval = setInterval(() => {
      if (this.initedCustomServers[type]) {
        clearInterval(interval);
        this.getToolsFromMCP(type);
        return;
      }

      try {
        // First send initialize request
        const initRequest = {
          jsonrpc: "2.0",
          id: `init-${type}`,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            clientInfo: {
              name: "ai-agent",
              version: "1.0.0",
            },
          },
        };

        const initBody = JSON.stringify(initRequest);
        const initMessage = `${initBody}\n`;

        // Send initialize request
        process.stdin(initMessage);
      } catch (error) {
        console.error(`Error initializing custom server ${type}:`, error);
      }
    }, 1000);
  };

  getToolsFromHttpMCP = async (type: string) => {
    const server = this.httpServers[type];
    if (!server) return;

    try {
      const request = {
        jsonrpc: "2.0",
        id: `tools-${type}-${Date.now()}`,
        method: "tools/list",
        params: {},
      };

      const response = await fetch(`onlyoffice-proxy://${server.url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...server.headers,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(type, 0, JSON.stringify(result));
      }
    } catch (error) {
      console.error(`Error getting tools from HTTP MCP server ${type}:`, error);
    }
  };

  getToolsFromMCP = async (type: string) => {
    // Get all running custom server processes

    const process = this.customServersProcesses[type];

    try {
      // Create JSON-RPC request for tools/list
      const request = {
        jsonrpc: "2.0",
        id: `tools-${type}-${Date.now()}`,
        method: "tools/list",
        params: {},
      };

      const requestBody = JSON.stringify(request);
      const requestMessage = `${requestBody}\n`;

      process.stdin(requestMessage);
    } catch (error) {
      console.error(`Error getting tools from MCP server ${type}:`, error);
    }
  };

  callToolFromMCP = async (
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    // Check if it's an HTTP server
    if (this.httpServers[serverType]) {
      return this.callToolFromHttpMCP(serverType, toolName, args);
    }

    // Otherwise use stdio
    return this.callToolFromStdioMCP(serverType, toolName, args);
  };

  callToolFromHttpMCP = async (
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const server = this.httpServers[serverType];

    if (!server) {
      throw new Error(`HTTP MCP server ${serverType} is not running`);
    }

    // Check if tool exists
    const serverTools = this.tools[serverType] || [];
    const tool = serverTools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverType}`);
    }

    try {
      const request = {
        jsonrpc: "2.0",
        id: `call-${serverType}-${toolName}-${Date.now()}`,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const response = await fetch(`onlyoffice-proxy://${server.url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...server.headers,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(serverType, 0, JSON.stringify(result));

        const msg = result as {
          error?: { code: number; message: string };
          result?: unknown;
        };

        if (msg.error) {
          throw new Error(
            `MCP tool error (${msg.error.code}): ${msg.error.message}`
          );
        }

        if (msg.result !== undefined) {
          return JSON.stringify(msg.result);
        }
      }

      throw new Error("No result in response");
    } catch (error) {
      throw new Error(
        `Error calling HTTP MCP tool ${toolName} on server ${serverType}: ${error}`
      );
    }
  };

  callToolFromStdioMCP = async (
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const process = this.customServersProcesses[serverType];

    if (!process) {
      throw new Error(`MCP server ${serverType} is not running`);
    }

    // Check if tool exists and get its schema
    const serverTools = this.tools[serverType] || [];
    const tool = serverTools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverType}`);
    }

    try {
      const request = {
        jsonrpc: "2.0",
        id: `call-${serverType}-${toolName}-${Date.now()}`,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const requestBody = JSON.stringify(request);
      const requestMessage = `${requestBody}\n`;

      // Send the tool call request
      process.stdin(requestMessage);

      // Return a promise that resolves when we get the response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(`Timeout waiting for tool response from ${serverType}`)
          );
        }, 30000); // 30 second timeout for tool execution

        // Store original onprocess handler
        const originalOnProcess = process.onprocess;

        // Temporarily override to capture tool response
        process.onprocess = (t: number, message: string) => {
          // Call original handler to maintain logging
          originalOnProcess(t, message);

          if (t === 0) {
            // stdout
            try {
              const response = JSON.parse(message);

              // Check if this is our tool call response
              if (response.id?.startsWith(`call-${serverType}-${toolName}`)) {
                // Restore original handler
                process.onprocess = originalOnProcess;
                clearTimeout(timeout);

                if (response.error) {
                  console.error(`MCP tool error response:`, response.error);
                  reject(
                    new Error(
                      `MCP tool error (${response.error.code}): ${response.error.message}`
                    )
                  );
                } else {
                  console.log(`MCP tool success response:`, response.result);
                  resolve(JSON.stringify(response.result));
                }
              }
            } catch {
              // Ignore parse errors, continue waiting
            }
          }
        };
      });
    } catch (error) {
      throw new Error(
        `Error calling MCP tool ${toolName} on server ${serverType}: ${error}`
      );
    }
  };

  getTools = () => {
    return this.tools;
  };
}

export { CustomServers };
