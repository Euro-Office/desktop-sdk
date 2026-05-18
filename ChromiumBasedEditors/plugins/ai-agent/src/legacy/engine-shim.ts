import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  type ActionType,
  AIEngine,
  type AppContext,
  AssignmentsEngine,
  CallbacksManager,
  ChatEventBus,
  createProvider,
  MiddlewareRunner,
  ProfilesEngine,
  Servers,
  type StorageAdapter,
  ThreadsEngine,
} from "@onlyoffice/ai-chat";
import { OnlyOfficePlatform } from "@/docs-plugin/platform/index";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { crossPluginBus } from "@/shared/sync/crossPluginBus";
import {
  type HelperTranslations,
  loadHelperTranslations,
} from "./legacyApi/helperTranslations";

const ACTION_TYPE = {
  Chat: "Chat",
  Code: "Code",
  Translation: "Translation",
  Summarization: "Summarization",
  TextAnalyze: "TextAnalyze",
  ImageGeneration: "ImageGeneration",
  OCR: "OCR",
  Vision: "Vision",
} as const;

type ActionTypeValue = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

let aiEngine: AIEngine | null = null;
let sharedStorage: StorageAdapter | null = null;
let readyResolve: () => void;
const ready: Promise<void> = new Promise((res) => {
  readyResolve = res;
});

async function ensureReady(): Promise<{
  engine: AIEngine;
  storage: StorageAdapter;
}> {
  await ready;
  if (!aiEngine || !sharedStorage) throw new Error("AIEngine init failed");
  return { engine: aiEngine, storage: sharedStorage };
}

async function resolveProvider(
  storage: StorageAdapter,
  actionType: ActionTypeValue,
  customProfileId?: string | null
) {
  let profile = null;
  if (customProfileId) {
    profile = await storage.profiles.readById(customProfileId);
  }
  if (!profile) {
    const idForAction = await storage.assignments.readByType(
      actionType as ActionType
    );
    const id =
      idForAction ??
      (await storage.assignments.readByType("Default" as ActionType));
    if (id) profile = await storage.profiles.readById(id);
  }
  if (!profile) {
    throw new Error(`No model assigned to ${actionType}`);
  }
  const provider = createProvider(profile.providerType, {
    baseUrl: profile.baseUrl,
    apiKey: profile.key,
  });
  if (!provider) {
    throw new Error(`Unknown provider type: ${profile.providerType}`);
  }
  return { profile, provider };
}

const AI = {
  ActionType: ACTION_TYPE,
  ToolError,
  externalModelPrefix: "",
  DEFAULT_SERVER_SETTINGS: null as unknown,
  helperTranslations: {} as HelperTranslations,
  loadHelperTranslations: async (): Promise<void> => {
    AI.helperTranslations = await loadHelperTranslations();
  },
  ready,
};

{
  const w = window as unknown as { AI?: Record<string, unknown> };
  w.AI = Object.assign(w.AI ?? {}, AI);
}

// Publish the pure modern AIEngine primitives
const AIEngineFacade = {
  async getAssignedProfileAsync(actionType: string) {
    const { storage } = await ensureReady();
    const idForAction = await storage.assignments.readByType(
      actionType as ActionType
    );
    const id =
      idForAction ??
      (await storage.assignments.readByType("Default" as ActionType));
    if (id) return await storage.profiles.readById(id);
    return null;
  },

  async sendMessage(actionType: string, messages: ThreadMessageLike[]) {
    const { storage } = await ensureReady();
    const { profile, provider } = await resolveProvider(
      storage,
      actionType as ActionTypeValue
    );
    return provider.sendMessage({
      messages,
      model: profile.modelId,
      systemPrompt: "",
    });
  },

  async sendMessageSync(actionType: string, messages: ThreadMessageLike[]) {
    const { storage } = await ensureReady();
    const { profile, provider } = await resolveProvider(
      storage,
      actionType as ActionTypeValue
    );
    return provider.sendMessageSync({
      messages,
      model: profile.modelId,
      systemPrompt: "",
    });
  },

  async imageGeneration(actionType: string, prompt: string) {
    const { storage } = await ensureReady();
    const { profile, provider } = await resolveProvider(
      storage,
      actionType as ActionTypeValue
    );
    if (!provider.imageGeneration) {
      throw new Error(
        `Provider ${profile.providerType} does not support image generation`
      );
    }
    return provider.imageGeneration({
      model: profile.modelId,
      prompt: prompt,
    });
  },
};

{
  const w = window as unknown as { AIEngine?: typeof AIEngineFacade };
  w.AIEngine = AIEngineFacade;
}

async function init(): Promise<void> {
  const storage = new IndexedDBStorage();
  const platform = new OnlyOfficePlatform();
  const eventBus = new ChatEventBus();
  const callbacksManager = new CallbacksManager();
  const middlewareRunner = new MiddlewareRunner([]);

  const assignments = new AssignmentsEngine({ storage });
  const profiles = new ProfilesEngine({ storage, assignments });
  const threads = new ThreadsEngine({ storage });
  const ai = new AIEngine({ storage, assignments, threads });

  const servers = new Servers(platform, eventBus);

  const _ctx: AppContext = {
    storage,
    platform,
    servers,
    eventBus,
    callbacksManager,
    middlewareRunner,
  };
  void _ctx;
  void profiles;

  await storage.init();
  aiEngine = ai;
  sharedStorage = storage;

  crossPluginBus.subscribe("profilesUpdated", () => {});
  crossPluginBus.subscribe("modelAssignmentUpdated", () => {});

  await AI.loadHelperTranslations();

  readyResolve();
}

init().catch((e) => {
  console.error("[engine-shim] init failed:", e);
  readyResolve();
});
