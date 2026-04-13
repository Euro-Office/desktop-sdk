import { create, type StoreApi, type UseBoundStore } from "zustand";
import { ActionType, inferCapabilities } from "../capabilities";
import type { StoreKeys } from "../config";
import type { TErrorData } from "../providers/base";
import {
  applyProfileToAction,
  initActionHolders,
} from "../services/action-holders";
import type { ProfilesService } from "../services/profiles";
import { getSettingsInstance } from "../settings/settings-holder";
import type { Profile } from "../types";

export interface ProfilesStoreState {
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

export function createProfilesStore(deps: {
  keys: StoreKeys;
  profilesService: ProfilesService;
}): UseBoundStore<StoreApi<ProfilesStoreState>> {
  const { keys, profilesService } = deps;

  const TASK_PROFILE_KEYS = [
    keys.chatProfile,
    keys.summarizationProfile,
    keys.translationProfile,
    keys.textAnalysisProfile,
    keys.imageGenerationProfile,
    keys.ocrProfile,
    keys.visionProfile,
  ] as const;

  const TASK_FIELD_MAP: Record<string, keyof ProfilesStoreState> = {
    [keys.chatProfile]: "chatProfile",
    [keys.summarizationProfile]: "summarizationProfile",
    [keys.translationProfile]: "translationProfile",
    [keys.textAnalysisProfile]: "textAnalysisProfile",
    [keys.imageGenerationProfile]: "imageGenerationProfile",
    [keys.ocrProfile]: "ocrProfile",
    [keys.visionProfile]: "visionProfile",
  };

  const FIELD_TO_ACTION: Record<string, ActionType> = {
    chatProfile: ActionType.Chat,
    summarizationProfile: ActionType.Summarization,
    translationProfile: ActionType.Translation,
    textAnalysisProfile: ActionType.TextAnalyze,
    imageGenerationProfile: ActionType.ImageGeneration,
    ocrProfile: ActionType.OCR,
    visionProfile: ActionType.Vision,
  };

  const applyAllActionHolders = (state: {
    defaultProfile: Profile | null;
    chatProfile: Profile | null;
    summarizationProfile: Profile | null;
    translationProfile: Profile | null;
    textAnalysisProfile: Profile | null;
    imageGenerationProfile: Profile | null;
    ocrProfile: Profile | null;
    visionProfile: Profile | null;
  }) => {
    for (const [field, actionType] of Object.entries(FIELD_TO_ACTION)) {
      applyProfileToAction(
        actionType,
        state[field as keyof typeof state],
        state.defaultProfile
      );
    }
  };

  const makeTaskSetter =
    (
      settingsKey: string,
      stateField: keyof ProfilesStoreState,
      actionType: ActionType
    ) =>
    (profile: Profile | null) => {
      profilesService.setTaskProfile(settingsKey, profile);
      set({ [stateField]: profile } as Partial<ProfilesStoreState>);
      const state = store.getState();
      applyProfileToAction(actionType, profile, state.defaultProfile);
    };

  let set: (
    partial:
      | Partial<ProfilesStoreState>
      | ((state: ProfilesStoreState) => Partial<ProfilesStoreState>)
  ) => void;

  const store = create<ProfilesStoreState>()((setState, get) => {
    set = setState;

    return {
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

      extendedThinking: (() => {
        try {
          const saved = getSettingsInstance().get(keys.deepMode);
          if (!saved) return false;
          return JSON.parse(saved);
        } catch {
          return false;
        }
      })(),

      init: async () => {
        const { profiles, defaultProfile, taskProfiles } =
          await profilesService.init({
            defaultKey: keys.defaultProfile,
            taskKeys: [...TASK_PROFILE_KEYS],
          });

        // Backfill capabilities for profiles created before this feature
        for (const p of profiles) {
          if (p.capabilities == null) {
            p.capabilities = inferCapabilities(p.providerType, p.modelId);
          }
        }

        const state: Record<string, unknown> = { profiles, defaultProfile };
        for (const key of TASK_PROFILE_KEYS) {
          state[TASK_FIELD_MAP[key]] = taskProfiles[key] ?? null;
        }
        set(state as Partial<ProfilesStoreState>);

        profilesService.applyCurrentChatProvider(
          null,
          taskProfiles[keys.chatProfile] ?? null,
          defaultProfile
        );

        // Initialize action holders for all task types
        initActionHolders();
        applyAllActionHolders(get());
      },

      addProfile: async (data) => {
        const result = await profilesService.addProfile(data, get().profiles);
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
        const result = await profilesService.editProfile(
          profile,
          get().profiles
        );
        if (!result.success) return result.error;

        set((state) => {
          const profiles = state.profiles.map((p) =>
            p.id === profile.id ? profile : p
          );
          const updateIfMatch = (p: Profile | null) =>
            p?.id === profile.id ? profile : p;

          const defaultProfile = updateIfMatch(state.defaultProfile);
          const chatProfile = updateIfMatch(state.chatProfile);
          const summarizationProfile = updateIfMatch(
            state.summarizationProfile
          );
          const translationProfile = updateIfMatch(state.translationProfile);
          const textAnalysisProfile = updateIfMatch(state.textAnalysisProfile);
          const imageGenerationProfile = updateIfMatch(
            state.imageGenerationProfile
          );
          const ocrProfile = updateIfMatch(state.ocrProfile);
          const visionProfile = updateIfMatch(state.visionProfile);
          const sessionChatProfile = updateIfMatch(state.sessionChatProfile);

          profilesService.applyCurrentChatProvider(
            sessionChatProfile,
            chatProfile,
            defaultProfile
          );

          const updated = {
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

          applyAllActionHolders(updated);

          return updated;
        });
        return true;
      },

      deleteProfile: async (id) => {
        await profilesService.deleteProfile(id);
        set((state) => {
          const profiles = state.profiles.filter((p) => p.id !== id);

          const cleared: Partial<ProfilesStoreState> = {};
          for (const [key, field] of Object.entries(TASK_FIELD_MAP)) {
            (cleared as Record<string, unknown>)[field] =
              profilesService.clearTaskProfileIfMatch(
                state[field] as Profile | null,
                id,
                key
              );
          }

          const sessionChatProfile =
            state.sessionChatProfile?.id === id
              ? null
              : state.sessionChatProfile;

          const defaultProfile = profilesService.reassignDefault(
            profiles,
            id,
            state.defaultProfile,
            keys.defaultProfile
          );

          profilesService.applyCurrentChatProvider(
            sessionChatProfile,
            cleared.chatProfile ?? null,
            defaultProfile
          );

          const updated = {
            profiles,
            defaultProfile,
            ...cleared,
            sessionChatProfile,
          };

          applyAllActionHolders(updated as typeof state & typeof updated);

          return updated;
        });
      },

      getProfileById: (id) => get().profiles.find((p) => p.id === id) ?? null,

      getProfileByName: (name, ignoreCase) =>
        get().profiles.find((p) =>
          ignoreCase
            ? p.name.toLowerCase() === name.toLowerCase()
            : p.name === name
        ) ?? null,

      setDefaultProfile: (profile) => {
        profilesService.setTaskProfile(keys.defaultProfile, profile);
        set((state) => {
          profilesService.applyCurrentChatProvider(
            state.sessionChatProfile,
            state.chatProfile,
            profile
          );
          return { defaultProfile: profile };
        });
        applyAllActionHolders(store.getState());
      },

      setChatProfile: (profile) => {
        profilesService.setTaskProfile(keys.chatProfile, profile);
        set((state) => {
          profilesService.applyCurrentChatProvider(
            state.sessionChatProfile,
            profile,
            state.defaultProfile
          );
          return { chatProfile: profile };
        });
        applyProfileToAction(
          ActionType.Chat,
          profile,
          store.getState().defaultProfile
        );
      },

      setSummarizationProfile: makeTaskSetter(
        keys.summarizationProfile,
        "summarizationProfile",
        ActionType.Summarization
      ),
      setTranslationProfile: makeTaskSetter(
        keys.translationProfile,
        "translationProfile",
        ActionType.Translation
      ),
      setTextAnalysisProfile: makeTaskSetter(
        keys.textAnalysisProfile,
        "textAnalysisProfile",
        ActionType.TextAnalyze
      ),
      setImageGenerationProfile: makeTaskSetter(
        keys.imageGenerationProfile,
        "imageGenerationProfile",
        ActionType.ImageGeneration
      ),
      setOcrProfile: makeTaskSetter(
        keys.ocrProfile,
        "ocrProfile",
        ActionType.OCR
      ),
      setVisionProfile: makeTaskSetter(
        keys.visionProfile,
        "visionProfile",
        ActionType.Vision
      ),

      setSessionChatProfile: (profile) => {
        set((state) => {
          profilesService.applyCurrentChatProvider(
            profile,
            state.chatProfile,
            state.defaultProfile
          );
          return { sessionChatProfile: profile };
        });
      },

      toggleExtendedThinking: () => {
        set((state) => {
          const next = !state.extendedThinking;
          getSettingsInstance().set(keys.deepMode, JSON.stringify(next));
          return { extendedThinking: next };
        });
      },
    };
  });

  return store;
}
