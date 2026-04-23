export const editor = {
  callMethod<T = unknown>(name: string, args?: unknown[]): Promise<T> {
    return new Promise((resolve) => {
      window.Asc.plugin.executeMethod(name, args ?? [], (result) => {
        resolve(result as T);
      });
    });
  },

  callCommand<T = unknown>(func: () => T): Promise<T> {
    return new Promise((resolve) => {
      (
        window.Asc.plugin.callCommand as (
          func: () => unknown,
          isClose: boolean,
          isReturnValue: boolean,
          callback: (result: unknown) => void
        ) => void
      )(func, false, true, (result) => resolve(result as T));
    });
  },

  pause(msec: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, msec);
    });
  },

  getType(): "word" | "cell" | "slide" | "pdf" {
    const info = window.Asc.plugin.info;
    if (info.editorSubType === "pdf") return "pdf";
    return (info.editorType ?? "word") as "word" | "cell" | "slide" | "pdf";
  },
};
