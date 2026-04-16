import type { PlatformProcessRunner } from "@onlyoffice/ai-chat";
import type { TProcess } from "@/shared/lib/types.ts";

export class OnlyOfficeProcessRunner implements PlatformProcessRunner {
  createProcess(
    command: string,
    env?: Record<string, string>
  ): TProcess | null {
    if (!this.isAvailable()) return null;

    const ExternalProcess = window.ExternalProcess;
    if (!ExternalProcess) return null;
    return new ExternalProcess(command, env);
  }

  isAvailable(): boolean {
    return "ExternalProcess" in window;
  }
}
