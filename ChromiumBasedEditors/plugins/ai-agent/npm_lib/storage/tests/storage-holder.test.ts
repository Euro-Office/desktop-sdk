import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../types";

describe("storage-holder", () => {
  let getStorageInstance: typeof import("../storage-holder").getStorageInstance;
  let setStorageInstance: typeof import("../storage-holder").setStorageInstance;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../storage-holder");
    getStorageInstance = mod.getStorageInstance;
    setStorageInstance = mod.setStorageInstance;
  });

  it("throws before any instance is set", () => {
    expect(() => getStorageInstance()).toThrow(
      "Storage not initialized. Call setStorageInstance() first."
    );
  });

  it("returns the instance after setStorageInstance", () => {
    const storage = {} as StorageAdapter;
    setStorageInstance(storage);
    expect(getStorageInstance()).toBe(storage);
  });

  it("overwrites a previously set instance", () => {
    const first = { id: 1 } as unknown as StorageAdapter;
    const second = { id: 2 } as unknown as StorageAdapter;
    setStorageInstance(first);
    setStorageInstance(second);
    expect(getStorageInstance()).toBe(second);
  });
});
