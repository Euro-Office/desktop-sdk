import {
  ActionType,
  type AppContext,
  CallbacksManager,
  ChatEventBus,
  createStores,
  getActionProvider,
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
import { getSummarizationPrompt, getTranslationPrompt } from "./prompts";

let stores: Stores | null = null;

export async function summarize(
  text: string,
  targetLang?: string
): Promise<string> {
  const provider = getActionProvider("Summarization");
  if (!provider) throw new Error("No provider assigned to Summarization");
  return provider.sendMessageSync(
    [{ role: "user", content: text }],
    getSummarizationPrompt(targetLang)
  );
}

export async function translate(
  text: string,
  targetLang: string
): Promise<string> {
  const provider = getActionProvider(ActionType.Translation);
  if (!provider) throw new Error("No provider assigned to Translation");
  return provider.sendMessageSync(
    [{ role: "user", content: text }],
    getTranslationPrompt(targetLang)
  );
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

  window.aiAgent = { summarize, translate };
}
