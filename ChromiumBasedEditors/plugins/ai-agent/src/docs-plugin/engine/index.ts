import {
  AIEngine,
  type AppContext,
  AssignmentsEngine,
  CallbacksManager,
  ChatEventBus,
  createServerAPI,
  createStores,
  DEFAULT_SERVER_API_ROUTES,
  MiddlewareRunner,
  PreferencesEngine,
  ProfilesEngine,
  PromptsEngine,
  Servers,
  type Stores,
  ThreadsEngine,
  ToolsEngine,
  WebSearchEngine,
} from "@onlyoffice/ai-chat";
import { DEFAULT_STORE_KEYS } from "@/shared/config/store-keys";
import { IndexedDBStorage } from "@/shared/storage/indexeddb";
import { crossPluginBus } from "@/shared/sync/crossPluginBus";
import { OnlyOfficePlatform } from "../platform";

let stores: Stores | null = null;
let aiEngine: AIEngine | null = null;

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
  if (!aiEngine) throw new Error("Engine not initialized");
  const { prompts } = requireLibrary();
  const prompt = prompts.getSummarizationPrompt(text, targetLang);
  const result = await aiEngine.send({
    actionType: "Summarization",
    userMessage: {
      role: "user",
      content: [{ type: "text", text: prompt }],
    },
  });
  const content = result.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find(
      (p) => typeof p === "object" && "type" in p && p.type === "text"
    );
    if (textPart && "text" in textPart) return textPart.text as string;
  }
  return "";
}

export async function translate(
  text: string,
  targetLang: string
): Promise<string> {
  if (!aiEngine) throw new Error("Engine not initialized");
  const { prompts, library } = requireLibrary();
  const prompt = prompts.getTranslatePrompt(text, targetLang);
  const result = await aiEngine.send({
    actionType: "Translation",
    userMessage: {
      role: "user",
      content: [{ type: "text", text: prompt }],
    },
  });
  const content = result.content;
  let raw = "";
  if (typeof content === "string") {
    raw = content;
  } else if (Array.isArray(content)) {
    const textPart = content.find(
      (p) => typeof p === "object" && "type" in p && p.type === "text"
    );
    if (textPart && "text" in textPart) raw = textPart.text as string;
  }
  return library.getTranslateResult(raw, text);
}

export async function initAiAgentEngine(): Promise<IndexedDBStorage> {
  const storage = new IndexedDBStorage();
  const platform = new OnlyOfficePlatform();
  const eventBus = new ChatEventBus();
  const callbacksManager = new CallbacksManager();
  const middlewareRunner = new MiddlewareRunner([]);

  const assignments = new AssignmentsEngine({ storage });
  const profiles = new ProfilesEngine({ storage, assignments });
  const threads = new ThreadsEngine({ storage });
  const tools = new ToolsEngine({ storage });
  const prompts = new PromptsEngine({ storage });
  const webSearch = new WebSearchEngine({ storage });
  const preferences = new PreferencesEngine({ storage });
  const ai = new AIEngine({ storage, assignments, threads });

  const servers = new Servers(platform, eventBus);

  const ctx: AppContext = {
    storage,
    platform,
    servers,
    eventBus,
    callbacksManager,
    middlewareRunner,
  };

  const api = createServerAPI(
    { origin: "", baseUrl: "", routes: DEFAULT_SERVER_API_ROUTES },
    {
      ai,
      assignments,
      preferences,
      profiles,
      prompts,
      threads,
      tools,
      webSearch,
    }
  );

  await storage.init();

  stores = createStores({ keys: DEFAULT_STORE_KEYS, ctx, api });
  aiEngine = ai;

  await stores.useProfilesStore.getState().init();

  crossPluginBus.subscribe("modelAssignmentUpdated", () => {
    stores?.useProfilesStore.getState().reloadModelAssignment();
  });
  crossPluginBus.subscribe("profilesUpdated", () => {
    stores?.useProfilesStore.getState().reloadProfiles();
  });

  return storage;
}
