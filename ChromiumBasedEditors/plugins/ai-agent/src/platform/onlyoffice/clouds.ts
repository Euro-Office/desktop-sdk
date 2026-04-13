import type { PlatformClouds } from "../../../npm_lib/platform/types";
import type { TCloud } from "../../../npm_lib/types";

export class OnlyOfficeClouds implements PlatformClouds {
  getClouds(): TCloud[] {
    return typeof window.AscDesktopEditor?.getCloudKeys === "function"
      ? window.AscDesktopEditor.getCloudKeys()
      : [];
  }

  onCloudsChange(callback: () => void): () => void {
    window.onUpdateClouds = callback;

    return () => {
      window.onUpdateClouds = undefined;
    };
  }
}
