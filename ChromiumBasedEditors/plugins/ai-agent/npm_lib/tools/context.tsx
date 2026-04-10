import { createContext, useContext } from "react";
import type { HostToolGroup } from "./types";

interface ToolsContextValue {
  /** Host tool groups passed from the host application */
  hostToolGroups: HostToolGroup[];
}

const ToolsContext = createContext<ToolsContextValue | null>(null);

/** Access host tool groups from any component */
export function useHostTools(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error("useHostTools() must be used inside <ToolsProvider>");
  return ctx;
}

interface ToolsProviderProps {
  /** Host tool groups. If empty array — no host tools available */
  hostToolGroups: HostToolGroup[];
  children: React.ReactNode;
}

/**
 * Provides host tool groups to the application.
 * Host tools replace the old DesktopEditorTool — the host can pass any tools from outside.
 */
export function ToolsProvider({ hostToolGroups, children }: ToolsProviderProps) {
  return (
    <ToolsContext.Provider value={{ hostToolGroups }}>
      {children}
    </ToolsContext.Provider>
  );
}
