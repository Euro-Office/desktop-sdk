import type {
  ActionType,
  AssignmentsStorage,
  AttachmentsStorage,
  McpServersStorage,
  MessagesStorage,
  PreferencesStorage,
  Profile,
  ProfilesStorage,
  PromptFoldersStorage,
  PromptsStorage,
  ProviderType,
  StorageAdapter,
  ThreadsStorage,
  ToolPrefsStorage,
  WebSearchStorage,
} from "@onlyoffice/ai-chat";
import type {
  ServerManagedProfile,
  ServerProfileSpec,
  ServerStateSnapshot,
} from "./types.ts";

function toProfile(spec: ServerProfileSpec): ServerManagedProfile {
  return {
    id: spec.id,
    name: spec.name,
    providerType: spec.providerType as ProviderType,
    baseUrl: spec.baseUrl,
    key: spec.key,
    modelId: spec.modelId,
    reasoning: spec.reasoning,
    capabilities: spec.capabilities,
    createdAt: 0,
    isServerManaged: true,
  };
}

class ServerProfilesProxy implements ProfilesStorage {
  private inner: ProfilesStorage;
  private serverProfiles: Map<string, ServerManagedProfile>;

  constructor(
    inner: ProfilesStorage,
    serverProfiles: Map<string, ServerManagedProfile>
  ) {
    this.inner = inner;
    this.serverProfiles = serverProfiles;
  }

  async create(profile: Omit<Profile, "id" | "createdAt">): Promise<Profile> {
    return this.inner.create(profile);
  }

  async createMany(
    profiles: Omit<Profile, "id" | "createdAt">[]
  ): Promise<Profile[]> {
    return this.inner.createMany(profiles);
  }

  async readAll(): Promise<Profile[]> {
    const local = await this.inner.readAll();
    const filtered = local.filter((p) => !this.serverProfiles.has(p.id));
    return [...this.serverProfiles.values(), ...filtered];
  }

  async readById(id: string): Promise<Profile | undefined> {
    const server = this.serverProfiles.get(id);
    if (server) return server;
    return this.inner.readById(id);
  }

  async update(profile: Profile): Promise<void> {
    if (this.serverProfiles.has(profile.id)) {
      console.warn(
        `[RuntimeOverlayStorage] profile "${profile.id}" is server-managed — update ignored`
      );
      return;
    }
    return this.inner.update(profile);
  }

  async delete(id: string): Promise<void> {
    if (this.serverProfiles.has(id)) {
      console.warn(
        `[RuntimeOverlayStorage] profile "${id}" is server-managed — delete ignored`
      );
      return;
    }
    return this.inner.delete(id);
  }
}

type AssignmentsState = {
  map: Map<ActionType, string>;
  override: boolean;
};

class ServerAssignmentsProxy implements AssignmentsStorage {
  private inner: AssignmentsStorage;
  private state: AssignmentsState;

  constructor(inner: AssignmentsStorage, state: AssignmentsState) {
    this.inner = inner;
    this.state = state;
  }

  private hasServerOverride(actionType: ActionType): boolean {
    return this.state.override && this.state.map.has(actionType);
  }

  async create(
    actionType: ActionType,
    profileId: string,
    entityId?: string
  ): Promise<void> {
    if (this.hasServerOverride(actionType)) {
      console.warn(
        `[RuntimeOverlayStorage] assignment "${actionType}" is server-managed — create ignored`
      );
      return;
    }
    return this.inner.create(actionType, profileId, entityId);
  }

  async readByType(
    actionType: ActionType,
    entityId?: string
  ): Promise<string | null> {
    if (this.hasServerOverride(actionType)) {
      return this.state.map.get(actionType) ?? null;
    }
    const local = await this.inner.readByType(actionType, entityId);
    if (local) return local;
    return this.state.map.get(actionType) ?? null;
  }

  async readAll(): Promise<Partial<Record<ActionType, string>>> {
    const local = await this.inner.readAll();
    const merged: Partial<Record<ActionType, string>> = { ...local };
    for (const [type, profileId] of this.state.map.entries()) {
      if (this.state.override || merged[type] === undefined) {
        merged[type] = profileId;
      }
    }
    return merged;
  }

