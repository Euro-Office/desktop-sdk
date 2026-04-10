import { create } from "zustand";
import { getPlatformInstance } from "../../npm_lib/platform/platform-holder";
import type { TCloud } from "../../npm_lib/types";

type CloudsState = {
  clouds: TCloud[];
  getClouds: () => TCloud[];
  setClouds: (clouds: TCloud[]) => void;
  fetchClouds: () => void;
};

const useCloudsStore = create<CloudsState>()((set, get) => ({
  clouds: [],
  getClouds: () => get().clouds,
  setClouds: (clouds) => set({ clouds }),
  fetchClouds: () => {
    const platform = getPlatformInstance();
    const clouds = platform?.clouds?.getClouds() ?? [];
    set({ clouds });
  },
}));

export default useCloudsStore;
