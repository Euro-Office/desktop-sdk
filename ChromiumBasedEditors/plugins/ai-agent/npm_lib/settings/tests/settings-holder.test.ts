import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsAdapter } from "../types";

describe("settings-holder", () => {
  let getSettingsInstance: typeof import("../settings-holder").getSettingsInstance;
  let setSettingsInstance: typeof import("../settings-holder").setSettingsInstance;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../settings-holder");
    getSettingsInstance = mod.getSettingsInstance;
    setSettingsInstance = mod.setSettingsInstance;
  });

  it("throws before any instance is set", () => {
    expect(() => getSettingsInstance()).toThrow(
      "Settings not initialized. Call setSettingsInstance() first."
    );
  });

  it("returns the instance after setSettingsInstance", () => {
    const settings: SettingsAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    setSettingsInstance(settings);
    expect(getSettingsInstance()).toBe(settings);
  });

  it("overwrites a previously set instance", () => {
    const first: SettingsAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const second: SettingsAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    setSettingsInstance(first);
    setSettingsInstance(second);
    expect(getSettingsInstance()).toBe(second);
  });
});
