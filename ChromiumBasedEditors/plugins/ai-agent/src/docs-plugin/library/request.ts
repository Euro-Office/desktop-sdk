import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  type ActionType,
  createProvider,
  type StorageAdapter,
} from "@onlyoffice/ai-chat";

export const AiActionType = {
  Chat: "Chat",
  Translation: "Translation",
  Summarization: "Summarization",
  TextAnalyze: "TextAnalyze",
  ImageGeneration: "ImageGeneration",
  OCR: "OCR",
  Vision: "Vision",
} as const;

export type StreamFunc = (
  delta: string,
  isFinal: boolean
) => void | Promise<void>;

type ContentPart = { type: string; text?: string };

function extractText(message: ThreadMessageLike): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let result = "";
  for (const part of content as ContentPart[]) {
    if (part && part.type === "text" && typeof part.text === "string") {
      result += part.text;
    }
  }
  return result;
}

async function resolveProfile(
  action: ActionType,
  storage: StorageAdapter,
  customProfileId?: string | null
) {
  if (customProfileId) {
    const overridden = await storage.profiles.readById(customProfileId);
    if (overridden) return overridden;
  }
  const profileId = await storage.assignments.readByType(action);
  const id =
    profileId ??
    (await storage.assignments.readByType("Default" as ActionType));
  if (!id) return null;
  return storage.profiles.readById(id);
}

class AiRequest {
  action: ActionType;
  private storage: StorageAdapter;
  private customProfileId: string | null;

  constructor(
    action: ActionType,
    storage: StorageAdapter,
    customProfileId: string | null = null
  ) {
    this.action = action;
    this.storage = storage;
    this.customProfileId = customProfileId;
  }

  async chatRequest(
    content: string,
    _block?: boolean,
    streamFunc?: StreamFunc
  ): Promise<string> {
    const profile = await resolveProfile(
      this.action,
      this.storage,
      this.customProfileId
    );
    if (!profile) throw new Error(`No provider assigned to ${this.action}`);

    const provider = createProvider(profile.providerType, {
      baseUrl: profile.baseUrl,
      apiKey: profile.key,
    });
    if (!provider) throw new Error(`Unknown provider: ${profile.providerType}`);

    const messages: ThreadMessageLike[] = [{ role: "user", content }];
    const syncArgs = { messages, model: profile.modelId, systemPrompt: "" };

    if (typeof streamFunc !== "function") {
      const result = await provider.sendMessageSync(syncArgs);
      return result;
    }

    let accumulated = "";
    try {
      for await (const chunk of provider.sendMessage({
        messages,
        model: profile.modelId,
        systemPrompt: "",
      })) {
        if ("isEnd" in chunk && chunk.isEnd) {
          const finalText = extractText(chunk.responseMessage);
          const tail = finalText.slice(accumulated.length);
          accumulated = finalText;
          await streamFunc(tail, true);
          break;
        }
        const text = extractText(chunk as ThreadMessageLike);
        if (text.length > accumulated.length) {
          const delta = text.slice(accumulated.length);
          accumulated = text;
          await streamFunc(delta, false);
        }
      }
    } catch (e) {
      if (accumulated && typeof streamFunc === "function") {
        await streamFunc("", true);
      }
      throw e;
    }

    return accumulated;
  }

  async imageGenerationRequest(
    prompt: string,
    width?: number,
    height?: number
  ): Promise<string> {
    const profile = await resolveProfile(
      this.action,
      this.storage,
      this.customProfileId
    );
    if (!profile) throw new Error(`No provider assigned to ${this.action}`);

    const provider = createProvider(profile.providerType, {
      baseUrl: profile.baseUrl,
      apiKey: profile.key,
    });
    if (!provider) throw new Error(`Unknown provider: ${profile.providerType}`);
    if (!provider.imageGeneration) {
      throw new Error(
        `Provider ${profile.providerType} does not support image generation`
      );
    }
    return provider.imageGeneration({
      model: profile.modelId,
      prompt,
      width,
      height,
    });
  }
}

export const AiRequestFactory = {
  create(
    action: string,
    storage: StorageAdapter,
    customProfileId: string | null = null
  ): AiRequest {
    return new AiRequest(action as ActionType, storage, customProfileId);
  },
};
