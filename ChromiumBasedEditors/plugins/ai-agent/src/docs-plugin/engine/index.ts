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

function trimResult(data: string, isSpaces: boolean): string {
  const trimC = ['"', "'", "\n", "\r", "`"];
  if (isSpaces) trimC.push(" ");

  let start = 0;
  while (start < data.length && trimC.includes(data[start])) start++;

  let end = data.length - 1;
  while (end > 0 && trimC.includes(data[end])) end--;

  if (end > start) return data.substring(start, end + 1);
  return data;
}

function cleanTranslationResult(raw: string, source: string): string {
  let cleaned = trimResult(raw, true);
  const preserveC = ['"', "'", "\n", "\r", " "];
  if (source.length > 0 && preserveC.includes(source[0])) {
    cleaned = source[0] + cleaned;
  }
  if (source.length > 1 && preserveC.includes(source[source.length - 1])) {
    cleaned = cleaned + source[source.length - 1];
  }
  return cleaned;
}

export async function translate(
  text: string,
  targetLang: string
): Promise<string> {
  const provider = getActionProvider(ActionType.Translation);
  if (!provider) throw new Error("No provider assigned to Translation");
  const raw = await provider.sendMessageSync(
    [{ role: "user", content: getTranslationPrompt(targetLang, text) }],
    ""
  );
  return cleanTranslationResult(raw, text);
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
