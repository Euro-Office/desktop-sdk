import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";
import type { TCloudProvider } from "../types";

export interface CloudsStoreState {
  cloudProviders: TCloudProvider[];
  fetchClouds: () => Promise<void>;
}

export function createCloudsStore(
  ctx: AppContext
): UseBoundStore<StoreApi<CloudsStoreState>> {
  return create<CloudsStoreState>()((set) => ({
    cloudProviders: [],
    fetchClouds: async () => {
      if (!ctx.platform.clouds) {
        set({ cloudProviders: [] });
        return;
      }

      const clouds = await ctx.platform.clouds.getClouds();
      const cloudKeys = ctx.platform.clouds.getCloudKeys();

      const cloudProviders = clouds.reduce<TCloudProvider[]>((acc, cloud) => {
        const key = cloudKeys.find((k) => k.url === cloud.portal);
        const apiKey = key?.keys[0]?.value;

        if (apiKey) {
          acc.push({
            url: cloud.portal,
            label: new URL(cloud.portal).hostname,
            apiKey,
          });
        }

        return acc;
      }, []);

      set({ cloudProviders });
    },
  }));
}
