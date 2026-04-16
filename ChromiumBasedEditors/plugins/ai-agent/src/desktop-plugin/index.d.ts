import type { AscDesktopEditor, TProcess } from "../shared/lib/types.ts";

declare global {
  interface Window {
    AscDesktopEditor: AscDesktopEditor;
    RendererProcessVariable: {
      lang: string;
      rtl: boolean;
      theme: {
        system: string;
        type: string;
        id: string;
        addLocal: "on" | "off";
      };
    };
    on_update_plugin_info: (info: { theme: string; lang: string }) => void;
    onUpdateClouds?: () => void;
    ExternalProcess: new (
      command: string,
      env?: Record<string, string>
    ) => TProcess;
  }
}
