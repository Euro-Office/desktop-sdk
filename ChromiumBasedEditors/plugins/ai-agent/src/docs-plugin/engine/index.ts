import {
  type AppContext,
  CallbacksManager,
  ChatEventBus,
  createStores,
  initActionHolders,
  MiddlewareRunner,
  Provider,
  Servers,
  type Stores,
} from "@onlyoffice/ai-chat";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { LocalStorageSettings } from "@/shared/settings/localStorage";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { crossPluginBus } from "@/shared/sync/crossPluginBus";
import { OnlyOfficePlatform } from "../platform";

let stores: Stores | null = null;

function requireLibrary(): {
  ai: AIGlobal;
  prompts: AscPromptsStatic;
  library: AscLibraryInstance;
} {
  const ai = window.AI;
  const prompts = window.Asc.Prompts;
  const library = window.Asc.Library;
  if (!ai || !prompts || !library) throw new Error("Library not installed");
  return { ai, prompts, library };
}

export async function summarize(
  text: string,
  targetLang?: string
): Promise<string> {
  const { ai, prompts } = requireLibrary();
  const req = ai.Request.create(ai.ActionType.Summarization);
  const prompt = prompts.getSummarizationPrompt(text, targetLang);
  return req.chatRequest(prompt);
}

export async function translate(
  text: string,
  targetLang: string
): Promise<string> {
  const { ai, prompts, library } = requireLibrary();
  const req = ai.Request.create(ai.ActionType.Translation);
  const prompt = prompts.getTranslatePrompt(text, targetLang);
  const raw = await req.chatRequest(prompt);
  return library.getTranslateResult(raw, text);
}

export async function initAiAgentEngine(): Promise<void> {
  const storage = new IndexedDBStorage();
  const settings = new LocalStorageSettings();
  const platform = new OnlyOfficePlatform();
  const eventBus = new ChatEventBus();
  const callbacksManager = new CallbacksManager();

  const ctx: AppContext = {
    settings,
    storage,
    platform,
    provider: new Provider(),
    servers: new Servers(settings, platform, eventBus, callbacksManager),
    eventBus,
    callbacksManager,
    middlewareRunner: new MiddlewareRunner([]),
  };

  await storage.init();

  initActionHolders();
  stores = createStores({ keys: DEFAULT_STORE_KEYS, ctx });

  await stores.useProfilesStore.getState().init();

  crossPluginBus.subscribe("modelAssignmentUpdated", () => {
    stores?.useProfilesStore.getState().reloadModelAssignment();
  });
  crossPluginBus.subscribe("profilesUpdated", () => {
    stores?.useProfilesStore.getState().reloadProfiles();
  });
}
