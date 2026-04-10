import type { TMCPItem } from "../../types";
import type { HostToolGroup } from "../types";

/**
 * Replaces DesktopEditorTool.
 * Wraps HostToolGroup[] (from ToolsProvider) into the same interface
 * that Servers class expects: getTools() returns TMCPItem[] per group,
 * callTools() routes to the correct handler.
 */
export class HostToolSource {
  private groups: HostToolGroup[] = [];

  setGroups(groups: HostToolGroup[]) {
    this.groups = groups;
  }

  /** Get all tools from all groups, keyed by group.id */
  getToolsByGroup(): Record<string, TMCPItem[]> {
    const result: Record<string, TMCPItem[]> = {};

    for (const group of this.groups) {
      result[group.id] = group.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    }

    return result;
  }

  /** Get flat list of all tools (for backward compat with old getTools()) */
  getAllTools(): TMCPItem[] {
    return this.groups.flatMap((group) =>
      group.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }))
    );
  }

  /** Call a tool by name. Searches across all groups */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    for (const group of this.groups) {
      const tool = group.tools.find((t) => t.name === name);
      if (tool) {
        return tool.handler(args);
      }
    }

    return "{}";
  }

  /** Check if a tool in a given group should auto-allow (no approval dialog) */
  isAutoAllow(groupId: string, toolName: string): boolean {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const tool = group.tools.find((t) => t.name === toolName);
    if (!tool) return false;
    return !tool.requireApproval;
  }

  /** Get all group IDs */
  getGroupIds(): string[] {
    return this.groups.map((g) => g.id);
  }
}
