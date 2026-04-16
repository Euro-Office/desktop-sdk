import type { PlatformAdapter } from "@onlyoffice/ai-chat";
import { OnlyOfficeClouds } from "./clouds.ts";
import { OnlyOfficeEnvironment } from "./environment.ts";
import { OnlyOfficeFileOps } from "./file-ops.ts";
import { OnlyOfficeHostTools } from "./host-tools.ts";
import { OnlyOfficeProcessRunner } from "./process-runner.ts";

export class OnlyOfficePlatform implements PlatformAdapter {
  file: OnlyOfficeFileOps;
  process: OnlyOfficeProcessRunner;
  env: OnlyOfficeEnvironment;
  hostTools: OnlyOfficeHostTools;
  clouds: OnlyOfficeClouds;

  constructor() {
    this.file = new OnlyOfficeFileOps();
    this.process = new OnlyOfficeProcessRunner();
    this.env = new OnlyOfficeEnvironment();
    this.hostTools = new OnlyOfficeHostTools();
    this.clouds = new OnlyOfficeClouds();
  }

  fetchProxy = (url: string, init?: RequestInit): Promise<Response> => {
    return fetch(`onlyoffice-proxy://${url}`, init);
  };
}
