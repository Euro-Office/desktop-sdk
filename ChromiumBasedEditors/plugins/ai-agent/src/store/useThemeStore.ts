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
  setThemeId: (id: string) => void;
  setScale: (scale: number) => void;
};

const getThemeType = (themeId: string): ThemeType =>
  DARK_THEMES.some((dark) => themeId.includes(dark.replace("theme-", "")))
    ? "dark"
    : "light";

const getInitialThemeId = (): string => {
  const platform = getPlatformInstance();
  return platform?.env.theme ?? "theme-light";
};

const getInitialScale = (): number => {
  const platform = getPlatformInstance();
  return platform?.env.devicePixelRatio ?? 1;
};

const useThemeStore = create<ThemeStore>((set) => {
  const initialThemeId = getInitialThemeId();

  return {
    themeId: initialThemeId,
    themeType: getThemeType(initialThemeId),
    scale: getInitialScale(),

    setThemeId: (id: string) =>
      set({
        themeId: id,
        themeType: getThemeType(id),
      }),

    setScale: (scale: number) => set({ scale }),
  };
});

export default useThemeStore;
