import { create } from "zustand";

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
  if (typeof window === "undefined" || !window.RendererProcessVariable) {
    return "theme-light";
  }

  const { theme } = window.RendererProcessVariable;

  if (theme.id === "theme-system") {
    return theme.system === "dark" ? "theme-night" : "theme-white";
  }

  return theme.id;
};

const getInitialScale = (): number => {
  if (typeof window === "undefined") return 1;
  // macOS handles scaling differently, always use 1x
  return window.devicePixelRatio || 1;
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
