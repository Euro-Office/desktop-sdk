import type { PlatformFileOperations } from "@onlyoffice/ai-chat";
import { isDesktopEditor } from "@/shared/lib/utils";

export class OnlyOfficeFileOps implements PlatformFileOperations {
  async pickFiles(): Promise<{ path: string; name: string }[] | null> {
    if (!isDesktopEditor()) return null;

    return new Promise((resolve) => {
      window.AscDesktopEditor!.OpenFilenameDialog("", true, (result) => {
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
    if (!isDesktopEditor()) return "";

    return new Promise((resolve) => {
      window.AscDesktopEditor!.convertFileExternal(
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
    if (!isDesktopEditor()) return 0;

    return window.AscDesktopEditor!.getOfficeFileType(path);
  }

  async getRecentFiles(): Promise<string> {
    if (!isDesktopEditor()) return "{}";

    return (
      window.AscDesktopEditor!.callToolFunction("recent_files_reader") ?? "{}"
    );
  }

  async saveAsFile(content: string, defaultName: string): Promise<void> {
    if (!isDesktopEditor()) return;

    return new Promise((resolve) => {
      window.AscDesktopEditor!.SaveFilenameDialog(defaultName, (path) => {
        if (!path) {
          resolve();
          return;
        }
        window.AscDesktopEditor!.saveAndOpen(content, 0x5c, path, 0x41, () => {
          resolve();
        });
      });
    });
  }

  openFile(path: string, name: string): void {
    if (!isDesktopEditor()) return;

    window.AscDesktopEditor!.openTemplate(path, name);
  }
}
