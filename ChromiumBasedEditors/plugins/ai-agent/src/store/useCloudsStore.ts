import { create } from "zustand";
import type { TCloud } from "@/index";

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
    const clouds = (typeof window.AscDesktopEditor?.getClouds === "function"
      ? window.AscDesktopEditor.getClouds()
      : null) ?? [
      {
        url: "https://eu-test-oauth.onlyoffice.io/",
        data: {
          apiKey:
            "sk-7ffa240fde96aeb47f410593844564e8f7e44fce8b6a711d0cf4c0d295267080",
        },
      },
      {
        url: "https://eu-test-oauth.onlyoffice.io/",
        data: {
          apiKey:
            "sk-60f430b923423d1be300d0f15725d187cd5a9090880434920435937adb64bf37",
        },
      },
      {
        url: "https://eu-test-oauth.onlyoffice.io/",
        data: {
          apiKey:
            "sk-4b3aacff1cf353c9320a99fa730116ba026d610449b49f3b06f5b85da97f50be",
        },
      },
      {
        url: "https://eu-test-oauth.onlyoffice.io/",
        data: {
          apiKey:
            "sk-030e095b13fbbaf8446c6f997e7edd291f9d46d54a9371e8e77bfb212bb7c83f",
        },
      },
    ];
    set({ clouds });
  },
}));

export default useCloudsStore;
