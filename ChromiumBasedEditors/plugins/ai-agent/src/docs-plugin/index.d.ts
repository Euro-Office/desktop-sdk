export {};

declare global {
  interface AscButtonToolbar {
    text: string;
    icons: string;
    separator: boolean;
    split: boolean;
    menu: Array<{ text: string; id: string; onclick: () => void }>;
    enableToggle: boolean;
    attachOnClick: (handler: () => void) => void;
  }

  interface AscPluginWindowVariation {
    url: string;
    description?: string;
    type: "window" | "panel" | "panelRight";
    EditorsSupport?: Array<"word" | "slide" | "cell" | "pdf">;
    isModal?: boolean;
    isVisual?: boolean;
    size?: [number, number];
    buttons?: Array<{
      text: string;
      primary?: boolean;
      isviewer?: boolean;
      textLocale?: Record<string, string>;
    }>;
    isActivated?: boolean;
    icons?: string;
  }

  interface AscPluginWindow {
    show: (variation: AscPluginWindowVariation) => void;
    activate: () => void;
  }

  interface AscTheme {
    name: string;
    type: string;
  }

  interface AscDesktopEditor {
    OpenFilenameDialog: (
      initialPath: string,
      multiSelect: boolean,
      callback: (path: string | string[] | null) => void
    ) => void;
    convertFileExternal: (
      path: string,
      format: number,
      callback: (data: { content: ArrayBuffer }) => void
    ) => void;
    getOfficeFileType: (path: string) => number;
    callToolFunction: (name: string, args?: string) => Promise<string>;
    SaveFilenameDialog: (
      fileName: string,
      callback: (path: string | null) => void
    ) => void;
    saveAndOpen: (
      content: string,
      inputFormat: number,
      path: string,
      outputFormat: number,
      callback: (code: number) => void
    ) => void;
    openTemplate: (path: string, name: string) => void;
  }

  interface Window {
    AscDesktopEditor?: AscDesktopEditor;
    Asc: {
      plugin: {
        init: () => void;
        button: (id: number) => void;
        executeMethod: (
          method: string,
          params?: unknown[],
          callback?: () => void
        ) => void;
        callCommand: (func: () => void, isClose?: boolean) => void;
        attachToolbarMenuClickEvent: (id: string, handler: () => void) => void;
        event_onToolbarMenuClick: (id: string) => void;
        info: {
          theme: AscTheme;
          lang: string;
        };
        onThemeChangedBase?: (theme: AscTheme) => void;
        onThemeChanged?: (theme: AscTheme) => void;
        onTranslate?: () => void;
      };
      ButtonToolbar: new (parent?: AscButtonToolbar) => AscButtonToolbar;
      PluginWindow: new () => AscPluginWindow;
      Buttons: {
        registerToolbarMenu: () => void;
        registerContextMenu: () => void;
      };
    };
  }
}
