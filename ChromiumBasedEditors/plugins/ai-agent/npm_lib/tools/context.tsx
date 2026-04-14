import { createContext, useContext, useEffect } from "react";
import type { ChatEventBus } from "../events";
import type Servers from "./servers";
import type { HostToolGroup } from "./types";

interface ToolsContextValue {
  /** Host tool groups passed from the host application */
  hostToolGroups: HostToolGroup[];
  /** Servers instance managing all tool sources */
  servers: Servers;
  /** Instance-scoped event bus for tool-change events */
  eventBus: ChatEventBus;
}

const ToolsContext = createContext<ToolsContextValue | null>(null);

/** Access the Servers instance and host tool groups from any component */
export function useToolsContext(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx)
    throw new Error("useToolsContext() must be used inside <ToolsProvider>");
  return ctx;
}

interface ToolsProviderProps {
  /** Host tool groups. If empty array — no host tools available */
  hostToolGroups: HostToolGroup[];
  /** Pre-created Servers instance from AppContext */
  servers: Servers;
  /** Instance-scoped event bus */
  eventBus: ChatEventBus;
  children: React.ReactNode;
}

/**
 * Provides the Servers instance to the component tree.
 * Syncs host tool groups into the Servers.hostToolSource.
 */
export function ToolsProvider({
  hostToolGroups,
  servers,
  eventBus,
  children,
}: ToolsProviderProps) {
  // Sync host tool groups into servers
  useEffect(() => {
    servers.hostToolSource.setGroups(hostToolGroups);
  }, [servers, hostToolGroups]);

  return (
    <ToolsContext.Provider value={{ hostToolGroups, servers, eventBus }}>
      {children}
    </ToolsContext.Provider>
  );
}
