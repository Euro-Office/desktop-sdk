import type { PlatformClouds } from "../../../npm_lib/platform/types";
import type { TCloud } from "../../../npm_lib/types";

const devClouds: TCloud[] =
  import.meta.env.VITE_DEV_CLOUD_URL && import.meta.env.VITE_DEV_CLOUD_API_KEY
    ? [
        {
          url: import.meta.env.VITE_DEV_CLOUD_URL as string,
          data: { apiKey: import.meta.env.VITE_DEV_CLOUD_API_KEY as string },
        },
      ]
    : [];

export class OnlyOfficeClouds implements PlatformClouds {
  getClouds(): TCloud[] {
    return (
      (typeof window.AscDesktopEditor?.getClouds === "function"
        ? window.AscDesktopEditor.getClouds()
        : null) ?? devClouds
    );
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
