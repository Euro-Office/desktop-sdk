import type { TMCPItem } from "@/lib/types";
import { getPlatformInstance } from "../../npm_lib/platform/platform-holder";

export class DesktopEditorTool {
  private tools: TMCPItem[];

  constructor() {
    this.tools = [];
    this.initTools();
  }

  setTools = (tools: TMCPItem[]) => {
    this.tools = tools;
  };

  getTools = () => {
    return [...this.tools];
  };

  callTools = async (name: string, args: Record<string, unknown>) => {
    const platform = getPlatformInstance();
    if (!platform?.hostTools) return "{}";

    return platform.hostTools.callTool(name, args);
  };

  initTools = () => {
    const platform = getPlatformInstance();
    if (!platform?.hostTools) return;

    try {
      const tools = platform.hostTools.getTools();
      this.setTools(tools);
    } catch (error) {
      console.error("Error parsing tools:", error);
    }
  };
}
