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
import { ProfilesService } from "../../npm_lib/services/profiles";
import { getSettingsInstance } from "../../npm_lib/settings/settings-holder";

const service = new ProfilesService();

const TASK_PROFILE_KEYS = [
  CHAT_PROFILE_KEY,
  SUMMARIZATION_PROFILE_KEY,
  TRANSLATION_PROFILE_KEY,
  TEXT_ANALYSIS_PROFILE_KEY,
  IMAGE_GENERATION_PROFILE_KEY,
  OCR_PROFILE_KEY,
  VISION_PROFILE_KEY,
] as const;

const TASK_FIELD_MAP = {
  [CHAT_PROFILE_KEY]: "chatProfile",
  [SUMMARIZATION_PROFILE_KEY]: "summarizationProfile",
  [TRANSLATION_PROFILE_KEY]: "translationProfile",
  [TEXT_ANALYSIS_PROFILE_KEY]: "textAnalysisProfile",
  [IMAGE_GENERATION_PROFILE_KEY]: "imageGenerationProfile",
  [OCR_PROFILE_KEY]: "ocrProfile",
  [VISION_PROFILE_KEY]: "visionProfile",
} as const;

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
    const { profiles, defaultProfile, taskProfiles } = await service.init({
      defaultKey: DEFAULT_PROFILE_KEY,
      taskKeys: [...TASK_PROFILE_KEYS],
    });

    const state: Record<string, unknown> = { profiles, defaultProfile };
    for (const key of TASK_PROFILE_KEYS) {
      state[TASK_FIELD_MAP[key]] = taskProfiles[key] ?? null;
    }
    set(state as Partial<ProfilesState>);

    service.applyCurrentChatProvider(
      null,
      taskProfiles[CHAT_PROFILE_KEY] ?? null,
      defaultProfile
    );
  },

  addProfile: async (data) => {
    const result = await service.addProfile(data, get().profiles);

    if (result.success) {
      const isFirst = get().profiles.length === 0;
      set((state) => ({
        profiles: [result.profile, ...state.profiles],
      }));
      if (isFirst) get().setDefaultProfile(result.profile);
      return true;
    }
    return result.error;
  },

  editProfile: async (profile) => {
    const result = await service.editProfile(profile, get().profiles);

    if (!result.success) return result.error;

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

      service.applyCurrentChatProvider(
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
  },

  deleteProfile: async (id) => {
    await service.deleteProfile(id);
    set((state) => {
      const profiles = state.profiles.filter((p) => p.id !== id);

      const chatProfile = service.clearTaskProfileIfMatch(
        state.chatProfile,
        id,
        CHAT_PROFILE_KEY
      );
      const summarizationProfile = service.clearTaskProfileIfMatch(
        state.summarizationProfile,
        id,
        SUMMARIZATION_PROFILE_KEY
      );
      const translationProfile = service.clearTaskProfileIfMatch(
        state.translationProfile,
        id,
        TRANSLATION_PROFILE_KEY
      );
      const textAnalysisProfile = service.clearTaskProfileIfMatch(
        state.textAnalysisProfile,
        id,
        TEXT_ANALYSIS_PROFILE_KEY
      );
      const imageGenerationProfile = service.clearTaskProfileIfMatch(
        state.imageGenerationProfile,
        id,
        IMAGE_GENERATION_PROFILE_KEY
      );
      const ocrProfile = service.clearTaskProfileIfMatch(
        state.ocrProfile,
        id,
        OCR_PROFILE_KEY
      );
      const visionProfile = service.clearTaskProfileIfMatch(
        state.visionProfile,
        id,
        VISION_PROFILE_KEY
      );
      const sessionChatProfile =
        state.sessionChatProfile?.id === id ? null : state.sessionChatProfile;

      const defaultProfile = service.reassignDefault(
        profiles,
        id,
        state.defaultProfile,
        DEFAULT_PROFILE_KEY
      );

      service.applyCurrentChatProvider(
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
  },

  getProfileById: (id) => get().profiles.find((p) => p.id === id) ?? null,
  getProfileByName: (name, ignoreCase) =>
    get().profiles.find((p) =>
      ignoreCase ? p.name.toLowerCase() === name.toLowerCase() : p.name === name
    ) ?? null,

  setDefaultProfile: (profile) => {
    service.setTaskProfile(DEFAULT_PROFILE_KEY, profile);
    set((state) => {
      service.applyCurrentChatProvider(
        state.sessionChatProfile,
        state.chatProfile,
        profile
      );
      return { defaultProfile: profile };
    });
  },

  setChatProfile: (profile) => {
    service.setTaskProfile(CHAT_PROFILE_KEY, profile);
    set((state) => {
      service.applyCurrentChatProvider(
        state.sessionChatProfile,
        profile,
        state.defaultProfile
      );
      return { chatProfile: profile };
    });
  },

  setSummarizationProfile: (profile) => {
    service.setTaskProfile(SUMMARIZATION_PROFILE_KEY, profile);
    set({ summarizationProfile: profile });
  },

  setTranslationProfile: (profile) => {
    service.setTaskProfile(TRANSLATION_PROFILE_KEY, profile);
    set({ translationProfile: profile });
  },

  setTextAnalysisProfile: (profile) => {
    service.setTaskProfile(TEXT_ANALYSIS_PROFILE_KEY, profile);
    set({ textAnalysisProfile: profile });
  },

  setImageGenerationProfile: (profile) => {
    service.setTaskProfile(IMAGE_GENERATION_PROFILE_KEY, profile);
    set({ imageGenerationProfile: profile });
  },

  setOcrProfile: (profile) => {
    service.setTaskProfile(OCR_PROFILE_KEY, profile);
    set({ ocrProfile: profile });
  },

  setVisionProfile: (profile) => {
    service.setTaskProfile(VISION_PROFILE_KEY, profile);
    set({ visionProfile: profile });
  },

  setSessionChatProfile: (profile) => {
    set((state) => {
      service.applyCurrentChatProvider(
        profile,
        state.chatProfile,
        state.defaultProfile
      );
      return { sessionChatProfile: profile };
    });
  },

  extendedThinking: (() => {
    try {
      const saved = getSettingsInstance().get(DEEP_MODE_KEY);
      if (!saved) return false;
      return JSON.parse(saved);
    } catch {
      return false;
    }
  })(),

  toggleExtendedThinking: () => {
    set((state) => {
      const next = !state.extendedThinking;
      getSettingsInstance().set(DEEP_MODE_KEY, JSON.stringify(next));
      return { extendedThinking: next };
    });
  },
}));

export const selectCurrentChatProfile = (s: ProfilesState) =>
  s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

export default useProfilesStore;
