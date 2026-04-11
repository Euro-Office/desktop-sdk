import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks - hoisted before module evaluation
// ---------------------------------------------------------------------------

const { settingsMap, mockSettings, mockStorage, mockProvider } = vi.hoisted(
  () => {
    const map = new Map<string, string>();
    return {
      settingsMap: map,
      mockSettings: {
        get: vi.fn((key: string) => map.get(key) ?? null),
        set: vi.fn((key: string, value: string) => map.set(key, value)),
        remove: vi.fn((key: string) => map.delete(key)),
      },
      mockStorage: {
        profiles: {
          getAll: vi.fn() as ReturnType<typeof vi.fn>,
          create: vi.fn() as ReturnType<typeof vi.fn>,
          update: vi.fn() as ReturnType<typeof vi.fn>,
          delete: vi.fn() as ReturnType<typeof vi.fn>,
        },
      },
      mockProvider: {
        setCurrentProvider: vi.fn() as ReturnType<typeof vi.fn>,
        setCurrentProviderModel: vi.fn() as ReturnType<typeof vi.fn>,
        checkNewProvider: vi.fn().mockResolvedValue(true) as ReturnType<
          typeof vi.fn
        >,
      },
    };
  }
);

vi.mock("../../settings/settings-holder", () => ({
  getSettingsInstance: () => mockSettings,
}));

vi.mock("../../storage/storage-holder", () => ({
  getStorageInstance: () => mockStorage,
}));

vi.mock("../../providers/provider-holder", () => ({
  getProviderInstance: () => mockProvider,
}));

import type { Profile } from "../../types";
import { ProfilesService } from "../profiles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Test Profile",
    providerType: overrides.providerType ?? "openai",
    baseUrl: overrides.baseUrl ?? "https://api.openai.com",
    key: overrides.key ?? "sk-test",
    modelId: overrides.modelId ?? "gpt-4",
    reasoning: overrides.reasoning ?? false,
  };
}

