import type { PlatformClouds, TCloud, TCloudKey } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils.ts";

export class OnlyOfficeClouds implements PlatformClouds {
  async getClouds(): Promise<TCloud[]> {
    return typeof window.AscDesktopEditor?.getClouds === "function"
      ? window.AscDesktopEditor.getClouds()
      : [];
  }

  getCloudKeys(): TCloudKey[] {
    return typeof window.AscDesktopEditor?.getCloudKeys === "function"
      ? window.AscDesktopEditor.getCloudKeys()
      : [];
  }

  onCloudsChange(callback: () => void): () => void {
    if (!isDesktopEditor()) {
      return () => undefined;
    }

    window.onUpdateClouds = callback;

    return () => {
      window.onUpdateClouds = undefined;
    };
  }
}
