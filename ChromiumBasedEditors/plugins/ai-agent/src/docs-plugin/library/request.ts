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

class AiRequest {
  action: ActionType;

  constructor(action: ActionType) {
    this.action = action;
  }

  async chatRequest(
    content: string,
    _block?: boolean,
    _streamFunc?: unknown
  ): Promise<string> {
    const provider = getActionProvider(this.action);
    if (!provider) throw new Error(`No provider assigned to ${this.action}`);
    return provider.sendMessageSync([{ role: "user", content }], "");
  }
}

export const AiRequestFactory = {
  create(action: string): AiRequest {
    return new AiRequest(action as ActionType);
  },
};
