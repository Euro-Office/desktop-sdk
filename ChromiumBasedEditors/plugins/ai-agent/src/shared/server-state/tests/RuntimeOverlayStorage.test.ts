import type {
  ActionType,
  AssignmentsStorage,
  Profile,
  ProfilesStorage,
  StorageAdapter,
} from "@onlyoffice/ai-chat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- localStorage mock (hoisted) ---
const { localStorageMap } = vi.hoisted(() => {
  const map = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
    key: () => null,
  } as Storage;
  return { localStorageMap: map };
});

import {
  clearUserOverriddenActions,
  RuntimeOverlayStorage,
} from "../RuntimeOverlayStorage.ts";

function makeProfilesStub(initial: Profile[] = []): ProfilesStorage {
  const map = new Map(initial.map((p) => [p.id, p] as const));
  return {
    create: vi.fn(async (p) => {
      const full = {
        ...p,
        id: `local-${map.size + 1}`,
        createdAt: Date.now(),
      } as Profile;
      map.set(full.id, full);
      return full;
    }),
    createMany: vi.fn(async (arr: Omit<Profile, "id" | "createdAt">[]) =>
      arr.map((p, i) => {
        const full = {
          ...p,
          id: `local-${map.size + i + 1}`,
          createdAt: Date.now(),
        } as Profile;
        map.set(full.id, full);
        return full;
      })
    ),
    readAll: vi.fn(async () => Array.from(map.values())),
    readById: vi.fn(async (id) => map.get(id)),
    update: vi.fn(async (p) => {
      map.set(p.id, p);
    }),
    delete: vi.fn(async (id) => {
      map.delete(id);
    }),
  };
}

function makeAssignmentsStub(
  initial: Partial<Record<ActionType, string>> = {}
): AssignmentsStorage {
  const map = new Map<ActionType, string>(
    Object.entries(initial) as [ActionType, string][]
  );
  return {
    create: vi.fn(async (t, p) => {
      map.set(t, p);
    }),
    readByType: vi.fn(async (t) => map.get(t) ?? null),
    readAll: vi.fn(async () => Object.fromEntries(map) as never),
    update: vi.fn(async (t, p) => {
      map.set(t, p);
    }),
    upsertMany: vi.fn(async (entries: Partial<Record<ActionType, string>>) => {
      for (const [t, p] of Object.entries(entries)) {
        if (typeof p === "string") map.set(t as ActionType, p);
      }
    }),
    delete: vi.fn(async (t) => {
      map.delete(t);
    }),
    deleteMany: vi.fn(async (types) => {
      for (const t of types) map.delete(t);
    }),
  };
}