  async update(
    actionType: ActionType,
    profileId: string,
    entityId?: string
  ): Promise<void> {
    if (this.hasServerOverride(actionType)) {
      console.warn(
        `[RuntimeOverlayStorage] assignment "${actionType}" is server-managed — update ignored`
      );
      return;
    }
    return this.inner.update(actionType, profileId, entityId);
  }

  async upsertMany(
    assignments: Partial<Record<ActionType, string>>,
    entityId?: string
  ): Promise<void> {
    const filtered: Partial<Record<ActionType, string>> = {};
    for (const [type, value] of Object.entries(assignments)) {
      const actionType = type as ActionType;
      if (value === undefined) continue;
      if (this.hasServerOverride(actionType)) {
        console.warn(
          `[RuntimeOverlayStorage] assignment "${actionType}" is server-managed — upsert entry ignored`
        );
        continue;
      }
      filtered[actionType] = value;
    }
    return this.inner.upsertMany(filtered, entityId);
  }

  async delete(actionType: ActionType, entityId?: string): Promise<void> {
    if (this.hasServerOverride(actionType)) {
      console.warn(
        `[RuntimeOverlayStorage] assignment "${actionType}" is server-managed — delete ignored`
      );
      return;
    }
    return this.inner.delete(actionType, entityId);
  }

  async deleteMany(
    actionTypes: ActionType[],
    entityId?: string
  ): Promise<void> {
    const filtered = actionTypes.filter((t) => !this.hasServerOverride(t));
    if (filtered.length === 0) return;
    return this.inner.deleteMany(filtered, entityId);
  }
}

export class RuntimeOverlayStorage implements StorageAdapter {
  readonly threads: ThreadsStorage;
  readonly messages: MessagesStorage;
  readonly profiles: ProfilesStorage;
  readonly prompts: PromptsStorage;
  readonly promptFolders: PromptFoldersStorage;
  readonly assignments: AssignmentsStorage;
  readonly preferences: PreferencesStorage;
  readonly mcpServers: McpServersStorage;
  readonly toolPrefs: ToolPrefsStorage;
  readonly webSearch: WebSearchStorage;
  readonly attachments: AttachmentsStorage;

  private serverProfiles = new Map<string, ServerManagedProfile>();
  private assignmentsState: AssignmentsState = {
    map: new Map(),
    override: true,
  };

  private inner: StorageAdapter;

  constructor(inner: StorageAdapter) {
    this.inner = inner;
    this.threads = inner.threads;
    this.messages = inner.messages;
    this.prompts = inner.prompts;
    this.promptFolders = inner.promptFolders;
    this.preferences = inner.preferences;
    this.mcpServers = inner.mcpServers;
    this.toolPrefs = inner.toolPrefs;
    this.webSearch = inner.webSearch;
    this.attachments = inner.attachments;

    this.profiles = new ServerProfilesProxy(
      inner.profiles,
      this.serverProfiles
    );
    this.assignments = new ServerAssignmentsProxy(
      inner.assignments,
      this.assignmentsState
    );
  }

  init(): Promise<void> {
    return this.inner.init();
  }

  close(): Promise<void> {
    return this.inner.close();
  }

  applyServerSnapshot(snapshot: ServerStateSnapshot): void {
    this.serverProfiles.clear();
    for (const spec of snapshot.profiles) {
      this.serverProfiles.set(spec.id, toProfile(spec));
    }
    this.assignmentsState.map.clear();
    for (const [type, profileId] of Object.entries(snapshot.assignments)) {
      if (profileId) {
        this.assignmentsState.map.set(type as ActionType, profileId);
      }
    }
    this.assignmentsState.override = snapshot.override;
  }

  clearServerState(): void {
    this.serverProfiles.clear();
    this.assignmentsState.map.clear();
    this.assignmentsState.override = true;
  }

  hasServerProfile(id: string): boolean {
    return this.serverProfiles.has(id);
  }
}
