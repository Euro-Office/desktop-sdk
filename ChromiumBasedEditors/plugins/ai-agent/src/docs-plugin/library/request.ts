import type { ThreadMessageLike } from "@assistant-ui/react";
import { type ActionType, getActionProvider } from "@onlyoffice/ai-chat";

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

class AiRequest {
  action: ActionType;

  constructor(action: ActionType) {
    this.action = action;
  }

  async chatRequest(
    content: string,
    _block?: boolean,
    streamFunc?: StreamFunc
  ): Promise<string> {
    const provider = getActionProvider(this.action);
    if (!provider) throw new Error(`No provider assigned to ${this.action}`);

    if (typeof streamFunc !== "function" || !provider.isSupportStreaming()) {
      const result = await provider.sendMessageSync(
        [{ role: "user", content }],
        ""
      );
      if (typeof streamFunc === "function") {
        await streamFunc(result, true);
      }
      return result;
    }

    // TODO(ai-chat): replace this block with
    //   return provider.sendMessageSyncStream(
    //     [{ role: "user", content }], streamFunc, ""
    //   );
    // once the library exposes `sendMessageSyncStream` — a streaming counterpart
    // to `sendMessageSync` that does not read/mutate `prevMessages` or `tools`.
    // Until then we piggyback on `sendMessage` and snapshot/restore those fields
    // to avoid contaminating the surrounding chat flow (the engine reads
    // `prevMessages` back in `sendMessageAfterToolCall` right after our tool
    // returns).
    const savedPrevMessages = provider.prevMessages;
    const savedTools = provider.tools;
    provider.prevMessages = [];
    provider.tools = [];

    let accumulated = "";
    try {
      for await (const chunk of provider.sendMessage([
        { role: "user", content },
      ])) {
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
    } finally {
      provider.prevMessages = savedPrevMessages;
      provider.tools = savedTools;
    }

    return accumulated;
  }

  async imageGenerationRequest(
    prompt: string,
    width?: number,
    height?: number
  ): Promise<string> {
    const provider = getActionProvider(this.action);
    if (!provider) throw new Error(`No provider assigned to ${this.action}`);
    if (!provider.imageGeneration) {
      throw new Error(
        `Provider ${provider.getName()} does not support image generation`
      );
    }
    return provider.imageGeneration({ prompt, width, height });
  }
}

export const AiRequestFactory = {
  create(action: string): AiRequest {
    return new AiRequest(action as ActionType);
  },
};
