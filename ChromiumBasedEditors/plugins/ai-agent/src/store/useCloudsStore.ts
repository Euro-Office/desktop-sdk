import { create } from "zustand";
import type { TCloud } from "@/index";

type CloudsState = {
  clouds: TCloud[];
  getClouds: () => TCloud[];
  setClouds: (clouds: TCloud[]) => void;
  fetchClouds: () => void;
};

const devClouds: TCloud[] =
  import.meta.env.VITE_DEV_CLOUD_URL && import.meta.env.VITE_DEV_CLOUD_API_KEY
    ? [
        {
          url: import.meta.env.VITE_DEV_CLOUD_URL as string,
          data: { apiKey: import.meta.env.VITE_DEV_CLOUD_API_KEY as string },
        },
      ]
    : [];

const useCloudsStore = create<CloudsState>()((set, get) => ({
  clouds: [],
  getClouds: () => get().clouds,
  setClouds: (clouds) => set({ clouds }),
  fetchClouds: () => {
    const clouds =
      (typeof window.AscDesktopEditor?.getClouds === "function"
        ? window.AscDesktopEditor.getClouds()
        : null) ?? devClouds;
    set({ clouds });
  },
}));

export default useCloudsStore;
