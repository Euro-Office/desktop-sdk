// Adapter that exposes the legacy plugin's `window.EditorHelper` tools
// to our AIChatWidget. `EditorHelper` is an instance of
// `EditorHelperImpl` (defined in <old>/scripts/helpers/helperFuncs.js,
// populated by <old>/scripts/helpers/helpers.js). Both files are loaded
// as classic scripts before our chat.js module — so by mount time the
// helper exists on `window`.
//
// `getTools()` is re-evaluated each call so dynamic tool registration
// (editor-side `ai_onCustomToolRegister`) takes effect without remount.

import type { TMCPItem, ToolsAdapter } from "@onlyoffice/ai-chat";

interface RegisteredFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface EditorHelperLike {
  getTools(): RegisteredFunction[] | null;
  names2funcs: Record<
    string,
    { call: (args: Record<string, unknown>) => unknown }
  >;
}

function getHelper(): EditorHelperLike | null {
  return (
    (window as unknown as { EditorHelper?: EditorHelperLike }).EditorHelper ??
    null
  );
}

export function createLegacyToolsAdapter(): ToolsAdapter {
  return {
    async getTools() {
      const helper = getHelper();
      const empty: Record<string, TMCPItem[]> = {};
      if (!helper) return empty;
      const raw = helper.getTools();
      if (!raw) return empty;
      const tools: TMCPItem[] = raw.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
      }));
      return { editor: tools };
    },
    async callTool(name, args) {
      const helper = getHelper();
      const fn = helper?.names2funcs?.[name];
      if (!fn) {
        return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
      // Mirror old register.js agent-loop output shape: tools that
      // perform side-effects typically return undefined, which would
      // serialize as JSON `undefined` (i.e. the value, not a string) and
      // leave the tool-call without a persisted result. Azure / OpenAI
      // then rejects the next round with "No tool output found for
      // function call X". Always wrap with a non-empty success string.
      const plugin = (
        window as unknown as {
          Asc?: { plugin?: { tr?: (s: string) => string } };
        }
      ).Asc?.plugin;
      const tr = (s: string): string => plugin?.tr?.(s) ?? s;
      try {
        const result = await fn.call(args);
        const success = tr("Function executed successfully");
        if (result === undefined || result === null) return success;
        return `${success}\n${
          typeof result === "string" ? result : JSON.stringify(result)
        }`;
      } catch (e) {
        const err = e as Error;
        return `${tr("Error:")}\n${err.message}`;
      }
    },
  };
}
