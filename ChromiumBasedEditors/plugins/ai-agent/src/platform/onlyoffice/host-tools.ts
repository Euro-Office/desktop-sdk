import type { TMCPItem } from "@/lib/types";
import type { PlatformHostTools } from "../../../npm_lib/platform/types";

export class OnlyOfficeHostTools implements PlatformHostTools {
  getTools(): TMCPItem[] {
    try {
      const stringFunctions: string =
        // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
        (window as any).AscDesktopEditor?.getToolFunctions() ?? "";
      const parsed = JSON.parse(stringFunctions) as (TMCPItem & {
        parameters: Record<string, unknown>;
      })[];

      return parsed.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      }));
    } catch {
      return [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    const result = await (window as any).AscDesktopEditor?.callToolFunction(
      name,
      JSON.stringify(args)
    );
    return result ?? "{}";
  }
}
