// Engine shim: replaces <old>/scripts/engine/engine.js by publishing
// `window.AI` over our @onlyoffice/ai-chat engine + shared IndexedDB.
//
// Loaded as an ES module in <old>/index.html (Phase 2+) and
// <old>/chat.html (Phase 3+). Initialization is async, but a minimal
// `window.AI` surface (with lazy methods that await `AI.ready`) is
// published synchronously so classic scripts loaded right after can
// reference `AI.*` without race.

import {
  AIEngine,
  type AppContext,
  AssignmentsEngine,
  CallbacksManager,
  ChatEventBus,
  MiddlewareRunner,
  ProfilesEngine,
  Servers,
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

class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

type StreamFunc = (delta: string, isFinal: boolean) => void | Promise<void>;

type ImageGenArgs = { prompt: string; width?: number; height?: number };
type VisionArgs = { prompt?: string; image: string };

type AIRequest = {
  setErrorHandler(cb: (err: unknown) => void): void;
  chatRequest(
    content: string,
    blockOrStream?: boolean | StreamFunc,
    streamFunc?: StreamFunc
  ): Promise<string>;
  imageGenerationRequest(data: ImageGenArgs, block?: boolean): Promise<string>;
  imageVisionRequest(data: VisionArgs, block?: boolean): Promise<string>;
  imageOCRRequest(image: string, block?: boolean): Promise<string>;
};

type ActionTypeValue = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

let aiEngine: AIEngine | null = null;
let readyResolve: () => void;
const ready: Promise<void> = new Promise((res) => {
  readyResolve = res;
});

async function ensureReady(): Promise<AIEngine> {
  await ready;
  if (!aiEngine) throw new Error("AIEngine init failed");
  return aiEngine;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
    }
  }
  return "";
}

function createRequest(
  actionType: ActionTypeValue,
  _profileId?: string | null
): AIRequest {
  let errorHandler: ((err: unknown) => void) | null = null;

  async function runSend(prompt: string): Promise<string> {
    try {
      const engine = await ensureReady();
      const result = await engine.send({
        actionType,
        userMessage: {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      });
      return extractText(result.content);
    } catch (e) {
      if (errorHandler) errorHandler(e);
      throw e;
    }
  }

  return {
    setErrorHandler(cb) {
      errorHandler = cb;
    },
    async chatRequest(content, blockOrStream, streamFunc) {
      // `block` parameter is dropped (LLM layer doesn't manage editor UI).
      // Old callers pass either (content, block, streamFunc) or
      // (content, streamFunc); detect callback position.
      const stream: StreamFunc | undefined =
        typeof blockOrStream === "function" ? blockOrStream : streamFunc;
      const text = await runSend(content);
      if (stream) {
        try {
          await stream(text, true);
        } catch {
          // streamFunc throwing should not break the promise chain
        }
      }
      return text;
    },
    async imageGenerationRequest(data) {
      // Old engine returned a base64 data URL or remote URL. AIEngine.send
      // packs the image into the response content; extract whatever text /
      // url is there. Refinement to match Asc.Library.AddOleObject /
      // AddGeneratedImage shape will land in Phase 3 when tools are tested.
      const engine = await ensureReady();
      const result = await engine.send({
        actionType: ACTION_TYPE.ImageGeneration,
        userMessage: {
          role: "user",
          content: [{ type: "text", text: data.prompt }],
        },
      });
      return extractText(result.content);
    },
    async imageVisionRequest(data) {
      const engine = await ensureReady();
      const result = await engine.send({
        actionType: ACTION_TYPE.Vision,
        userMessage: {
          role: "user",
          content: [
            { type: "text", text: data.prompt ?? "" },
            { type: "image", image: data.image },
          ] as never,
        },
      });
      return extractText(result.content);
    },
    async imageOCRRequest(image) {
      const engine = await ensureReady();
      const result = await engine.send({
        actionType: ACTION_TYPE.OCR,
        userMessage: {
          role: "user",
          content: [{ type: "image", image }] as never,
        },
      });
      return extractText(result.content);
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
