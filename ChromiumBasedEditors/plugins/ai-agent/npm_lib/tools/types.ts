import type { TMCPItem } from "../types";

/** A single tool that the host exposes to the AI model */
export interface HostTool {
  /** Unique tool name (e.g. "insert_text", "get_selection"). Will be prefixed with "{group.id}_" internally */
  name: string;

  /** Human-readable description shown to the AI model and in the tools list UI */
  description: string;

  /** JSON Schema describing the tool's input parameters */
  inputSchema: Record<string, unknown>;

  /** The function that executes the tool. Called with parsed arguments, returns a result for the AI model */
  handler: (args: Record<string, unknown>) => Promise<unknown>;

  /** Whether to show an approval dialog before executing. Default: false (auto-allow) */
  requireApproval?: boolean;
}

/** A named group of host tools, displayed as a section in the tools list UI */
export interface HostToolGroup {
  /** Group ID used as source prefix in qualified names (e.g. "desktop_editor" → "desktop_editor_insert_text") */
  id: string;

  /** Display name shown in the tools list UI (e.g. "Desktop Editor", "CRM Tools") */
  name: string;

  /** Tools in this group */
  tools: HostTool[];
}

/** Interface for any tool source that can provide and execute tools */
export interface ToolSource {
  /** Unique source ID: host group id | "web-search" | "mcp-{serverName}" */
  id: string;

  /** Fetch available tools from this source */
  getTools(): Promise<TMCPItem[]> | TMCPItem[];

  /** Execute a tool from this source by name */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;

  /** Whether tools from this source are auto-allowed (no approval dialog). Default: false */
  autoAllow?: boolean;
}
