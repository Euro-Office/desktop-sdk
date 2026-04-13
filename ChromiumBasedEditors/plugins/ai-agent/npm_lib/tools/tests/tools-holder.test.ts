import { beforeEach, describe, expect, it, vi } from "vitest";
import type Servers from "../servers";

describe("tools-holder", () => {
  let getServersInstance: typeof import("../tools-holder").getServersInstance;
  let setServersInstance: typeof import("../tools-holder").setServersInstance;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../tools-holder");
    getServersInstance = mod.getServersInstance;
    setServersInstance = mod.setServersInstance;
  });

  it("throws before any instance is set", () => {
    expect(() => getServersInstance()).toThrow(
      "Servers not initialized. Wrap your app in <ToolsProvider>."
    );
  });

  it("returns the instance after setServersInstance", () => {
    const servers = {} as Servers;
    setServersInstance(servers);
    expect(getServersInstance()).toBe(servers);
  });

  it("overwrites a previously set instance", () => {
    const first = { id: 1 } as unknown as Servers;
    const second = { id: 2 } as unknown as Servers;
    setServersInstance(first);
    setServersInstance(second);
    expect(getServersInstance()).toBe(second);
  });
});
