import type { PlatformClouds, TCloud, TCloudKey } from "@onlyoffice/ai-chat";

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
    window.onUpdateClouds = callback;

    return () => {
      window.onUpdateClouds = undefined;
    };
  }
}
