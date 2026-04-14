import type { PlatformEnvironment } from "@onlyoffice/ai-chat";

export class OnlyOfficeEnvironment implements PlatformEnvironment {
  get theme(): string {
    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    const rpv = (window as any).RendererProcessVariable;
    if (!rpv) return "theme-light";

    if (rpv.theme.id === "theme-system") {
      return rpv.theme.system === "dark" ? "theme-night" : "theme-white";
    }

    return rpv.theme.id;
  }

  get systemTheme(): "dark" | "light" {
    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    const rpv = (window as any).RendererProcessVariable;
    return rpv?.theme?.system === "dark" ? "dark" : "light";
  }

  get locale(): string {
    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    const rpv = (window as any).RendererProcessVariable;
    return rpv?.lang ?? "en";
  }

  get devicePixelRatio(): number {
    return window.devicePixelRatio || 1;
  }

  onEnvironmentChange(
    callback: (info: { theme?: string; lang?: string }) => void
  ): () => void {
    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    (window as any).on_update_plugin_info = (info: {
      theme?: string;
      lang?: string;
    }) => {
      callback(info);
    };

    return () => {
      // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
      (window as any).on_update_plugin_info = undefined;
    };
  }
}
