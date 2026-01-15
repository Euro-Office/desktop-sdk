import type { Page } from '@playwright/test';

/**
 * Mock window.AscDesktopEditor for testing
 */
export async function mockDesktopEditor(page: Page) {
  await page.addInitScript(() => {
    const tools = [
      { type: 'function', name: 'file_content_reader', description: 'Read file content', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { type: 'function', name: 'file_opener', description: 'Open a file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { type: 'function', name: 'folder_content_reader', description: 'List folder contents', parameters: { type: 'object', properties: { folder: { type: 'string' } }, required: ['folder'] } },
      { type: 'function', name: 'form_field_analyser', description: 'Analyze document fields', parameters: { type: 'object', properties: { document: { type: 'string' } }, required: ['document'] } },
      { type: 'function', name: 'form_field_filler', description: 'Fill document fields', parameters: { type: 'object', properties: { document: { type: 'string' }, fields: { type: 'object' } }, required: ['document', 'fields'] } },
      { type: 'function', name: 'generate_docx', description: 'Generate a document', parameters: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] } },
      { type: 'function', name: 'generate_form', description: 'Generate a form template', parameters: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] } },
      { type: 'function', name: 'generate_pptx', description: 'Generate a presentation', parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: [] } },
      { type: 'function', name: 'recent_files_reader', description: 'Get recent files', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
    ];

    // @ts-ignore - Mock desktop editor API
    window.AscDesktopEditor = {
      GetFileText: () => '',
      OpenFilenameDialog: () => '',
      execCommand: () => {},
      Call: () => {},
      getToolFunctions: () => JSON.stringify(tools),
      callToolFunction: (name: string) => {
        if (name === 'recent_files_reader') {
          return JSON.stringify({ files: [] });
        }
        return JSON.stringify({ success: true });
      },
    };
  });

  await page.addInitScript(() => {
    // @ts-ignore - Mock renderer process variables
    window.RendererProcessVariable = {
      lang: 'en',
      theme: { id: 'theme-white', type: 'light', system: 'light' },
    };

    // @ts-ignore
    window.on_update_plugin_info = () => {};

    // @ts-ignore - Mock ExternalProcess for MCP servers with JSON-RPC support
    window.ExternalProcess = class ExternalProcess {
      onprocess: ((t: number, message: string) => void) | null = null;
      private commandLine: string = '';
      private initialized: boolean = false;

      constructor(commandLine: string, _env: Record<string, string>) {
        this.commandLine = commandLine;
      }

      start() {
        // Server started - waiting for stdin commands
      }

      // Generate tools based on count extracted from command line
      private generateTools(count: number) {
        const tools = [];
        for (let i = 1; i <= count; i++) {
          tools.push({
            name: `tool_${i}`,
            description: `Mock tool number ${i}`,
            inputSchema: { type: 'object', properties: {} },
          });
        }
        return tools;
      }

      // Extract tool count from command line (e.g., "mock-server --tools=150" or "150-tools")
      private getToolCount(): number {
        const match = this.commandLine.match(/(\d+)-tools|--tools[=\s](\d+)/);
        if (match) {
          return parseInt(match[1] || match[2], 10);
        }
        return 1; // Default to 1 tool
      }

      // Handle incoming JSON-RPC messages via stdin
      stdin(data: string) {
        try {
          // Remove trailing newline if present
          const cleanData = data.trim();
          const request = JSON.parse(cleanData);

          if (request.method === 'initialize') {
            // Respond to initialize request immediately
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'mock-server', version: '1.0.0' },
              },
            });
            // Respond synchronously to avoid timing issues
            if (this.onprocess) {
              this.onprocess(0, response);
            }
            this.initialized = true;
          } else if (request.method === 'tools/list') {
            // Respond with configurable number of tools
            const toolCount = this.getToolCount();
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                tools: this.generateTools(toolCount),
              },
            });
            // Respond synchronously
            if (this.onprocess) {
              this.onprocess(0, response);
            }
          } else if (request.method === 'tools/call') {
            // Respond to tool call
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: { content: [{ type: 'text', text: 'Mock tool result' }] },
            });
            if (this.onprocess) {
              this.onprocess(0, response);
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      end() {
        // Emit stop signal when process is ended
        if (this.onprocess) {
          this.onprocess(2, 'Process ended');
        }
      }
    };
  });
}
