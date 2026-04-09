import type { PlatformFileOperations } from "../../../npm_lib/platform/types";

declare const window: {
  AscDesktopEditor: {
    OpenFilenameDialog: (
      initialPath: string,
      multiSelect: boolean,
      callback: (path: string | null) => void
    ) => void;
    convertFileExternal: (
      path: string,
      format: number,
      callback: (content: string) => void
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
  async pickFile(): Promise<{ path: string; name: string } | null> {
    return new Promise((resolve) => {
      window.AscDesktopEditor.OpenFilenameDialog("", true, (path) => {
        if (!path) {
          resolve(null);
          return;
        }
        const name = path.split("/").pop() ?? path;
        resolve({ path, name });
      });
    });
  }

  async pickImage(): Promise<{ name: string; base64: string } | null> {
    // Images are handled through the same file picker in ONLYOFFICE
    return this.pickFile() as Promise<{ name: string; base64: string } | null>;
  }

  async convertFileToText(path: string, format: number): Promise<string> {
    return new Promise((resolve) => {
      window.AscDesktopEditor.convertFileExternal(path, format, (content) => {
        resolve(content);
      });
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