function createService() {
  return new ProfilesService();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProfilesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMap.clear();
  });

  // -------------------------------------------------------------------------
  // init
  // -------------------------------------------------------------------------

  describe("init", () => {
    it("loads profiles, loads default and task profiles from settings", async () => {
      const p1 = makeProfile({ id: "p1", name: "Profile 1" });
      const p2 = makeProfile({ id: "p2", name: "Profile 2" });
      mockStorage.profiles.getAll.mockResolvedValue([p1, p2]);
      settingsMap.set("defaultKey", "p2");
      settingsMap.set("taskChat", "p1");

      const service = createService();
      const result = await service.init({
        defaultKey: "defaultKey",
        taskKeys: ["taskChat", "taskSummary"],
      });

      // getAll returns [p1, p2], reversed = [p2, p1]
      expect(result.profiles).toEqual([p2, p1]);
      expect(result.defaultProfile).toEqual(p2);
      expect(result.taskProfiles.taskChat).toEqual(p1);
      expect(result.taskProfiles.taskSummary).toBeNull();
    });

    it("returns empty when no profiles exist", async () => {
      mockStorage.profiles.getAll.mockResolvedValue([]);

      const service = createService();
      const result = await service.init({
        defaultKey: "defaultKey",
        taskKeys: [],
      });

      expect(result.profiles).toEqual([]);
      expect(result.defaultProfile).toBeNull();
    });

    it("falls back to first profile when default not found", async () => {
      const p1 = makeProfile({ id: "p1", name: "Profile 1" });
      mockStorage.profiles.getAll.mockResolvedValue([p1]);
      settingsMap.set("defaultKey", "nonexistent");

      const service = createService();
      const result = await service.init({
        defaultKey: "defaultKey",
        taskKeys: [],
      });

      // reversed = [p1], fallback to profiles[0]
      expect(result.defaultProfile).toEqual(p1);
      expect(settingsMap.get("defaultKey")).toBe("p1");
    });
  });

  // -------------------------------------------------------------------------
  // loadProfileById
  // -------------------------------------------------------------------------

  describe("loadProfileById", () => {
    it("returns profile from settings key", () => {
      const p1 = makeProfile({ id: "p1" });
      const profiles = [p1];
      settingsMap.set("myKey", "p1");

      const service = createService();
      const result = service.loadProfileById(profiles, "myKey");

      expect(result).toEqual(p1);
    });

    it("returns null when key not in settings", () => {
      const service = createService();
      const result = service.loadProfileById([], "missingKey");

      expect(result).toBeNull();
    });

    it("removes stale key when profile not found in list", () => {
      settingsMap.set("staleKey", "deleted-id");

      const service = createService();
      const result = service.loadProfileById([], "staleKey");

      expect(result).toBeNull();
      expect(mockSettings.remove).toHaveBeenCalledWith("staleKey");
      expect(settingsMap.has("staleKey")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // applyCurrentChatProvider
  // -------------------------------------------------------------------------

  describe("applyCurrentChatProvider", () => {
    it("priority: session > chat > default, calls provider", () => {
      const session = makeProfile({ id: "s", name: "Session" });
      const chat = makeProfile({ id: "c", name: "Chat" });
      const def = makeProfile({ id: "d", name: "Default" });

      const service = createService();
      service.applyCurrentChatProvider(session, chat, def);

      expect(mockProvider.setCurrentProvider).toHaveBeenCalledWith({
        type: session.providerType,
        name: session.name,
        baseUrl: session.baseUrl,
        key: session.key,
      });
      expect(mockProvider.setCurrentProviderModel).toHaveBeenCalledWith(
        session.modelId,
        session.reasoning
      );
    });

    it("falls back to chat when session is null", () => {
      const chat = makeProfile({ id: "c", name: "Chat" });

      const service = createService();
      service.applyCurrentChatProvider(null, chat, null);

      expect(mockProvider.setCurrentProvider).toHaveBeenCalledWith({
        type: chat.providerType,
        name: chat.name,
        baseUrl: chat.baseUrl,
        key: chat.key,
      });
    });

    it("falls back to default when session and chat are null", () => {
      const def = makeProfile({ id: "d", name: "Default" });

      const service = createService();
      service.applyCurrentChatProvider(null, null, def);

      expect(mockProvider.setCurrentProvider).toHaveBeenCalledWith({
        type: def.providerType,
        name: def.name,
        baseUrl: def.baseUrl,
        key: def.key,
      });
    });

    it("sets provider to undefined when all are null", () => {
      const service = createService();
      service.applyCurrentChatProvider(null, null, null);

      expect(mockProvider.setCurrentProvider).toHaveBeenCalledWith(undefined);
      expect(mockProvider.setCurrentProviderModel).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // addProfile
  // -------------------------------------------------------------------------

  describe("addProfile", () => {
    it("validates, creates, and returns success", async () => {
      const data = {
        name: "New Profile",
        providerType: "openai" as const,
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
        reasoning: false,
      };
      mockProvider.checkNewProvider.mockResolvedValue(true);
      mockStorage.profiles.create.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.addProfile(data, []);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.profile.name).toBe("New Profile");
        expect(result.profile.id).toBeDefined();
      }
      expect(mockStorage.profiles.create).toHaveBeenCalled();
    });

    it("returns error with duplicate name", async () => {
      const existing = makeProfile({ name: "Duplicate" });
      const data = {
        name: "duplicate",
        providerType: "openai" as const,
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
        reasoning: false,
      };

      const service = createService();
      const result = await service.addProfile(data, [existing]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe("name");
        expect(result.error.message).toBe("Duplicate name");
      }
    });

    it("returns error when provider check fails", async () => {
      const data = {
        name: "New Profile",
        providerType: "openai" as const,
        baseUrl: "https://api.openai.com",
        key: "bad-key",
        modelId: "gpt-4",
        reasoning: false,
      };
      const errorData = { field: "key" as const, message: "Invalid API key" };
      mockProvider.checkNewProvider.mockResolvedValue(errorData);

      const service = createService();
      const result = await service.addProfile(data, []);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(errorData);
      }
    });
  });

  // -------------------------------------------------------------------------
  // editProfile
  // -------------------------------------------------------------------------

  describe("editProfile", () => {
    it("validates, updates, and returns success", async () => {
      const profile = makeProfile({ id: "p1", name: "Updated" });
      const existing = [makeProfile({ id: "p1", name: "Original" })];
      mockProvider.checkNewProvider.mockResolvedValue(true);
      mockStorage.profiles.update.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.editProfile(profile, existing);

      expect(result.success).toBe(true);
      expect(mockStorage.profiles.update).toHaveBeenCalledWith(profile);
    });

    it("returns error with duplicate name (different id)", async () => {
      const profile = makeProfile({ id: "p2", name: "Taken" });
      const existing = [makeProfile({ id: "p1", name: "Taken" })];

      const service = createService();
      const result = await service.editProfile(profile, existing);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe("name");
      }
    });

    it("allows same name for same profile (edit without rename)", async () => {
      const profile = makeProfile({ id: "p1", name: "Same Name" });
      const existing = [makeProfile({ id: "p1", name: "Same Name" })];
      mockProvider.checkNewProvider.mockResolvedValue(true);
      mockStorage.profiles.update.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.editProfile(profile, existing);

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // deleteProfile
  // -------------------------------------------------------------------------

  describe("deleteProfile", () => {
    it("calls storage delete", async () => {
      mockStorage.profiles.delete.mockResolvedValue(undefined);

      const service = createService();
      await service.deleteProfile("p1");

      expect(mockStorage.profiles.delete).toHaveBeenCalledWith("p1");
    });
  });

  // -------------------------------------------------------------------------
  // clearTaskProfileIfMatch
  // -------------------------------------------------------------------------

  describe("clearTaskProfileIfMatch", () => {
    it("clears if matches and returns null", () => {
      const profile = makeProfile({ id: "p1" });

      const service = createService();
      const result = service.clearTaskProfileIfMatch(profile, "p1", "taskKey");

      expect(result).toBeNull();
      expect(mockSettings.remove).toHaveBeenCalledWith("taskKey");
    });

    it("returns profile if id does not match", () => {
      const profile = makeProfile({ id: "p1" });

      const service = createService();
      const result = service.clearTaskProfileIfMatch(
        profile,
        "other-id",
        "taskKey"
      );

      expect(result).toEqual(profile);
      expect(mockSettings.remove).not.toHaveBeenCalled();
    });

    it("returns null when profile is null and does not call remove", () => {
      const service = createService();
      const result = service.clearTaskProfileIfMatch(null, "p1", "taskKey");

      expect(result).toBeNull();
      expect(mockSettings.remove).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // reassignDefault
  // -------------------------------------------------------------------------

  describe("reassignDefault", () => {
    it("reassigns to first profile when current is deleted", () => {
      const p1 = makeProfile({ id: "p1" });
      const p2 = makeProfile({ id: "p2" });
      const current = makeProfile({ id: "deleted" });

      const service = createService();
      const result = service.reassignDefault(
        [p1, p2],
        "deleted",
        current,
        "defaultKey"
      );

      expect(result).toEqual(p1);
      expect(mockSettings.set).toHaveBeenCalledWith("defaultKey", "p1");
    });

    it("returns current unchanged when not deleted", () => {
      const current = makeProfile({ id: "p1" });

      const service = createService();
      const result = service.reassignDefault(
        [],
        "other-id",
        current,
        "defaultKey"
      );

      expect(result).toEqual(current);
      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it("removes default key when no profiles remain", () => {
      const current = makeProfile({ id: "deleted" });

      const service = createService();
      const result = service.reassignDefault(
        [],
        "deleted",
        current,
        "defaultKey"
      );

      expect(result).toBeNull();
      expect(mockSettings.remove).toHaveBeenCalledWith("defaultKey");
    });
  });

  // -------------------------------------------------------------------------
  // setTaskProfile
  // -------------------------------------------------------------------------

  describe("setTaskProfile", () => {
    it("sets settings key when profile provided", () => {
      const profile = makeProfile({ id: "p1" });

      const service = createService();
      service.setTaskProfile("taskKey", profile);

      expect(mockSettings.set).toHaveBeenCalledWith("taskKey", "p1");
    });

    it("removes settings key when profile is null", () => {
      const service = createService();
      service.setTaskProfile("taskKey", null);

      expect(mockSettings.remove).toHaveBeenCalledWith("taskKey");
    });
  });

  // -------------------------------------------------------------------------
  // selectCurrentChatProfile
  // -------------------------------------------------------------------------

  describe("selectCurrentChatProfile", () => {
    it("returns session profile when available (priority chain)", () => {
      const session = makeProfile({ id: "s" });
      const chat = makeProfile({ id: "c" });
      const def = makeProfile({ id: "d" });

      const service = createService();
      const result = service.selectCurrentChatProfile(session, chat, def);

      expect(result).toEqual(session);
    });

    it("falls back to chat profile when session is null", () => {
      const chat = makeProfile({ id: "c" });
      const def = makeProfile({ id: "d" });

      const service = createService();
      const result = service.selectCurrentChatProfile(null, chat, def);

      expect(result).toEqual(chat);
    });

    it("falls back to default when session and chat are null", () => {
      const def = makeProfile({ id: "d" });

      const service = createService();
      const result = service.selectCurrentChatProfile(null, null, def);

      expect(result).toEqual(def);
    });

    it("returns null when all are null", () => {
      const service = createService();
      const result = service.selectCurrentChatProfile(null, null, null);

      expect(result).toBeNull();
    });
  });
});
