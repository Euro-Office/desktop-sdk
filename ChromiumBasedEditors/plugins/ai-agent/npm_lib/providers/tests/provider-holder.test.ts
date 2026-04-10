import { beforeEach, describe, expect, it, vi } from "vitest";
import type Provider from "../index";

describe("provider-holder", () => {
  let getProviderInstance: typeof import("../provider-holder").getProviderInstance;
  let setProviderInstance: typeof import("../provider-holder").setProviderInstance;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../provider-holder");
    getProviderInstance = mod.getProviderInstance;
    setProviderInstance = mod.setProviderInstance;
  });

  it("throws before any instance is set", () => {
    expect(() => getProviderInstance()).toThrow("Provider not initialized.");
  });

  it("returns the instance after setProviderInstance", () => {
    const provider = {} as InstanceType<typeof Provider>;
    setProviderInstance(provider);
    expect(getProviderInstance()).toBe(provider);
  });

  it("overwrites a previously set instance", () => {
    const first = { id: 1 } as unknown as InstanceType<typeof Provider>;
    const second = { id: 2 } as unknown as InstanceType<typeof Provider>;
    setProviderInstance(first);
    setProviderInstance(second);
    expect(getProviderInstance()).toBe(second);
  });
});
