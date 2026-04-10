import type { PlatformFileOperations } from "../../../npm_lib/platform/types";

declare const window: {
  AscDesktopEditor: {
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
  };
};

export class OnlyOfficeFileOps implements PlatformFileOperations {
  async pickFiles(): Promise<{ path: string; name: string }[] | null> {
    return new Promise((resolve) => {
      window.AscDesktopEditor.OpenFilenameDialog("", true, (result) => {
        if (!result) {
          resolve(null);
          return;
        }

        const paths = Array.isArray(result) ? result : [result];
        resolve(
          paths.map((p) => ({
            path: p,
            name: p.includes("\\")
              ? (p.split("\\").pop() ?? p)
              : (p.split("/").pop() ?? p),
          }))
        );
      });
    });
  }

  async pickImage(): Promise<{ name: string; base64: string } | null> {
    // Images in ONLYOFFICE are handled through HTML input, not this method
    return null;
  }

  async convertFileToText(path: string, format: number): Promise<string> {
    return new Promise((resolve) => {
      window.AscDesktopEditor.convertFileExternal(
        path,
        format,
        (data: { content: ArrayBuffer }) => {
          const uint8Array = new Uint8Array(data.content);
          const textDecoder = new TextDecoder("utf-8");
          resolve(textDecoder.decode(uint8Array));
        }
      );
    });
  }

  getFileType(path: string): number {
    return window.AscDesktopEditor.getOfficeFileType(path);
  }

  async getRecentFiles(): Promise<string> {
    return (
      window.AscDesktopEditor.callToolFunction("recent_files_reader") ?? "{}"
    );
  }

  async saveAsFile(content: string, defaultName: string): Promise<void> {
    return new Promise((resolve) => {
      window.AscDesktopEditor.SaveFilenameDialog(defaultName, (path) => {
        if (!path) {
          resolve();
          return;
        }
        window.AscDesktopEditor.saveAndOpen(content, 0x5c, path, 0x41, () => {
          resolve();
        });
      });
    });
  }

  openFile(path: string, name: string): void {
    window.AscDesktopEditor.openTemplate(path, name);
  }
}
