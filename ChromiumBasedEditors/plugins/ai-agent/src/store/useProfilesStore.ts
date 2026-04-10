import { create } from "zustand";
import {
  CHAT_PROFILE_KEY,
  DEEP_MODE_KEY,
  DEFAULT_PROFILE_KEY,
  IMAGE_GENERATION_PROFILE_KEY,
  OCR_PROFILE_KEY,
  SUMMARIZATION_PROFILE_KEY,
  TEXT_ANALYSIS_PROFILE_KEY,
  TRANSLATION_PROFILE_KEY,
  VISION_PROFILE_KEY,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";
import type { TErrorData } from "../../npm_lib/providers/base";
import { getProviderInstance } from "../../npm_lib/providers/provider-holder";
import { getStorageInstance } from "../../npm_lib/storage/storage-holder";

const NAME_EXISTS_ERROR = {
  field: "name" as const,
  message: "Duplicate name",
};

const TASK_PROFILE_KEYS = [
  CHAT_PROFILE_KEY,
  SUMMARIZATION_PROFILE_KEY,
  TRANSLATION_PROFILE_KEY,
  TEXT_ANALYSIS_PROFILE_KEY,
  IMAGE_GENERATION_PROFILE_KEY,
  OCR_PROFILE_KEY,
  VISION_PROFILE_KEY,
] as const;

function loadProfileById(profiles: Profile[], key: string): Profile | null {
  const id = localStorage.getItem(key);
  if (!id) return null;
  const found = profiles.find((p) => p.id === id);
  if (!found) {
    localStorage.removeItem(key);
    return null;
  }
  return found;
}

function applyCurrentChatProvider(
  sessionChatProfile: Profile | null,
  chatProfile: Profile | null,
  defaultProfile: Profile | null
) {
  const active = sessionChatProfile ?? chatProfile ?? defaultProfile;
  if (active) {
    getProviderInstance().setCurrentProvider({
      type: active.providerType,
      name: active.name,
      baseUrl: active.baseUrl,
      key: active.key,
    });
    getProviderInstance().setCurrentProviderModel(
      active.modelId,
      active.reasoning
    );
  } else {
    getProviderInstance().setCurrentProvider(undefined);
  }
}

interface ProfilesState {
  profiles: Profile[];
  defaultProfile: Profile | null;
  chatProfile: Profile | null;
  summarizationProfile: Profile | null;
  translationProfile: Profile | null;
  textAnalysisProfile: Profile | null;
  imageGenerationProfile: Profile | null;
  ocrProfile: Profile | null;
  visionProfile: Profile | null;
  sessionChatProfile: Profile | null;
  extendedThinking: boolean;
  init: () => Promise<void>;
  addProfile: (
    data: Omit<Profile, "id">
  ) => Promise<boolean | TErrorData | undefined>;
  editProfile: (profile: Profile) => Promise<boolean | TErrorData | undefined>;
  deleteProfile: (id: string) => Promise<void>;
  getProfileById: (id: string) => Profile | null;
  getProfileByName: (name: string, ignoreCase?: boolean) => Profile | null;
  setDefaultProfile: (profile: Profile) => void;
  setChatProfile: (profile: Profile | null) => void;
  setSummarizationProfile: (profile: Profile | null) => void;
  setTranslationProfile: (profile: Profile | null) => void;
  setTextAnalysisProfile: (profile: Profile | null) => void;
  setImageGenerationProfile: (profile: Profile | null) => void;
  setOcrProfile: (profile: Profile | null) => void;
  setVisionProfile: (profile: Profile | null) => void;
  setSessionChatProfile: (profile: Profile | null) => void;
  toggleExtendedThinking: () => void;
}

const useProfilesStore = create<ProfilesState>()((set, get) => ({
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

  init: async () => {
    const storage = getStorageInstance();
    const profiles = (await storage.profiles.getAll()).reverse();
    set({ profiles });

    const defaultProfile =
      loadProfileById(profiles, DEFAULT_PROFILE_KEY) ?? profiles[0] ?? null;

    if (defaultProfile) {
      localStorage.setItem(DEFAULT_PROFILE_KEY, defaultProfile.id);
    }

    const chatProfile = loadProfileById(profiles, CHAT_PROFILE_KEY);
    const summarizationProfile = loadProfileById(
      profiles,
      SUMMARIZATION_PROFILE_KEY
    );
    const translationProfile = loadProfileById(
      profiles,
      TRANSLATION_PROFILE_KEY
    );
    const textAnalysisProfile = loadProfileById(
      profiles,
      TEXT_ANALYSIS_PROFILE_KEY
    );
    const imageGenerationProfile = loadProfileById(
      profiles,
      IMAGE_GENERATION_PROFILE_KEY
    );
    const ocrProfile = loadProfileById(profiles, OCR_PROFILE_KEY);
    const visionProfile = loadProfileById(profiles, VISION_PROFILE_KEY);

    set({
      defaultProfile,
      chatProfile,
      summarizationProfile,
      translationProfile,
      textAnalysisProfile,
      imageGenerationProfile,
      ocrProfile,
      visionProfile,
    });

    applyCurrentChatProvider(null, chatProfile, defaultProfile);
  },

  addProfile: async (data) => {
    const nameExists = get().profiles.some(
      (p) => p.name.toLowerCase() === data.name.toLowerCase()
    );

    if (nameExists) return NAME_EXISTS_ERROR;

    const checkResult = await getProviderInstance().checkNewProvider(
      data.providerType,
      {
        url: data.baseUrl,
        apiKey: data.key,
      }
    );

    if (typeof checkResult === "boolean" && checkResult) {
      const isFirst = get().profiles.length === 0;
      const storage = getStorageInstance();
      const newProfile: Profile = { ...data, id: crypto.randomUUID() };
      await storage.profiles.create(newProfile);
      set((state) => ({ profiles: [newProfile, ...state.profiles] }));
      if (isFirst) get().setDefaultProfile(newProfile);
      return true;
    } else {
      return checkResult;
    }
  },

  editProfile: async (profile) => {
    const nameExists = get().profiles.some(
      (p) =>
        p.name.toLowerCase() === profile.name.toLowerCase() &&
        p.id !== profile.id
    );

    if (nameExists) return NAME_EXISTS_ERROR;

    const checkResult = await getProviderInstance().checkNewProvider(
      profile.providerType,
      {
        url: profile.baseUrl,
        apiKey: profile.key,
      }
    );

    if (typeof checkResult === "boolean" && checkResult) {
      const storage = getStorageInstance();
      await storage.profiles.update(profile);
      set((state) => {
        const profiles = state.profiles.map((p) =>
          p.id === profile.id ? profile : p
        );

        const updateIfMatch = (p: Profile | null) =>
          p?.id === profile.id ? profile : p;

        const defaultProfile = updateIfMatch(state.defaultProfile);
        const chatProfile = updateIfMatch(state.chatProfile);
        const summarizationProfile = updateIfMatch(state.summarizationProfile);
        const translationProfile = updateIfMatch(state.translationProfile);
        const textAnalysisProfile = updateIfMatch(state.textAnalysisProfile);
        const imageGenerationProfile = updateIfMatch(
          state.imageGenerationProfile
        );
        const ocrProfile = updateIfMatch(state.ocrProfile);
        const visionProfile = updateIfMatch(state.visionProfile);
        const sessionChatProfile = updateIfMatch(state.sessionChatProfile);

        applyCurrentChatProvider(
          sessionChatProfile,
          chatProfile,
          defaultProfile
        );

        return {
          profiles,
          defaultProfile,
          chatProfile,
          summarizationProfile,
          translationProfile,
          textAnalysisProfile,
          imageGenerationProfile,
          ocrProfile,
          visionProfile,
          sessionChatProfile,
        };
      });
      return true;
    } else {
      return checkResult;
    }
  },

  deleteProfile: async (id) => {
    const storage = getStorageInstance();
    await storage.profiles.delete(id);
    set((state) => {
      const profiles = state.profiles.filter((p) => p.id !== id);

      const clearIfMatch = (
        p: Profile | null,
        key: (typeof TASK_PROFILE_KEYS)[number]
      ): Profile | null => {
        if (p?.id === id) {
          localStorage.removeItem(key);
          return null;
        }
        return p;
      };

      const chatProfile = clearIfMatch(state.chatProfile, CHAT_PROFILE_KEY);
      const summarizationProfile = clearIfMatch(
        state.summarizationProfile,
        SUMMARIZATION_PROFILE_KEY
      );
      const translationProfile = clearIfMatch(
        state.translationProfile,
        TRANSLATION_PROFILE_KEY
      );
      const textAnalysisProfile = clearIfMatch(
        state.textAnalysisProfile,
        TEXT_ANALYSIS_PROFILE_KEY
      );
      const imageGenerationProfile = clearIfMatch(
        state.imageGenerationProfile,
        IMAGE_GENERATION_PROFILE_KEY
      );
      const ocrProfile = clearIfMatch(state.ocrProfile, OCR_PROFILE_KEY);
      const visionProfile = clearIfMatch(
        state.visionProfile,
        VISION_PROFILE_KEY
      );
      const sessionChatProfile =
        state.sessionChatProfile?.id === id ? null : state.sessionChatProfile;

      let defaultProfile = state.defaultProfile;

      // set next default profile if current deleted
      if (state.defaultProfile?.id === id) {
        const nextDefault = profiles[0] ?? null;

        if (nextDefault) {
          localStorage.setItem(DEFAULT_PROFILE_KEY, nextDefault.id);
        } else {
          localStorage.removeItem(DEFAULT_PROFILE_KEY);
        }
        defaultProfile = nextDefault;
      }

      applyCurrentChatProvider(sessionChatProfile, chatProfile, defaultProfile);

      return {
        profiles,
        defaultProfile,
        chatProfile,
        summarizationProfile,
        translationProfile,
        textAnalysisProfile,
        imageGenerationProfile,
        ocrProfile,
        visionProfile,
        sessionChatProfile,
      };
    });
  },

  getProfileById: (id) => get().profiles.find((p) => p.id === id) ?? null,
  getProfileByName: (name, ignoreCase) =>
    get().profiles.find((p) =>
      ignoreCase ? p.name.toLowerCase() === name.toLowerCase() : p.name === name
    ) ?? null,

  setDefaultProfile: (profile) => {
    localStorage.setItem(DEFAULT_PROFILE_KEY, profile.id);
    set((state) => {
      applyCurrentChatProvider(
        state.sessionChatProfile,
        state.chatProfile,
        profile
      );
      return { defaultProfile: profile };
    });
  },

  setChatProfile: (profile) => {
    if (profile) {
      localStorage.setItem(CHAT_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(CHAT_PROFILE_KEY);
    }
    set((state) => {
      applyCurrentChatProvider(
        state.sessionChatProfile,
        profile,
        state.defaultProfile
      );
      return { chatProfile: profile };
    });
  },

  setSummarizationProfile: (profile) => {
    if (profile) {
      localStorage.setItem(SUMMARIZATION_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(SUMMARIZATION_PROFILE_KEY);
    }
    set({ summarizationProfile: profile });
  },

  setTranslationProfile: (profile) => {
    if (profile) {
      localStorage.setItem(TRANSLATION_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(TRANSLATION_PROFILE_KEY);
    }
    set({ translationProfile: profile });
  },

  setTextAnalysisProfile: (profile) => {
    if (profile) {
      localStorage.setItem(TEXT_ANALYSIS_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(TEXT_ANALYSIS_PROFILE_KEY);
    }
    set({ textAnalysisProfile: profile });
  },

  setImageGenerationProfile: (profile) => {
    if (profile) {
      localStorage.setItem(IMAGE_GENERATION_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(IMAGE_GENERATION_PROFILE_KEY);
    }
    set({ imageGenerationProfile: profile });
  },

  setOcrProfile: (profile) => {
    if (profile) {
      localStorage.setItem(OCR_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(OCR_PROFILE_KEY);
    }
    set({ ocrProfile: profile });
  },

  setVisionProfile: (profile) => {
    if (profile) {
      localStorage.setItem(VISION_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(VISION_PROFILE_KEY);
    }
    set({ visionProfile: profile });
  },

  setSessionChatProfile: (profile) => {
    set((state) => {
      applyCurrentChatProvider(
        profile,
        state.chatProfile,
        state.defaultProfile
      );
      return { sessionChatProfile: profile };
    });
  },

  extendedThinking: (() => {
    const saved = localStorage.getItem(DEEP_MODE_KEY);
    if (!saved) return false;
    return JSON.parse(saved);
  })(),

  toggleExtendedThinking: () => {
    set((state) => {
      const next = !state.extendedThinking;
      localStorage.setItem(DEEP_MODE_KEY, JSON.stringify(next));
      return { extendedThinking: next };
    });
  },
}));

export const selectCurrentChatProfile = (s: ProfilesState) =>
  s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

export default useProfilesStore;
