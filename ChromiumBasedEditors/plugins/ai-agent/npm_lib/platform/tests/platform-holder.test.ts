import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformAdapter } from "../types";

describe("platform-holder", () => {
  let getPlatformInstance: typeof import("../platform-holder").getPlatformInstance;
  let setPlatformInstance: typeof import("../platform-holder").setPlatformInstance;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../platform-holder");
    getPlatformInstance = mod.getPlatformInstance;
    setPlatformInstance = mod.setPlatformInstance;
  });

  it("returns null before any instance is set", () => {
    expect(getPlatformInstance()).toBeNull();
  });

  it("returns the instance after setPlatformInstance", () => {
    const platform = { env: { theme: "dark" } } as unknown as PlatformAdapter;
    setPlatformInstance(platform);
    expect(getPlatformInstance()).toBe(platform);
  });

  it("overwrites a previously set instance", () => {
    const first = { env: { theme: "dark" } } as unknown as PlatformAdapter;
    const second = { env: { theme: "light" } } as unknown as PlatformAdapter;
    setPlatformInstance(first);
    setPlatformInstance(second);
    expect(getPlatformInstance()).toBe(second);
  });
});
