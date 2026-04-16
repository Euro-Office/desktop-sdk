import type { PlatformEnvironment } from "@onlyoffice/ai-chat";

export class OnlyOfficeEnvironment implements PlatformEnvironment {
  get theme(): string {
    const theme = window.Asc.plugin.info.theme;
    if (!theme) return "theme-light";

    if (theme.name === "theme-system") {
      return theme.type === "dark" ? "theme-night" : "theme-white";
    }

    return theme.name;
  }

  get systemTheme(): "dark" | "light" {
    const theme = window.Asc.plugin.info.theme;
    return theme.type === "dark" ? "dark" : "light";
  }

  get locale(): string {
    const lang = window.Asc.plugin.info.lang;
    return lang ?? "en";
  }

  get devicePixelRatio(): number {
    return window.devicePixelRatio || 1;
  }

  onEnvironmentChange(
    callback: (info: { theme?: string; lang?: string }) => void
  ): () => void {
    window.Asc.plugin.onThemeChanged = (theme) => {
      window.Asc.plugin.onThemeChangedBase?.(theme);

      let themeName: string;
      if (theme.name === "theme-system") {
        themeName = theme.type === "dark" ? "theme-night" : "theme-white";
      } else {
        themeName = theme.name;
      }

      callback({ theme: themeName });
    };

    window.Asc.plugin.onTranslate = () => {
      callback({ lang: window.Asc.plugin.info.lang });
    };

    return () => {
      window.Asc.plugin.onThemeChanged = undefined;
      window.Asc.plugin.onTranslate = undefined;
    };
  }
}
