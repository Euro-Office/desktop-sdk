import type { TProcess } from "@/shared/lib/types.ts";
import type { AscDesktopEditor } from "../shared/lib/types";

declare global {
  class PerfectScrollbar {
    constructor(element: Element | string, options?: object);
    update(): void;
    destroy(): void;
  }

  // ONLYOFFICE editor globals available inside callCommand callbacks,
  // plus Asc.scope accessible from plugin code to pass data into callCommand.
  interface AscEditorDocument {
    // biome-ignore lint/suspicious/noExplicitAny: editor API surface is dynamic
    [key: string]: any;
  }
  interface AscEditorApi {
    GetDocument: () => AscEditorDocument;
    // biome-ignore lint/suspicious/noExplicitAny: editor API surface is dynamic
    CreateParagraph: () => any;
    // biome-ignore lint/suspicious/noExplicitAny: editor API surface is dynamic
    [key: string]: any;
  }
  interface AscGlobal {
    // biome-ignore lint/suspicious/noExplicitAny: Asc.scope is a free-form data channel
    scope: Record<string, any>;
    // biome-ignore lint/suspicious/noExplicitAny: other Asc members are dynamic
    [key: string]: any;
  }
  var Api: AscEditorApi;
  var Asc: AscGlobal;
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
    id: number;
    show: (variation: AscPluginWindowVariation) => void;
    activate: () => void;
    command: (name: string, data: string) => void;
    attachEvent: (id: string, action: (data: unknown) => void) => void;
  }

  interface AscTheme {
    name: string;
    type: string;
    [key: string]: string | undefined;
  }

  interface Window {
    Asc: {
      plugin: {
        init: () => void;
        button: (buttonId: number, windowId: number) => void;
        executeMethod: (
          method: string,
          params?: unknown[],
          callback?: (result: unknown) => void
        ) => void;
        callCommand: (
          func: () => void,
          isClose?: boolean,
          isReturnValue?: boolean,
          callback?: (result: unknown) => void
        ) => void;
        attachToolbarMenuClickEvent: (id: string, handler: () => void) => void;
        event_onToolbarMenuClick: (id: string) => void;
        info: {
          theme: AscTheme;
          lang: string;
          editorType?: "word" | "slide" | "cell" | "pdf";
          editorSubType?: string;
        };
        sendToPlugin: (name: string, data: object) => boolean;
        attachEvent: (id: string, action: (data: unknown) => void) => void;
        detachEvent: (id: string) => void;
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
      Editor?: AscEditorStatic;
      Library?: AscLibraryInstance;
      Prompts?: AscPromptsStatic;
      PluginsMD?: AscPluginsMDStatic;
    };

    // desktop only
    AscDesktopEditor?: AscDesktopEditor;
    onUpdateClouds?: () => void;
    ExternalProcess?: new (
      command: string,
      env?: Record<string, string>
    ) => TProcess;

    aiAgent?: {
      summarize: (text: string, targetLang?: string) => Promise<string>;
      translate: (text: string, targetLang: string) => Promise<string>;
    };
  }
}
