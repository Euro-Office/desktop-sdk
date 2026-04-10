import type Servers from "./servers";

/**
 * Global Servers instance holder.
 * Zustand stores can't access React context, so they get the Servers instance from here.
 * Set by ToolsProvider during render.
 */
let serversInstance: Servers | null = null;

export function setServersInstance(servers: Servers): void {
  serversInstance = servers;
}

export function getServersInstance(): Servers {
  if (!serversInstance) {
    throw new Error("Servers not initialized. Wrap your app in <ToolsProvider>.");
  }
  return serversInstance;
}
