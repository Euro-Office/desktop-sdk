import type { PlatformAdapter } from "./types";

/**
 * Global platform instance holder.
 * Zustand stores can't access React context, so they get platform from here.
 * Set by PlatformProvider during initialization.
 */
let platformInstance: PlatformAdapter | null = null;

export function setPlatformInstance(platform: PlatformAdapter): void {
  platformInstance = platform;
}

export function getPlatformInstance(): PlatformAdapter | null {
  return platformInstance;
}
