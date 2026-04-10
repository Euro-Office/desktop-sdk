import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";

// --- localStorage mock (hoisted to run before any module evaluation) ---

const { localStorageMap } = vi.hoisted(() => {
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
  return { localStorageMap: map };
});

import useProfilesStore, {
  selectCurrentChatProfile,
} from "../useProfilesStore";

// --- Mocks ---

const mockStorage = {
  profiles: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
    getById: vi.fn(),
  },
};

const mockSettings = {
  get: vi.fn((key: string) => localStorageMap.get(key) ?? null),
  set: vi.fn((key: string, value: string) => localStorageMap.set(key, value)),
  remove: vi.fn((key: string) => localStorageMap.delete(key)),
};

const mockProvider = {
  setCurrentProvider: vi.fn(),
  setCurrentProviderModel: vi.fn(),
  checkNewProvider: vi.fn(),
};

vi.mock("../../../npm_lib/storage/storage-holder", () => ({
  getStorageInstance: () => mockStorage,
}));

vi.mock("../../../npm_lib/providers/provider-holder", () => ({
  getProviderInstance: () => mockProvider,
}));

vi.mock("../../../npm_lib/settings/settings-holder", () => ({
  getSettingsInstance: () => mockSettings,
}));

// --- Helpers ---

const makeProfile = (overrides?: Partial<Profile>): Profile => ({
  id: crypto.randomUUID(),
  name: "Test Profile",
  providerType: "openai",
  baseUrl: "https://api.openai.com",
  key: "sk-test",
  modelId: "gpt-4",
  ...overrides,
});

