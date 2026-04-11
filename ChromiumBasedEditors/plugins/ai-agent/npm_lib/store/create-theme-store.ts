import { create, type StoreApi, type UseBoundStore } from "zustand";
import { getPlatformInstance } from "../platform/platform-holder";

type ThemeType = "light" | "dark";

const DARK_THEMES = [
  "theme-dark",
  "theme-night",
  "theme-contrast-dark",
] as const;

const getThemeType = (themeId: string): ThemeType =>
  DARK_THEMES.some((dark) => themeId.includes(dark.replace("theme-", "")))
    ? "dark"
    : "light";

export interface ThemeStoreState {
  themeId: string;
  themeType: ThemeType;
  scale: number;
  initialized: boolean;
  setThemeId: (id: string) => void;
  setScale: (scale: number) => void;
  initFromPlatform: () => void;
}

export function createThemeStore(): UseBoundStore<StoreApi<ThemeStoreState>> {
  return create<ThemeStoreState>((set, get) => ({
    themeId: "theme-light",
    themeType: "light",
    scale: 1,
    initialized: false,

    setThemeId: (id) => set({ themeId: id, themeType: getThemeType(id) }),

    setScale: (scale) => set({ scale }),

    initFromPlatform: () => {
      if (get().initialized) return;
      const platform = getPlatformInstance();
      if (!platform) return;
      const themeId = platform.env.theme;
      set({
        themeId,
        themeType: getThemeType(themeId),
        scale: platform.env.devicePixelRatio,
        initialized: true,
      });
    },
  }));
}
