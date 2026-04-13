import type { PlatformClouds } from "../../../npm_lib/platform/types";
import type { TCloud } from "../../../npm_lib/types";

export class OnlyOfficeClouds implements PlatformClouds {
  getClouds(): TCloud[] {
    return typeof window.AscDesktopEditor?.getCloudKeys === "function"
      ? window.AscDesktopEditor.getCloudKeys()
      : [];
  }

  onCloudsChange(callback: () => void): () => void {
    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    (window as any).on_update_cloud = callback;

    return () => {
      // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
      (window as any).on_update_cloud = undefined;
    };
  }
}
