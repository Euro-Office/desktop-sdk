import { createContext, useContext, useEffect, useMemo } from "react";
import type { HostToolGroup } from "./types";
import Servers from "./servers";
import { setServersInstance } from "./tools-holder";

interface ToolsContextValue {
  /** Host tool groups passed from the host application */
  hostToolGroups: HostToolGroup[];
  /** Servers instance managing all tool sources */
  servers: Servers;
}

const ToolsContext = createContext<ToolsContextValue | null>(null);

/** Access the Servers instance and host tool groups from any component */
export function useToolsContext(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error("useToolsContext() must be used inside <ToolsProvider>");
  return ctx;
}

interface ToolsProviderProps {
  /** Host tool groups. If empty array — no host tools available */
  hostToolGroups: HostToolGroup[];
  children: React.ReactNode;
}

/**
 * Creates and provides the Servers instance.
 * Syncs host tool groups into the Servers.hostToolSource.
 * Sets the global tools-holder so Zustand stores can access Servers outside React.
 */
export function ToolsProvider({ hostToolGroups, children }: ToolsProviderProps) {
  const servers = useMemo(() => new Servers(), []);

  // Set holder synchronously so Zustand stores can access it immediately
  setServersInstance(servers);

  // Sync host tool groups into servers
  useEffect(() => {
    servers.hostToolSource.setGroups(hostToolGroups);
  }, [servers, hostToolGroups]);

  return (
    <ToolsContext.Provider value={{ hostToolGroups, servers }}>
      {children}
    </ToolsContext.Provider>
  );
}