function makeInnerStorage(opts: {
  profiles?: ProfilesStorage;
  assignments?: AssignmentsStorage;
}): StorageAdapter {
  const passthrough = {} as never;
  return {
    profiles: opts.profiles ?? makeProfilesStub(),
    assignments: opts.assignments ?? makeAssignmentsStub(),
    threads: passthrough,
    messages: passthrough,
    prompts: passthrough,
    promptFolders: passthrough,
    preferences: passthrough,
    mcpServers: passthrough,
    toolPrefs: passthrough,
    webSearch: passthrough,
    attachments: passthrough,
    init: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

const localProfile: Profile = {
  id: "local-1",
  name: "Local Profile",
  providerType: "openai",
  baseUrl: "https://example.com",
  key: "k",
  modelId: "m",
  createdAt: 1,
};

afterEach(() => {
  localStorageMap.clear();
});

describe("RuntimeOverlayStorage.profiles", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("readAll merges server profiles before local", async () => {
    const inner = makeInnerStorage({
      profiles: makeProfilesStub([localProfile]),
    });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [
        {
          id: "srv-1",
          name: "Server",
          providerType: "anthropic",
          baseUrl: "https://srv",
          modelId: "claude",
        },
      ],
      assignments: {},
      override: true,
    });

    const all = await storage.profiles.readAll();
    expect(all.map((p) => p.id)).toEqual(["srv-1", "local-1"]);
    expect((all[0] as { isServerManaged?: boolean }).isServerManaged).toBe(
      true
    );
  });

  it("readById returns server first", async () => {
    const inner = makeInnerStorage({
      profiles: makeProfilesStub([localProfile]),
    });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [
        {
          id: "srv-1",
          name: "Server",
          providerType: "anthropic",
          baseUrl: "x",
          modelId: "y",
        },
      ],
      assignments: {},
      override: true,
    });

    const srv = await storage.profiles.readById("srv-1");
    expect(srv?.name).toBe("Server");
    const local = await storage.profiles.readById("local-1");
    expect(local?.name).toBe("Local Profile");
  });

  it("update/delete on server profile is a no-op + warn", async () => {
    const innerProfiles = makeProfilesStub([localProfile]);
    const inner = makeInnerStorage({ profiles: innerProfiles });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [
        {
          id: "srv-1",
          name: "Server",
          providerType: "openai",
          baseUrl: "x",
          modelId: "y",
        },
      ],
      assignments: {},
      override: true,
    });

    await storage.profiles.update({
      ...localProfile,
      id: "srv-1",
      name: "Hacked",
    });
    await storage.profiles.delete("srv-1");
    expect(innerProfiles.update).not.toHaveBeenCalled();
    expect(innerProfiles.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("RuntimeOverlayStorage.assignments", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("readByType with override returns server id", async () => {
    const inner = makeInnerStorage({
      assignments: makeAssignmentsStub({
        Chat: "local-1",
      } as Partial<Record<ActionType, string>>),
    });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      "srv-1"
    );
  });

  it("readByType without override falls back to local first", async () => {
    const inner = makeInnerStorage({
      assignments: makeAssignmentsStub({
        Chat: "local-1",
      } as Partial<Record<ActionType, string>>),
    });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: false,
    });
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      "local-1"
    );
  });

  it("update lifts the server overlay for that action (soft-override)", async () => {
    const innerAssignments = makeAssignmentsStub();
    const inner = makeInnerStorage({ assignments: innerAssignments });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });

    await storage.assignments.update("Chat" as ActionType, "local-1");

    expect(innerAssignments.update).toHaveBeenCalledWith(
      "Chat",
      "local-1",
      undefined
    );
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      "local-1"
    );
    // warn is asserted by the unused linter only if referenced — touch it
    // so the `let warn` does not become noise.
    void warn;
  });

  it("delete lifts the server overlay for that action", async () => {
    const innerAssignments = makeAssignmentsStub({
      Chat: "local-1",
    } as Partial<Record<ActionType, string>>);
    const inner = makeInnerStorage({ assignments: innerAssignments });
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });

    await storage.assignments.delete("Chat" as ActionType);

    expect(innerAssignments.delete).toHaveBeenCalledWith("Chat", undefined);
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      null
    );
  });

  it("user-overridden action survives a subsequent applyServerSnapshot replay", async () => {
    const innerAssignments = makeAssignmentsStub();
    const inner = makeInnerStorage({ assignments: innerAssignments });
    const storage1 = new RuntimeOverlayStorage(inner);

    // First init from host.
    storage1.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });
    expect(await storage1.assignments.readByType("Chat" as ActionType)).toBe(
      "srv-1"
    );

    // User picks a local profile via UI.
    await storage1.assignments.update("Chat" as ActionType, "local-1");
    expect(await storage1.assignments.readByType("Chat" as ActionType)).toBe(
      "local-1"
    );

    // Settings window reopens — fresh storage instance, replay arrives.
    const storage2 = new RuntimeOverlayStorage(inner);
    storage2.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });

    // User's choice must still win (overlay is skipped for user-overridden
    // actions in LS).
    expect(await storage2.assignments.readByType("Chat" as ActionType)).toBe(
      "local-1"
    );
  });

  it("clearUserOverriddenActions restores server-overlay precedence", async () => {
    const innerAssignments = makeAssignmentsStub();
    const inner = makeInnerStorage({ assignments: innerAssignments });
    const storage = new RuntimeOverlayStorage(inner);

    storage.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });
    await storage.assignments.update("Chat" as ActionType, "local-1");
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      "local-1"
    );

    // Host fires a real ai_onCustomInit → clears user overrides.
    clearUserOverriddenActions();
    storage.applyServerSnapshot({
      profiles: [],
      assignments: { Chat: "srv-1" },
      override: true,
    });

    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      "srv-1"
    );
  });
});

describe("RuntimeOverlayStorage lifecycle", () => {
  it("applyServerSnapshot replaces old server state", async () => {
    const inner = makeInnerStorage({});
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [
        {
          id: "a",
          name: "A",
          providerType: "openai",
          baseUrl: "x",
          modelId: "y",
        },
      ],
      assignments: { Chat: "a" },
      override: true,
    });
    storage.applyServerSnapshot({
      profiles: [
        {
          id: "b",
          name: "B",
          providerType: "openai",
          baseUrl: "x",
          modelId: "y",
        },
      ],
      assignments: { Chat: "b" },
      override: true,
    });
    const all = await storage.profiles.readAll();
    expect(all.map((p) => p.id)).toEqual(["b"]);
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      "b"
    );
  });

  it("clearServerState empties everything", async () => {
    const inner = makeInnerStorage({});
    const storage = new RuntimeOverlayStorage(inner);
    storage.applyServerSnapshot({
      profiles: [
        {
          id: "a",
          name: "A",
          providerType: "openai",
          baseUrl: "x",
          modelId: "y",
        },
      ],
      assignments: { Chat: "a" },
      override: true,
    });
    storage.clearServerState();
    expect(await storage.profiles.readAll()).toEqual([]);
    expect(await storage.assignments.readByType("Chat" as ActionType)).toBe(
      null
    );
    expect(storage.hasServerProfile("a")).toBe(false);
  });
});
