import type Provider from "./index";

/**
 * Global Provider instance holder.
 * Zustand stores can't access React context, so they get Provider from here.
 */
let providerInstance: InstanceType<typeof Provider> | null = null;

export function setProviderInstance(p: InstanceType<typeof Provider>): void {
  providerInstance = p;
}

export function getProviderInstance(): InstanceType<typeof Provider> {
  if (!providerInstance) {
    throw new Error("Provider not initialized.");
  }
  return providerInstance;
}
