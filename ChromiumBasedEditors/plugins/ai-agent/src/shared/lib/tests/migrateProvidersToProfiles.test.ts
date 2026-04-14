import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- localStorage mock (hoisted) ---

const { localStorageMap, localStorageMock } = vi.hoisted(() => {
  const map = new Map<string, string>();
  const mock = {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => map.set(key, value)),
    removeItem: vi.fn((key: string) => map.delete(key)),
    clear: vi.fn(() => map.clear()),
    get length() {
      return map.size;
    },
    key: vi.fn(),
  };
  // @ts-expect-error — setting global before modules load
  globalThis.localStorage = mock;
  return { localStorageMap: map, localStorageMock: mock };
});

// --- Storage mock ---

const mockStorage = {
  profiles: {
    createMany: vi.fn(),
  },
};

vi.mock("@onlyoffice/ai-chat", () => ({
  getStorageInstance: () => mockStorage,
}));

import { migrateProvidersToProfiles } from "../migrateProvidersToProfiles.ts";

// --- Helpers ---

const setProviders = (providers: unknown[]) => {
  localStorageMap.set("providers", JSON.stringify(providers));
};

const setCurrentProvider = (provider: unknown) => {
  localStorageMap.set("current-provider", JSON.stringify(provider));
};

const setCurrentModel = (model: unknown) => {
  localStorageMap.set("current-model", JSON.stringify(model));
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMap.clear();
  mockStorage.profiles.createMany.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe("migrateProvidersToProfiles", () => {
  it("does nothing when no providers in localStorage", async () => {
    await migrateProvidersToProfiles();

    expect(mockStorage.profiles.createMany).not.toHaveBeenCalled();
    // Cleans up stale keys
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "current-provider"
    );
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("current-model");
  });

  it("creates profiles for valid providers × their models", async () => {
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "sk-ant",
      },
    ]);

    await migrateProvidersToProfiles();

    expect(mockStorage.profiles.createMany).toHaveBeenCalledOnce();
    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    // Anthropic has 3 models in MIGRATION_PROVIDERS snapshot
    expect(profiles).toHaveLength(3);
    expect(profiles[0].providerType).toBe("anthropic");
    expect(profiles[0].baseUrl).toBe("https://api.anthropic.com");
    expect(profiles[0].key).toBe("sk-ant");
  });

  it("sorts profiles by name", async () => {
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
      },
    ]);

    await migrateProvidersToProfiles();

    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    const names = profiles.map((p: { name: string }) => p.name);
    const sorted = [...names].sort((a: string, b: string) =>
      a.localeCompare(b)
    );
    expect(names).toEqual(sorted);
  });

  it("sets default profile from current provider/model match", async () => {
    setProviders([
      {
        type: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
      },
    ]);
    setCurrentProvider({
      type: "openai",
      baseUrl: "https://api.openai.com",
      key: "sk-test",
    });
    setCurrentModel({ id: "gpt-5.2-2025-12-11" });

    await migrateProvidersToProfiles();

    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    const matched = profiles.find(
      (p: { modelId: string }) => p.modelId === "gpt-5.2-2025-12-11"
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "default-profile",
      matched.id
    );
  });

  it("falls back to first profile when current provider/model don't match", async () => {
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
      },
    ]);
    // Set current provider/model that won't match any created profile
    setCurrentProvider({
      type: "openai",
      baseUrl: "https://api.openai.com",
      key: "different-key",
    });
    setCurrentModel({ id: "nonexistent-model-id" });

    await migrateProvidersToProfiles();

    // Should still set default-profile to the first created profile (sorted)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "default-profile",
      expect.any(String)
    );
    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    const defaultId = localStorageMock.setItem.mock.calls.find(
      ([key]: [string]) => key === "default-profile"
    )?.[1];
    expect(defaultId).toBe(profiles[0].id);
  });

  it("sets first profile as default when no current provider match", async () => {
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
      },
    ]);

    await migrateProvidersToProfiles();

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "default-profile",
      expect.any(String)
    );
  });

  it("skips unknown provider types", async () => {
    setProviders([
      {
        type: "unknown-provider",
        baseUrl: "https://unknown.com",
        key: "key",
      },
    ]);

    await migrateProvidersToProfiles();

    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    expect(profiles).toHaveLength(0);
  });

  it("skips invalid provider entries", async () => {
    setProviders([
      null,
      42,
      "string",
      { noBaseUrl: true },
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "valid",
      },
    ]);

    await migrateProvidersToProfiles();

    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    // Only the valid anthropic provider should produce profiles
    expect(profiles.length).toBeGreaterThan(0);
    expect(
      profiles.every(
        (p: { providerType: string }) => p.providerType === "anthropic"
      )
    ).toBe(true);
  });

  it("cleans up localStorage keys after successful migration", async () => {
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
      },
    ]);

    await migrateProvidersToProfiles();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("providers");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "current-provider"
    );
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("current-model");
  });

  it("handles corrupted JSON gracefully and cleans up", async () => {
    localStorageMap.set("providers", "not valid json{{{");

    await migrateProvidersToProfiles();

    expect(mockStorage.profiles.createMany).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("providers");
  });

  it("handles non-array providers value gracefully", async () => {
    localStorageMap.set("providers", JSON.stringify({ not: "array" }));

    await migrateProvidersToProfiles();

    expect(mockStorage.profiles.createMany).not.toHaveBeenCalled();
  });

  it("does not overwrite existing default-profile", async () => {
    localStorageMap.set("default-profile", "existing-id");
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
      },
    ]);

    await migrateProvidersToProfiles();

    // Should not have set default-profile since one already exists
    const setItemCalls = localStorageMock.setItem.mock.calls.filter(
      ([key]: [string]) => key === "default-profile"
    );
    expect(setItemCalls).toHaveLength(0);
  });

  it("creates profiles with reasoning flag from migration snapshot", async () => {
    setProviders([
      {
        type: "anthropic",
        baseUrl: "https://api.anthropic.com",
        key: "key",
      },
    ]);

    await migrateProvidersToProfiles();

    const profiles = mockStorage.profiles.createMany.mock.calls[0][0];
    const sonnet = profiles.find((p: { name: string }) =>
      p.name.includes("Sonnet")
    );
    const haiku = profiles.find((p: { name: string }) =>
      p.name.includes("Haiku")
    );
    expect(sonnet.reasoning).toBe(true);
    expect(haiku.reasoning).toBeUndefined();
  });
});