const resetStore = () => {
  useProfilesStore.setState({
    profiles: [],
    defaultProfile: null,
    chatProfile: null,
    summarizationProfile: null,
    translationProfile: null,
    textAnalysisProfile: null,
    imageGenerationProfile: null,
    ocrProfile: null,
    visionProfile: null,
    sessionChatProfile: null,
    extendedThinking: false,
  });
};

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  localStorageMap.clear();
  mockStorage.profiles.create.mockResolvedValue(undefined);
  mockStorage.profiles.update.mockResolvedValue(undefined);
  mockStorage.profiles.delete.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe("useProfilesStore", () => {
  describe("init", () => {
    it("loads profiles from storage and sets first as default", async () => {
      const profiles = [makeProfile({ name: "A" }), makeProfile({ name: "B" })];
      mockStorage.profiles.getAll.mockResolvedValue(profiles);

      await useProfilesStore.getState().init();

      const state = useProfilesStore.getState();
      // getAll returns in insertion order, init reverses → last inserted first
      expect(state.profiles).toHaveLength(2);
      expect(state.defaultProfile).toBeTruthy();
    });

    it("restores default profile from localStorage", async () => {
      const p1 = makeProfile({ name: "A" });
      const p2 = makeProfile({ name: "B" });
      mockStorage.profiles.getAll.mockResolvedValue([p1, p2]);
      localStorageMap.set("default-profile", p2.id);

      await useProfilesStore.getState().init();

      expect(useProfilesStore.getState().defaultProfile?.id).toBe(p2.id);
    });

    it("restores task profiles from localStorage", async () => {
      const p = makeProfile({ name: "Chat Model" });
      mockStorage.profiles.getAll.mockResolvedValue([p]);
      localStorageMap.set("chat-profile", p.id);

      await useProfilesStore.getState().init();

      expect(useProfilesStore.getState().chatProfile?.id).toBe(p.id);
    });

    it("clears localStorage key if profile no longer exists", async () => {
      mockStorage.profiles.getAll.mockResolvedValue([]);
      localStorageMap.set("chat-profile", "deleted-id");

      await useProfilesStore.getState().init();

      expect(mockSettings.remove).toHaveBeenCalledWith("chat-profile");
      expect(useProfilesStore.getState().chatProfile).toBeNull();
    });

    it("calls applyCurrentChatProvider with resolved profiles", async () => {
      const p = makeProfile();
      mockStorage.profiles.getAll.mockResolvedValue([p]);

      await useProfilesStore.getState().init();

      expect(mockProvider.setCurrentProvider).toHaveBeenCalled();
    });
  });

  describe("addProfile", () => {
    it("creates profile when provider check passes", async () => {
      mockProvider.checkNewProvider.mockResolvedValue(true);

      const result = await useProfilesStore.getState().addProfile({
        name: "New",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
      });

      expect(result).toBe(true);
      expect(useProfilesStore.getState().profiles).toHaveLength(1);
      expect(mockStorage.profiles.create).toHaveBeenCalledOnce();
    });

    it("returns error when name already exists (case-insensitive)", async () => {
      const existing = makeProfile({ name: "Existing" });
      useProfilesStore.setState({ profiles: [existing] });

      const result = await useProfilesStore.getState().addProfile({
        name: "existing",
        providerType: "openai",
        baseUrl: "url",
        key: "key",
        modelId: "m",
      });

      expect(result).toEqual({ field: "name", message: "Duplicate name" });
      expect(mockStorage.profiles.create).not.toHaveBeenCalled();
    });

    it("returns provider check error when check fails", async () => {
      const error = { message: "Invalid API key", status: 401 };
      mockProvider.checkNewProvider.mockResolvedValue(error);

      const result = await useProfilesStore.getState().addProfile({
        name: "New",
        providerType: "openai",
        baseUrl: "url",
        key: "bad-key",
        modelId: "m",
      });

      expect(result).toEqual(error);
    });

    it("auto-sets default profile when adding first profile", async () => {
      mockProvider.checkNewProvider.mockResolvedValue(true);

      await useProfilesStore.getState().addProfile({
        name: "First",
        providerType: "openai",
        baseUrl: "url",
        key: "key",
        modelId: "m",
      });

      expect(useProfilesStore.getState().defaultProfile).toBeTruthy();
      expect(mockSettings.set).toHaveBeenCalledWith(
        "default-profile",
        expect.any(String)
      );
    });

    it("does not change default when adding subsequent profiles", async () => {
      const existing = makeProfile({ name: "First" });
      useProfilesStore.setState({
        profiles: [existing],
        defaultProfile: existing,
      });
      mockProvider.checkNewProvider.mockResolvedValue(true);

      await useProfilesStore.getState().addProfile({
        name: "Second",
        providerType: "openai",
        baseUrl: "url",
        key: "key",
        modelId: "m",
      });

      expect(useProfilesStore.getState().defaultProfile?.id).toBe(existing.id);
    });
  });

  describe("editProfile", () => {
    it("updates profile in state and storage", async () => {
      const profile = makeProfile({ name: "Old" });
      useProfilesStore.setState({ profiles: [profile] });
      mockProvider.checkNewProvider.mockResolvedValue(true);

      const updated = { ...profile, name: "New" };
      const result = await useProfilesStore.getState().editProfile(updated);

      expect(result).toBe(true);
      expect(useProfilesStore.getState().profiles[0].name).toBe("New");
      expect(mockStorage.profiles.update).toHaveBeenCalledWith(updated);
    });

    it("rejects duplicate name on different profile", async () => {
      const p1 = makeProfile({ name: "Alpha" });
      const p2 = makeProfile({ name: "Beta" });
      useProfilesStore.setState({ profiles: [p1, p2] });

      const result = await useProfilesStore
        .getState()
        .editProfile({ ...p2, name: "Alpha" });

      expect(result).toEqual({ field: "name", message: "Duplicate name" });
    });

    it("returns provider check error when check fails", async () => {
      const p = makeProfile({ name: "Test" });
      useProfilesStore.setState({ profiles: [p] });
      const error = { message: "Connection failed", status: 500 };
      mockProvider.checkNewProvider.mockResolvedValue(error);

      const result = await useProfilesStore
        .getState()
        .editProfile({ ...p, key: "bad-key" });

      expect(result).toEqual(error);
      expect(mockStorage.profiles.update).not.toHaveBeenCalled();
    });

    it("allows keeping same name on same profile", async () => {
      const p = makeProfile({ name: "Same" });
      useProfilesStore.setState({ profiles: [p] });
      mockProvider.checkNewProvider.mockResolvedValue(true);

      const result = await useProfilesStore
        .getState()
        .editProfile({ ...p, key: "new-key" });

      expect(result).toBe(true);
    });

    it("cascades update to task profiles", async () => {
      const p = makeProfile({ name: "Multi" });
      useProfilesStore.setState({
        profiles: [p],
        defaultProfile: p,
        chatProfile: p,
      });
      mockProvider.checkNewProvider.mockResolvedValue(true);

      const updated = { ...p, name: "Updated Multi" };
      await useProfilesStore.getState().editProfile(updated);

      expect(useProfilesStore.getState().defaultProfile?.name).toBe(
        "Updated Multi"
      );
      expect(useProfilesStore.getState().chatProfile?.name).toBe(
        "Updated Multi"
      );
    });
  });

  describe("deleteProfile", () => {
    it("removes profile from state and storage", async () => {
      const p = makeProfile();
      useProfilesStore.setState({ profiles: [p] });

      await useProfilesStore.getState().deleteProfile(p.id);

      expect(useProfilesStore.getState().profiles).toHaveLength(0);
      expect(mockStorage.profiles.delete).toHaveBeenCalledWith(p.id);
    });

    it("clears task profile assignments when deleted profile was assigned", async () => {
      const p = makeProfile();
      localStorageMap.set("chat-profile", p.id);
      useProfilesStore.setState({ profiles: [p], chatProfile: p });

      await useProfilesStore.getState().deleteProfile(p.id);

      expect(useProfilesStore.getState().chatProfile).toBeNull();
      expect(mockSettings.remove).toHaveBeenCalledWith("chat-profile");
    });

    it("reassigns default profile to next available", async () => {
      const p1 = makeProfile({ name: "A" });
      const p2 = makeProfile({ name: "B" });
      useProfilesStore.setState({
        profiles: [p1, p2],
        defaultProfile: p1,
      });

      await useProfilesStore.getState().deleteProfile(p1.id);

      expect(useProfilesStore.getState().defaultProfile?.id).toBe(p2.id);
    });

    it("clears default when last profile deleted", async () => {
      const p = makeProfile();
      useProfilesStore.setState({ profiles: [p], defaultProfile: p });

      await useProfilesStore.getState().deleteProfile(p.id);

      expect(useProfilesStore.getState().defaultProfile).toBeNull();
      expect(mockSettings.remove).toHaveBeenCalledWith("default-profile");
    });
  });

  describe("getProfileById / getProfileByName", () => {
    it("finds profile by id", () => {
      const p = makeProfile();
      useProfilesStore.setState({ profiles: [p] });

      expect(useProfilesStore.getState().getProfileById(p.id)).toEqual(p);
    });

    it("returns null for unknown id", () => {
      expect(useProfilesStore.getState().getProfileById("unknown")).toBeNull();
    });

    it("finds profile by name case-insensitive", () => {
      const p = makeProfile({ name: "MyProfile" });
      useProfilesStore.setState({ profiles: [p] });

      expect(
        useProfilesStore.getState().getProfileByName("myprofile", true)
      ).toEqual(p);
    });

    it("finds profile by name case-sensitive", () => {
      const p = makeProfile({ name: "MyProfile" });
      useProfilesStore.setState({ profiles: [p] });

      expect(useProfilesStore.getState().getProfileByName("MyProfile")).toEqual(
        p
      );
      expect(
        useProfilesStore.getState().getProfileByName("myprofile")
      ).toBeNull();
    });
  });

  describe("setDefaultProfile", () => {
    it("sets default and persists to localStorage", () => {
      const p = makeProfile();
      useProfilesStore.setState({ profiles: [p] });

      useProfilesStore.getState().setDefaultProfile(p);

      expect(useProfilesStore.getState().defaultProfile).toEqual(p);
      expect(mockSettings.set).toHaveBeenCalledWith("default-profile", p.id);
    });

    it("syncs provider via applyCurrentChatProvider", () => {
      const p = makeProfile();
      useProfilesStore.getState().setDefaultProfile(p);

      expect(mockProvider.setCurrentProvider).toHaveBeenCalled();
    });
  });

  describe("setChatProfile", () => {
    it("sets chat profile and persists", () => {
      const p = makeProfile();

      useProfilesStore.getState().setChatProfile(p);

      expect(useProfilesStore.getState().chatProfile).toEqual(p);
      expect(mockSettings.set).toHaveBeenCalledWith("chat-profile", p.id);
    });

    it("clears chat profile and removes from localStorage", () => {
      useProfilesStore.getState().setChatProfile(null);

      expect(useProfilesStore.getState().chatProfile).toBeNull();
      expect(mockSettings.remove).toHaveBeenCalledWith("chat-profile");
    });

    it("syncs provider", () => {
      const p = makeProfile();
      useProfilesStore.getState().setChatProfile(p);

      expect(mockProvider.setCurrentProvider).toHaveBeenCalled();
    });
  });

  describe("task profile setters (summarization, translation, etc.)", () => {
    const taskSetters = [
      {
        setter: "setSummarizationProfile",
        field: "summarizationProfile",
        key: "summarization-profile",
      },
      {
        setter: "setTranslationProfile",
        field: "translationProfile",
        key: "translation-profile",
      },
      {
        setter: "setTextAnalysisProfile",
        field: "textAnalysisProfile",
        key: "text-analysis-profile",
      },
      {
        setter: "setImageGenerationProfile",
        field: "imageGenerationProfile",
        key: "image-generation-profile",
      },
      { setter: "setOcrProfile", field: "ocrProfile", key: "ocr-profile" },
      {
        setter: "setVisionProfile",
        field: "visionProfile",
        key: "vision-profile",
      },
    ] as const;

    for (const { setter, field, key } of taskSetters) {
      it(`${setter} sets profile and persists to "${key}"`, () => {
        const p = makeProfile();

        (useProfilesStore.getState()[setter] as (p: Profile | null) => void)(p);

        expect(
          (useProfilesStore.getState() as Record<string, unknown>)[field]
        ).toEqual(p);
        expect(mockSettings.set).toHaveBeenCalledWith(key, p.id);
      });

      it(`${setter}(null) clears and removes localStorage key`, () => {
        (useProfilesStore.getState()[setter] as (p: Profile | null) => void)(
          null
        );

        expect(
          (useProfilesStore.getState() as Record<string, unknown>)[field]
        ).toBeNull();
        expect(mockSettings.remove).toHaveBeenCalledWith(key);
      });
    }
  });

  describe("setSessionChatProfile", () => {
    it("sets session profile and syncs provider", () => {
      const p = makeProfile();

      useProfilesStore.getState().setSessionChatProfile(p);

      expect(useProfilesStore.getState().sessionChatProfile).toEqual(p);
      expect(mockProvider.setCurrentProvider).toHaveBeenCalled();
    });

    it("does not persist to localStorage", () => {
      const p = makeProfile();
      mockSettings.set.mockClear();

      useProfilesStore.getState().setSessionChatProfile(p);

      // Session profile is ephemeral — no localStorage write
      const setItemCalls = mockSettings.set.mock.calls;
      const hasSessionKey = setItemCalls.some(
        ([key]: [string]) =>
          key === "session-chat-profile" || key === "sessionChatProfile"
      );
      expect(hasSessionKey).toBe(false);
    });
  });

  describe("toggleExtendedThinking", () => {
    it("toggles from false to true", () => {
      useProfilesStore.setState({ extendedThinking: false });

      useProfilesStore.getState().toggleExtendedThinking();

      expect(useProfilesStore.getState().extendedThinking).toBe(true);
      expect(mockSettings.set).toHaveBeenCalledWith("deep-mode", "true");
    });

    it("toggles from true to false", () => {
      useProfilesStore.setState({ extendedThinking: true });

      useProfilesStore.getState().toggleExtendedThinking();

      expect(useProfilesStore.getState().extendedThinking).toBe(false);
    });
  });

  describe("selectCurrentChatProfile", () => {
    it("returns sessionChatProfile first", () => {
      const session = makeProfile({ name: "Session" });
      const chat = makeProfile({ name: "Chat" });
      const def = makeProfile({ name: "Default" });

      const state = {
        sessionChatProfile: session,
        chatProfile: chat,
        defaultProfile: def,
      };

      expect(selectCurrentChatProfile(state as never)).toEqual(session);
    });

    it("returns chatProfile when no session", () => {
      const chat = makeProfile({ name: "Chat" });
      const def = makeProfile({ name: "Default" });

      const state = {
        sessionChatProfile: null,
        chatProfile: chat,
        defaultProfile: def,
      };

      expect(selectCurrentChatProfile(state as never)).toEqual(chat);
    });

    it("returns defaultProfile as last resort", () => {
      const def = makeProfile({ name: "Default" });

      const state = {
        sessionChatProfile: null,
        chatProfile: null,
        defaultProfile: def,
      };

      expect(selectCurrentChatProfile(state as never)).toEqual(def);
    });

    it("returns null when all are null", () => {
      const state = {
        sessionChatProfile: null,
        chatProfile: null,
        defaultProfile: null,
      };

      expect(selectCurrentChatProfile(state as never)).toBeNull();
    });
  });
});
