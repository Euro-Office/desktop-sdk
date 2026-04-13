import { create, type StoreApi, type UseBoundStore } from "zustand";
import { getPlatformInstance } from "../platform/platform-holder";
import type { TCloudProvider } from "../types";

export interface CloudsStoreState {
  cloudProviders: TCloudProvider[];
  fetchClouds: () => Promise<void>;
}

export function createCloudsStore(): UseBoundStore<StoreApi<CloudsStoreState>> {
  return create<CloudsStoreState>()((set) => ({
    cloudProviders: [],
    fetchClouds: async () => {
      const platform = getPlatformInstance();
      if (!platform?.clouds) {
        set({ cloudProviders: [] });
        return;
      }

      const clouds = await platform.clouds.getClouds();
      const cloudKeys = platform.clouds.getCloudKeys();

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
