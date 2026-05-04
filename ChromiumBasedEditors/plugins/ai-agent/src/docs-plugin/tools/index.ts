import type {
  HostTool,
  HostToolGroup,
  TMCPItem,
  ToolsAdapter,
} from "@onlyoffice/ai-chat";
import { cellTools } from "./cell";
import { slideTools } from "./slide";
import { wordTools } from "./word";

export type EditorType = "word" | "cell" | "slide" | "pdf";

export function createHostToolGroups(editorType: EditorType): HostToolGroup[] {
  switch (editorType) {
    case "word":
      return [{ id: "word", name: "Word Tools", tools: wordTools }];
    case "slide":
      return [{ id: "slide", name: "Slide Tools", tools: slideTools }];
    case "cell":
      return [{ id: "cell", name: "Cell Tools", tools: cellTools }];
    default:
      return [];
  }
}

export function createToolsAdapter(editorType: EditorType): ToolsAdapter {
  const groups = createHostToolGroups(editorType);
  const handlers = new Map<string, HostTool["handler"]>();
  const grouped: Record<string, TMCPItem[]> = {};

  for (const group of groups) {
    grouped[group.id] = group.tools.map((tool) => {
      const qualified = `${group.id}_${tool.name}`;
      handlers.set(qualified, tool.handler);
      return {
        name: qualified,
        description: tool.description,
        inputSchema: tool.inputSchema,
      };
    });
  }

  return {
    async getTools() {
      return grouped;
    },
    async callTool(name, args) {
      const handler = handlers.get(name);
      if (!handler) {
        return JSON.stringify({ error: `Unknown host tool: ${name}` });
      }
      try {
        const result = await handler(args);
        return typeof result === "string" ? result : JSON.stringify(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: message });
      }
    },
    async denyTool() {
      // Adapter tools execute in-engine without a UI approval round-trip,
      // so deny is never invoked by the engine.
    },
  };
}
