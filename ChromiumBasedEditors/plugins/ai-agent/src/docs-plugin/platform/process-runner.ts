import type { PlatformProcessRunner } from "@onlyoffice/ai-chat";
import type { TProcess } from "@/shared/lib/types.ts";

export class OnlyOfficeProcessRunner implements PlatformProcessRunner {
  createProcess(
    command: string,
    env?: Record<string, string>
  ): TProcess | null {
    if (!this.isAvailable()) return null;

    const process = new window.ExternalProcess(command, env);
    return process as TProcess;
  }

  isAvailable(): boolean {
    return "ExternalProcess" in window;
  }
}
