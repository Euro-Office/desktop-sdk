import { create } from "zustand";
import {
  createProfile,
  deleteProfile as dbDeleteProfile,
  readAllProfiles,
  updateProfile,
} from "@/database/profiles";
import { CHAT_PROFILE_KEY } from "@/lib/constants";
import type { Model, Profile } from "@/lib/types";
import { provider } from "@/providers";
import type { TErrorData } from "@/providers/base";

const NAME_EXISTS_ERROR = {
  field: "name" as const,
  message: "Duplicate name",
};

interface ProfilesState {
  profiles: Profile[];
  chatProfile: Profile | null;
  init: () => Promise<void>;
  addProfile: (
    data: Omit<Profile, "id">
  ) => Promise<boolean | TErrorData | undefined>;
  editProfile: (profile: Profile) => Promise<boolean | TErrorData | undefined>;
  deleteProfile: (id: string) => Promise<void>;
  setChatProfile: (profile: Profile) => void;
  fetchModelsForProfile: (
    type: Profile["providerType"],
    baseUrl: string,
    key?: string
  ) => Promise<Model[]>;
}

const useProfilesStore = create<ProfilesState>()((set, get) => ({
  profiles: [],
  chatProfile: (() => {
    const saved = localStorage.getItem(CHAT_PROFILE_KEY);

    if (!saved) return null;

    const parsed: Profile = JSON.parse(saved);

    provider.setCurrentProvider({
      type: parsed.providerType,
      name: parsed.name,
      baseUrl: parsed.baseUrl,
      key: parsed.key,
    });
    provider.setCurrentProviderModel(parsed.modelId, parsed.reasoning);

    return parsed;
  })(),

  init: async () => {
    const profiles = await readAllProfiles();
    set({ profiles });
  },

  addProfile: async (data) => {
    const nameExists = get().profiles.some(
      (p) => p.name.toLowerCase() === data.name.toLowerCase()
    );

    if (nameExists) return NAME_EXISTS_ERROR;

    const checkResult = await provider.checkNewProvider(data.providerType, {
      url: data.baseUrl,
      apiKey: data.key,
    });

    if (typeof checkResult === "boolean" && checkResult) {
      const newProfile: Profile = { ...data, id: crypto.randomUUID() };
      await createProfile(newProfile);
      set((state) => ({ profiles: [...state.profiles, newProfile] }));
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

    const checkResult = await provider.checkNewProvider(profile.providerType, {
      url: profile.baseUrl,
      apiKey: profile.key,
    });

    if (typeof checkResult === "boolean" && checkResult) {
      await updateProfile(profile);
      set((state) => {
        const profiles = state.profiles.map((p) =>
          p.id === profile.id ? profile : p
        );

        if (state.chatProfile?.id === profile.id) {
          localStorage.setItem(CHAT_PROFILE_KEY, JSON.stringify(profile));
          provider.setCurrentProvider({
            type: profile.providerType,
            name: profile.name,
            baseUrl: profile.baseUrl,
            key: profile.key,
          });
          provider.setCurrentProviderModel(profile.modelId, profile.reasoning);
          return { profiles, chatProfile: profile };
        }

        return { profiles };
      });
      return true;
    } else {
      return checkResult;
    }
  },

  deleteProfile: async (id) => {
    await dbDeleteProfile(id);
    set((state) => {
      const profiles = state.profiles.filter((p) => p.id !== id);
      if (state.chatProfile?.id === id) {
        localStorage.removeItem(CHAT_PROFILE_KEY);
        provider.setCurrentProvider(undefined);
        return { profiles, chatProfile: null };
      }
      return { profiles };
    });
  },

  setChatProfile: (profile) => {
    localStorage.setItem(CHAT_PROFILE_KEY, JSON.stringify(profile));
    provider.setCurrentProvider({
      type: profile.providerType,
      name: profile.name,
      baseUrl: profile.baseUrl,
      key: profile.key,
    });
    provider.setCurrentProviderModel(profile.modelId, profile.reasoning);
    set({ chatProfile: profile });
  },

  fetchModelsForProfile: async (type, baseUrl, key) => {
    const models = await provider.getProvidersModels([
      { type, name: "", baseUrl, key },
    ]);
    return models.get(type) ?? [];
  },
}));

export default useProfilesStore;
