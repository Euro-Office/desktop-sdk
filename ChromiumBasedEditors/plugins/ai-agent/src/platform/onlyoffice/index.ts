import type { PlatformAdapter } from "../../../npm_lib/platform/types";
import { OnlyOfficeEnvironment } from "./environment";
import { OnlyOfficeFileOps } from "./file-ops";
import { OnlyOfficeHostTools } from "./host-tools";
import { OnlyOfficeProcessRunner } from "./process-runner";

export class OnlyOfficePlatform implements PlatformAdapter {
  file: OnlyOfficeFileOps;
  process: OnlyOfficeProcessRunner;
  env: OnlyOfficeEnvironment;
  hostTools: OnlyOfficeHostTools;

  constructor() {
    this.file = new OnlyOfficeFileOps();
    this.process = new OnlyOfficeProcessRunner();
    this.env = new OnlyOfficeEnvironment();
    this.hostTools = new OnlyOfficeHostTools();
  }
}
