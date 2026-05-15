// Engine shim: replaces <old>/scripts/engine/engine.js by publishing
// `window.AI` over our @onlyoffice/ai-chat engine + shared IndexedDB.
//
// Loaded as an ES module in <old>/index.html (Phase 2+) and
// <old>/chat.html (Phase 3+). Initialization is async, but a minimal
// `window.AI` surface (with lazy methods that await `AI.ready`) is
// published synchronously so classic scripts loaded right after can
// reference `AI.*` without race.

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
import { prompts as legacyPrompts } from "@/docs-plugin/library/prompts";
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

class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

function fixImagePrefix(base64OrUrl: string): string {
  if (/^(data:|https?:|file:)/.test(base64OrUrl)) {
    return base64OrUrl;
  }

  if (base64OrUrl.trim().startsWith("<svg")) {
    return `data:image/svg+xml;base64,${btoa(base64OrUrl)}`;
  }

  let mimeType = "png"; // по умолчанию
  const firstChar = base64OrUrl.charAt(0);

  if (firstChar === "/") mimeType = "jpeg";
  else if (firstChar === "R") mimeType = "gif";
  else if (firstChar === "U") mimeType = "webp";

  return `data:image/${mimeType};base64,${base64OrUrl}`;
}

// Stream callback contract preserved from the old engine.js:
// - called with (delta, false) for each incremental chunk
// - called with (fullText, true) once at the end
// - if it returns a truthy value, the shim aborts the provider iterator
//   and resolves with the text accumulated so far (cancellation)
type StreamFunc = (
  delta: string,
  isFinal: boolean
) => boolean | undefined | Promise<boolean | undefined>;

type VisionArgs = { prompt?: string; image: string };

type LegacyMessage = { role: string; content: string };

type AIRequest = {
  modelUI: { name: string };
  setErrorHandler(cb: (err: unknown) => void): void;
  chatRequest(
    content: string | LegacyMessage[],
    streamFunc?: StreamFunc
  ): Promise<string>;
  imageGenerationRequest(prompt: string): Promise<string>;
  imageVisionRequest(data: VisionArgs): Promise<string>;
  imageOCRRequest(image: string): Promise<string>;
};

type ActionTypeValue = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

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

function extractText(message: ThreadMessageLike): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let result = "";
  for (const part of content as { type: string; text?: string }[]) {
    if (part && part.type === "text" && typeof part.text === "string") {
      result += part.text;
    }
  }
  return result;
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

