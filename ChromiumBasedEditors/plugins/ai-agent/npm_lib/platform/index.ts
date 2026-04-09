export type {
  PlatformAdapter,
  PlatformFileOperations,
  PlatformProcessRunner,
  PlatformEnvironment,
  PlatformHostTools,
} from "./types";

export { OnlyOfficePlatform } from "./onlyoffice";
export { NoopPlatform } from "./noop";
export { PlatformProvider, usePlatform } from "./context";
