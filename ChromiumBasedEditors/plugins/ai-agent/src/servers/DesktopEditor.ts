import type { TMCPItem } from "@/lib/types";
import { getPlatformInstance } from "../../npm_lib/platform/platform-holder";

export class DesktopEditorTool {
  private tools: TMCPItem[];

  constructor() {
    this.tools = [];
  }

  setTools = (tools: TMCPItem[]) => {
    this.tools = tools;
  };

  getTools = () => {
    // Re-fetch tools from platform every time, since platform may not be
    // available at construction time (singleton created at module import)
    const platform = getPlatformInstance();
    if (platform?.hostTools) {
      try {
        const tools = platform.hostTools.getTools();
        this.setTools(tools);
      } catch (error) {
        console.error("Error parsing tools:", error);
      }
    }

    return [...this.tools];
  };

  callTools = async (name: string, args: Record<string, unknown>) => {
    const platform = getPlatformInstance();
    if (!platform?.hostTools) return "{}";

    return platform.hostTools.callTool(name, args);
  };
}
