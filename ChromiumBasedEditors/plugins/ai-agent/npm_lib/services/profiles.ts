import type { AppContext } from "../app-context";
import type { TErrorData } from "../providers/base";
import type { Profile } from "../types";

const NAME_EXISTS_ERROR = {
  field: "name" as const,
  message: "Duplicate name",
};

export type TaskProfileKeys = {
  defaultKey: string;
  taskKeys: string[];
};

export type ProfilesInitResult = {
  profiles: Profile[];
  defaultProfile: Profile | null;
  taskProfiles: Record<string, Profile | null>;
};

export class ProfilesService {
  constructor(private ctx: AppContext) {}

  loadProfileById(profiles: Profile[], key: string): Profile | null {
    const settings = this.ctx.settings;
    const id = settings.get(key);
    if (!id) return null;
    const found = profiles.find((p) => p.id === id);
    if (!found) {
      settings.remove(key);
      return null;
    }
    return found;
  }

  applyCurrentChatProvider(
    sessionChatProfile: Profile | null,
    chatProfile: Profile | null,
    defaultProfile: Profile | null
  ): void {
    const active = sessionChatProfile ?? chatProfile ?? defaultProfile;
    if (active) {
      this.ctx.provider.setCurrentProvider({
        type: active.providerType,
        name: active.name,
        baseUrl: active.baseUrl,
        key: active.key,
      });
      this.ctx.provider.setCurrentProviderModel(
        active.modelId,
        active.reasoning
      );
    } else {
      this.ctx.provider.setCurrentProvider(undefined);
    }
  }

  async init(keys: TaskProfileKeys): Promise<ProfilesInitResult> {
    const storage = this.ctx.storage;
    const settings = this.ctx.settings;
    const profiles = (await storage.profiles.getAll()).reverse();

    const defaultProfile =
      this.loadProfileById(profiles, keys.defaultKey) ?? profiles[0] ?? null;

    if (defaultProfile) {
      settings.set(keys.defaultKey, defaultProfile.id);
    }

    const taskProfiles: Record<string, Profile | null> = {};
    for (const key of keys.taskKeys) {
      taskProfiles[key] = this.loadProfileById(profiles, key);
    }

    return { profiles, defaultProfile, taskProfiles };
  }

  async addProfile(
    data: Omit<Profile, "id">,
    existingProfiles: Profile[]
  ): Promise<
    { success: true; profile: Profile } | { success: false; error: TErrorData }
  > {
    const nameExists = existingProfiles.some(
      (p) => p.name.toLowerCase() === data.name.toLowerCase()
    );
    if (nameExists) {
      return { success: false, error: NAME_EXISTS_ERROR };
    }

    const checkResult = await this.ctx.provider.checkNewProvider(
      data.providerType,
      { url: data.baseUrl, apiKey: data.key }
    );

    if (checkResult === true) {
      const storage = this.ctx.storage;
      const newProfile: Profile = { ...data, id: crypto.randomUUID() };
      await storage.profiles.create(newProfile);
      return { success: true, profile: newProfile };
    }

    if (checkResult && typeof checkResult === "object") {
      return { success: false, error: checkResult };
    }

    return {
      success: false,
      error: { field: "key", message: "Provider validation failed" },
    };
  }

  async editProfile(
    profile: Profile,
    existingProfiles: Profile[]
  ): Promise<{ success: true } | { success: false; error: TErrorData }> {
    const nameExists = existingProfiles.some(
      (p) =>
        p.name.toLowerCase() === profile.name.toLowerCase() &&
        p.id !== profile.id
    );
    if (nameExists) {
      return { success: false, error: NAME_EXISTS_ERROR };
    }

    const checkResult = await this.ctx.provider.checkNewProvider(
      profile.providerType,
      { url: profile.baseUrl, apiKey: profile.key }
    );

    if (checkResult === true) {
      const storage = this.ctx.storage;
      await storage.profiles.update(profile);
      return { success: true };
    }

    if (checkResult && typeof checkResult === "object") {
      return { success: false, error: checkResult };
    }

    return {
      success: false,
      error: { field: "key", message: "Provider validation failed" },
    };
  }

  async deleteProfile(id: string): Promise<void> {
    const storage = this.ctx.storage;
    await storage.profiles.delete(id);
  }

  clearTaskProfileIfMatch(
    profile: Profile | null,
    id: string,
    key: string
  ): Profile | null {
    if (profile?.id === id) {
      this.ctx.settings.remove(key);
      return null;
    }
    return profile;
  }

  reassignDefault(
    profiles: Profile[],
    deletedId: string,
    currentDefault: Profile | null,
    defaultKey: string
  ): Profile | null {
    const settings = this.ctx.settings;
    if (currentDefault?.id !== deletedId) return currentDefault;

    const nextDefault = profiles[0] ?? null;
    if (nextDefault) {
      settings.set(defaultKey, nextDefault.id);
    } else {
      settings.remove(defaultKey);
    }
    return nextDefault;
  }

  setTaskProfile(key: string, profile: Profile | null): void {
    const settings = this.ctx.settings;
    if (profile) {
      settings.set(key, profile.id);
    } else {
      settings.remove(key);
    }
  }

  selectCurrentChatProfile(
    sessionChatProfile: Profile | null,
    chatProfile: Profile | null,
    defaultProfile: Profile | null
  ): Profile | null {
    return sessionChatProfile ?? chatProfile ?? defaultProfile;
  }
}
