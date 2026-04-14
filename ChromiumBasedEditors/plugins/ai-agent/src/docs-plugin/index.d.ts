export {};

declare global {
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
    };
  }
}
