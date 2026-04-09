import type { TProcess } from "../../types";
import type { PlatformProcessRunner } from "../types";

export class OnlyOfficeProcessRunner implements PlatformProcessRunner {
  createProcess(command: string, env?: Record<string, string>): TProcess | null {
    if (!this.isAvailable()) return null;

    // biome-ignore lint/suspicious/noExplicitAny: ONLYOFFICE global API
    const process = new (window as any).ExternalProcess(command, env);
    return process as TProcess;
  }

  isAvailable(): boolean {
    return "ExternalProcess" in window;
  }
}
