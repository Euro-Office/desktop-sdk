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

  interface Window {
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
      };
      ButtonToolbar: new (parent?: AscButtonToolbar) => AscButtonToolbar;
      Buttons: {
        registerToolbarMenu: () => void;
        registerContextMenu: () => void;
      };
    };
  }
}
