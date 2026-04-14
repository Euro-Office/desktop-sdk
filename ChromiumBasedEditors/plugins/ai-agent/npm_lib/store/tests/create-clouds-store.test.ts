import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../app-context";
import { createCloudsStore } from "../create-clouds-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(
  clouds: AppContext["platform"]["clouds"] = null,
): AppContext {
  return {
    platform: { clouds },
  } as unknown as AppContext;
}

describe("createCloudsStore", () => {
  it("returns a store with initial empty cloudProviders", () => {
    const store = createCloudsStore(makeCtx());
    expect(store.getState().cloudProviders).toEqual([]);
  });

  describe("fetchClouds", () => {
    it("sets empty array when ctx.platform.clouds is null", async () => {
      const store = createCloudsStore(makeCtx(null));
      await store.getState().fetchClouds();
      expect(store.getState().cloudProviders).toEqual([]);
    });

    it("sets empty array when ctx.platform.clouds is undefined", async () => {
      const store = createCloudsStore(makeCtx(undefined as unknown as null));
      await store.getState().fetchClouds();
      expect(store.getState().cloudProviders).toEqual([]);
    });

    it("maps clouds with matching keys correctly", async () => {
      const clouds = {
        getClouds: vi.fn().mockResolvedValue([
          { portal: "https://cloud.example.com" },
          { portal: "https://other.example.com" },
        ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://cloud.example.com",
            keys: [{ id: "k1", value: "api-key-1" }],
          },
          {
            url: "https://other.example.com",
            keys: [{ id: "k2", value: "api-key-2" }],
          },
        ]),
      };

      const store = createCloudsStore(makeCtx(clouds));
      await store.getState().fetchClouds();

      expect(store.getState().cloudProviders).toEqual([
        {
          url: "https://cloud.example.com",
          label: "cloud.example.com",
          apiKey: "api-key-1",
        },
        {
          url: "https://other.example.com",
          label: "other.example.com",
          apiKey: "api-key-2",
        },
      ]);
    });

    it("skips clouds with no matching key", async () => {
      const clouds = {
        getClouds: vi.fn().mockResolvedValue([
          { portal: "https://cloud.example.com" },
          { portal: "https://unknown.example.com" },
        ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://cloud.example.com",
            keys: [{ id: "k1", value: "api-key-1" }],
          },
        ]),
      };

      const store = createCloudsStore(makeCtx(clouds));
      await store.getState().fetchClouds();

      expect(store.getState().cloudProviders).toEqual([
        {
          url: "https://cloud.example.com",
          label: "cloud.example.com",
          apiKey: "api-key-1",
        },
      ]);
    });

    it("skips clouds where key has no value", async () => {
      const clouds = {
        getClouds: vi.fn().mockResolvedValue([
          { portal: "https://cloud.example.com" },
          { portal: "https://nokey.example.com" },
        ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://cloud.example.com",
            keys: [{ id: "k1", value: "api-key-1" }],
          },
          {
            url: "https://nokey.example.com",
            keys: [],
          },
        ]),
      };

      const store = createCloudsStore(makeCtx(clouds));
      await store.getState().fetchClouds();

      expect(store.getState().cloudProviders).toEqual([
        {
          url: "https://cloud.example.com",
          label: "cloud.example.com",
          apiKey: "api-key-1",
        },
      ]);
    });

    it("extracts hostname as label from cloud portal URL", async () => {
      const clouds = {
        getClouds: vi.fn().mockResolvedValue([
          { portal: "https://my-docs.onlyoffice.io/some/path" },
        ]),
        getCloudKeys: vi.fn().mockReturnValue([
          {
            url: "https://my-docs.onlyoffice.io/some/path",
            keys: [{ id: "k1", value: "key-abc" }],
          },
        ]),
      };

      const store = createCloudsStore(makeCtx(clouds));
      await store.getState().fetchClouds();

      const providers = store.getState().cloudProviders;
      expect(providers).toHaveLength(1);
      expect(providers[0].label).toBe("my-docs.onlyoffice.io");
    });
  });
});
