import type { PlatformAdapter } from "../../../npm_lib/platform/types";

export class NoopPlatform implements PlatformAdapter {
  file = null;
  process = null;
  env = {
    theme: "theme-light" as string,
    systemTheme: "light" as const,
    locale: "en",
    devicePixelRatio: 1,
  };
  hostTools = null;
}
