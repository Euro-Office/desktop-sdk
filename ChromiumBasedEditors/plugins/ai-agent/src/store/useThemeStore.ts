import { create } from "zustand";
import { getPlatformInstance } from "../../npm_lib/platform/platform-holder";

const DARK_THEMES = [
  "theme-dark",
  "theme-night",
  "theme-contrast-dark",
] as const;

type ThemeType = "light" | "dark";

type ThemeStore = {
  themeId: string;
  themeType: ThemeType;
  scale: number;
  initialized: boolean;
  setThemeId: (id: string) => void;
  setScale: (scale: number) => void;
  initFromPlatform: () => void;
};

const getThemeType = (themeId: string): ThemeType =>
  DARK_THEMES.some((dark) => themeId.includes(dark.replace("theme-", "")))
    ? "dark"
    : "light";

const useThemeStore = create<ThemeStore>((set, get) => ({
  themeId: "theme-light",
  themeType: "light",
  scale: 1,
  initialized: false,

  setThemeId: (id: string) =>
    set({
      themeId: id,
      themeType: getThemeType(id),
    }),

  setScale: (scale: number) => set({ scale }),

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

export default useThemeStore;
