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

// LS key marking actions that the user has explicitly written through the UI.
// While an action is in this set, the server-overlay does NOT apply to it on
// read or on subsequent applyServerSnapshot calls (replay). The set is reset
// by the host plugin only when a real ai_onCustomInit arrives from the editor
// (= new managed policy from above).
const USER_OVERRIDDEN_ACTIONS_KEY = "onlyoffice_ai_user_overridden_actions";

function readUserOverriddenActions(): Set<ActionType> {
  try {
    const raw = localStorage.getItem(USER_OVERRIDDEN_ACTIONS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr as ActionType[]);
  } catch {
    return new Set();
  }
}

function writeUserOverriddenActions(set: Set<ActionType>): void {
  try {
    if (set.size === 0) {
      localStorage.removeItem(USER_OVERRIDDEN_ACTIONS_KEY);
    } else {
      localStorage.setItem(
        USER_OVERRIDDEN_ACTIONS_KEY,
        JSON.stringify([...set])
      );
    }
  } catch {
    // localStorage may be unavailable in private/locked-down contexts; soft-fail.
  }
}

function markUserOverriddenAction(actionType: ActionType): void {
  const s = readUserOverriddenActions();
  if (s.has(actionType)) return;
  s.add(actionType);
  writeUserOverriddenActions(s);
}

export function clearUserOverriddenActions(): void {
  writeUserOverriddenActions(new Set());
}

class ServerAssignmentsProxy implements AssignmentsStorage {
  private inner: AssignmentsStorage;
  private state: AssignmentsState;

  constructor(inner: AssignmentsStorage, state: AssignmentsState) {
    this.inner = inner;
    this.state = state;
  }

  // Any explicit write by the user/UI lifts the server-overlay for that
  // action AND persists a "user-touched" mark in LS so subsequent replays
  // also leave it alone (soft-override semantics — matches the legacy
  // ai_onCustomInit behavior).
  private releaseOverlay(actionType: ActionType): void {
    this.state.map.delete(actionType);
    markUserOverriddenAction(actionType);
  }

  async create(
    actionType: ActionType,
    profileId: string,
    entityId?: string
  ): Promise<void> {
    this.releaseOverlay(actionType);
    return this.inner.create(actionType, profileId, entityId);
  }

  async readByType(
    actionType: ActionType,
    entityId?: string
  ): Promise<string | null> {
    const userOverridden = readUserOverriddenActions();
    const hasOverlay = this.state.map.has(actionType);
    const overlayActive = hasOverlay && !userOverridden.has(actionType);

    if (this.state.override && overlayActive) {
      return this.state.map.get(actionType) ?? null;
    }
    const local = await this.inner.readByType(actionType, entityId);
    if (local) return local;
    if (overlayActive) return this.state.map.get(actionType) ?? null;
    return null;
  }

  async readAll(): Promise<Partial<Record<ActionType, string>>> {
    const local = await this.inner.readAll();
    const userOverridden = readUserOverriddenActions();
    const merged: Partial<Record<ActionType, string>> = { ...local };
    for (const [type, profileId] of this.state.map.entries()) {
      if (userOverridden.has(type)) continue;
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
    this.releaseOverlay(actionType);
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
      this.releaseOverlay(actionType);
      filtered[actionType] = value;
    }
    return this.inner.upsertMany(filtered, entityId);
  }

  async delete(actionType: ActionType, entityId?: string): Promise<void> {
    this.releaseOverlay(actionType);
    return this.inner.delete(actionType, entityId);
  }

  async deleteMany(
    actionTypes: ActionType[],
    entityId?: string
  ): Promise<void> {
    for (const t of actionTypes) this.releaseOverlay(t);
    return this.inner.deleteMany(actionTypes, entityId);
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
