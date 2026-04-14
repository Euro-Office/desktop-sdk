import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";

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

export function createThemeStore(
  ctx: AppContext
): UseBoundStore<StoreApi<ThemeStoreState>> {
  return create<ThemeStoreState>((set, get) => ({
    themeId: "theme-light",
    themeType: "light",
    scale: 1,
    initialized: false,

    setThemeId: (id) => set({ themeId: id, themeType: getThemeType(id) }),

    setScale: (scale) => set({ scale }),

    initFromPlatform: () => {
      if (get().initialized) return;
      const themeId = ctx.platform.env.theme;
      set({
        themeId,
        themeType: getThemeType(themeId),
        scale: ctx.platform.env.devicePixelRatio,
        initialized: true,
      });
    },
  }));
}
