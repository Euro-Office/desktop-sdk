import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  type ActionType,
  createProvider,
  type StorageAdapter,
} from "@onlyoffice/ai-chat";
import { editor } from "./editor";
import { prompts } from "./prompts";

interface BlockActionGuard {
  end: () => Promise<void>;
}

async function startBlockAction(label: string): Promise<BlockActionGuard> {
  await editor.callMethod("StartAction", ["Block", label]);
  let ended = false;
  return {
    end: async () => {
      if (ended) return;
      ended = true;
      await editor.callMethod("EndAction", ["Block", label]);
    },
  };
}

function getAiBlockLabel(_action: ActionType): string {
  return "AI";
}

export const AiActionType = {
  Chat: "Chat",
  Code: "Code",
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

export type ImageGenerationRequestData = {
  prompt: string;
  width?: number;
  height?: number;
};

export type ImageVisionRequestData = {
  prompt?: string;
  image: string;
};

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

  private async withBlock<T>(
    block: boolean | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    if (block === false) return fn();
    let guard: BlockActionGuard | null = null;
    try {
      guard = await startBlockAction(getAiBlockLabel(this.action));
      return await fn();
    } finally {
      if (guard) await guard.end();
    }
  }

  private async resolveProviderAndProfile() {
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
    return { profile, provider };
  }

  async chatRequest(
    content: string,
    block?: boolean,
    streamFunc?: StreamFunc
  ): Promise<string> {
    return this.withBlock(block, async () => {
      const { profile, provider } = await this.resolveProviderAndProfile();

      const messages: ThreadMessageLike[] = [{ role: "user", content }];
      const syncArgs = { messages, model: profile.modelId, systemPrompt: "" };

      if (typeof streamFunc !== "function") {
        return provider.sendMessageSync(syncArgs);
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
    });
  }

  async imageGenerationRequest(
    data: ImageGenerationRequestData,
    block?: boolean
  ): Promise<string> {
    return this.withBlock(block, async () => {
      const { profile, provider } = await this.resolveProviderAndProfile();
      if (!provider.imageGeneration) {
        throw new Error(
          `Provider ${profile.providerType} does not support image generation`
        );
      }
      return provider.imageGeneration({
        model: profile.modelId,
        prompt: data.prompt,
        width: data.width,
        height: data.height,
      });
    });
  }

  async imageVisionRequest(
    data: ImageVisionRequestData,
    block?: boolean
  ): Promise<string> {
    return this.withBlock(block, () =>
      this.runImageMessage(
        data.prompt ?? prompts.getImageDescription(),
        data.image
      )
    );
  }

  async imageOCRRequest(image: string, block?: boolean): Promise<string> {
    return this.withBlock(block, () =>
      this.runImageMessage(prompts.getImagePromptOCR(), image)
    );
  }

  private async runImageMessage(
    prompt: string,
    image: string
  ): Promise<string> {
    const { profile, provider } = await this.resolveProviderAndProfile();
    const messages: ThreadMessageLike[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image },
        ],
      },
    ];
    return provider.sendMessageSync({
      messages,
      model: profile.modelId,
      systemPrompt: "",
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