function createRequest(
  actionType: ActionTypeValue,
  customProfileId?: string | null
): AIRequest {
  let errorHandler: ((err: unknown) => void) | null = null;

  function handleError(e: unknown): never {
    if (errorHandler) errorHandler(e);
    throw e;
  }

  return {
    // Legacy callers (generate.js streamPromptResultToDocument) read
    // requestEngine.modelUI.name to label the editor Block action. The
    // shim resolves the model only at call time, so expose a generic
    // label up-front — the editor action shows "AI (AI)" instead of the
    // model name.
    modelUI: { name: "AI" },
    setErrorHandler(cb) {
      errorHandler = cb;
    },
    async chatRequest(content, streamFunc) {
      try {
        const { storage } = await ensureReady();
        const { profile, provider } = await resolveProvider(
          storage,
          actionType,
          customProfileId
        );

        // generate.js passes an `agentHistory` array of {role, content}.
        // Map it to ThreadMessageLike[]. String input → single user msg.
        const messages: ThreadMessageLike[] =
          typeof content === "string"
            ? [{ role: "user", content }]
            : content.map((m) => ({
                role: m.role as ThreadMessageLike["role"],
                content: m.content,
              }));

        // No streamFunc → one-shot sync call.
        if (typeof streamFunc !== "function") {
          return provider.sendMessageSync({
            messages,
            model: profile.modelId,
            systemPrompt: "",
          });
        }

        // Streaming path: iterate the provider's async generator, emit
        // deltas, support cancellation via truthy return from streamFunc.
        let accumulated = "";
        let cancelled = false;
        const iter = provider.sendMessage({
          messages,
          model: profile.modelId,
          systemPrompt: "",
        });
        try {
          for await (const chunk of iter) {
            if ("isEnd" in chunk && chunk.isEnd) {
              const finalText = extractText(chunk.responseMessage);
              const tail = finalText.slice(accumulated.length);
              accumulated = finalText;
              const stop = await streamFunc(tail, true);
              if (stop === true) cancelled = true;
              break;
            }
            const text = extractText(chunk as ThreadMessageLike);
            if (text.length > accumulated.length) {
              const delta = text.slice(accumulated.length);
              accumulated = text;
              const stop = await streamFunc(delta, false);
              if (stop === true) {
                cancelled = true;
                break;
              }
            }
          }
        } finally {
          if (cancelled && typeof iter.return === "function") {
            // Best-effort: signal the generator to clean up. Providers
            // that ignore it just keep streaming in background, but the
            // promise resolves with the accumulated text.
            try {
              await iter.return(undefined);
            } catch {
              /* ignore */
            }
          }
        }
        return accumulated;
      } catch (e) {
        return handleError(e);
      }
    },
    async imageGenerationRequest(prompt) {
      try {
        const { storage } = await ensureReady();
        const { profile, provider } = await resolveProvider(
          storage,
          ACTION_TYPE.ImageGeneration,
          customProfileId
        );
        if (!provider.imageGeneration) {
          throw new Error(
            `Provider ${profile.providerType} does not support image generation`
          );
        }
        // Returns a URL or base64 data URL — same shape as old engine.js
        // which downstream tools feed straight into Asc.Library.AddOleObject
        // / AddGeneratedImage.

        const rawImage = await provider.imageGeneration({
          model: profile.modelId,
          prompt: prompt,
        });
        return fixImagePrefix(rawImage);
      } catch (e) {
        return handleError(e);
      }
    },
    async imageVisionRequest(data) {
      try {
        const { storage } = await ensureReady();
        const { profile, provider } = await resolveProvider(
          storage,
          ACTION_TYPE.Vision,
          customProfileId
        );
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: data.prompt ?? legacyPrompts.getImageDescription(),
              },
              { type: "image", image: data.image },
            ],
          },
        ];
        return await provider.sendMessageSync({
          messages,
          model: profile.modelId,
          systemPrompt: "",
        });
      } catch (e) {
        return handleError(e);
      }
    },
    async imageOCRRequest(image) {
      try {
        const { storage } = await ensureReady();
        const { profile, provider } = await resolveProvider(
          storage,
          ACTION_TYPE.OCR,
          customProfileId
        );
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "text", text: legacyPrompts.getImagePromptOCR() },
              { type: "image", image },
            ],
          },
        ];
        return await provider.sendMessageSync({
          messages,
          model: profile.modelId,
          systemPrompt: "",
        });
      } catch (e) {
        return handleError(e);
      }
    },
  };
}

// Publish synchronously so classic scripts loaded after this module can
// reference window.AI without waiting on async init.
const AI = {
  ActionType: ACTION_TYPE,
  Request: {
    create(action: string, profileId?: string | null): AIRequest {
      return createRequest(action as ActionTypeValue, profileId);
    },
  },
  ToolError,
  // Defensive stubs — real values set during async init.
  serverSettings: {} as Record<string, unknown>,
  externalModelPrefix: "",
  DEFAULT_SERVER_SETTINGS: null as unknown,
  helperTranslations: {} as HelperTranslations,
  loadHelperTranslations: async (): Promise<void> => {
    AI.helperTranslations = await loadHelperTranslations();
  },
  ready,
};

// Additive merge instead of hard replace: during Phase 1 shadow injection
// the old engine.js publishes its own window.AI first; we overlay our keys
// (Request, ActionType, ToolError, ...) without dropping the legacy surface
// (AI.loadInternalProviders, AI.Storage, AI.Models, AI.CapabilitiesUI, ...)
// that code.js / register.js still call until Phase 2 cleanup. After old
// engine is removed, `existing` is empty and merge degenerates to replace.
{
  const w = window as unknown as { AI?: Record<string, unknown> };
  w.AI = Object.assign(w.AI ?? {}, AI);
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

  // Build AppContext to satisfy the type even though we don't expose
  // stores from the shim. Engines that need it (e.g. tools) can pull
  // their own deps via storage directly.
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

  // Cross-plugin sync: profile/assignment changes from other windows
  // (e.g. new ai-agent) become visible without reload.
  crossPluginBus.subscribe("profilesUpdated", () => {
    // Reads are always fresh from storage — no in-shim cache to flush.
  });
  crossPluginBus.subscribe("modelAssignmentUpdated", () => {
    // Same.
  });

  await AI.loadHelperTranslations();

  readyResolve();
}

init().catch((e) => {
  console.error("[engine-shim] init failed:", e);
  // Resolve anyway so awaiting callers don't hang; they'll hit the
  // "AIEngine init failed" error from ensureReady().
  readyResolve();
});
