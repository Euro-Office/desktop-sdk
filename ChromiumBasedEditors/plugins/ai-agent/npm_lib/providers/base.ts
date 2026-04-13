import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, TMCPItem, TProvider } from "../types";

export type TData = {
  url: string;
  apiKey?: string;
};

export type TErrorData = {
  field: "key" | "url" | "name";
  message: string;
};

/**
 * Abstract base class for all AI providers.
 * Implements common properties and methods shared across providers.
 *
 * Generic types:
 * - TOOL: Provider-specific tool format (e.g., ToolUnion for Anthropic)
 * - MESSAGE: Provider-specific message format (e.g., MessageParam for Anthropic)
 * - CLIENT: Provider-specific SDK client (e.g., Anthropic, OpenAI)
 */
export abstract class AbstractBaseProvider<TOOL, MESSAGE, CLIENT> {
  // Common properties
  modelKey = "";
  systemPrompt = "";
  apiKey?: string;
  url?: string;
  provider?: TProvider;
  isReasoning = false;

  // Provider-specific properties (typed by generics)
  client?: CLIENT;
  tools: TOOL[] = [];
  prevMessages: MESSAGE[] = [];

  // Stop flag for interrupting streams
  protected stopFlag = false;

  // ============================================
  // Common methods (identical across providers)
  // ============================================

  setModelKey = (modelKey: string): void => {
    this.modelKey = modelKey;
  };

  setSystemPrompt = (systemPrompt: string): void => {
    this.systemPrompt = systemPrompt;
  };

  stopMessage = (): void => {
    this.stopFlag = true;
  };

  /**
   * Sets the API key. Override in subclasses if the client needs special handling.
   * By default, stores the key and attempts to update the client's apiKey property.
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;

    const client = this.client as Record<string, unknown> | undefined;
    if (client && "apiKey" in client) {
      client.apiKey = apiKey;
    }
  }

  /**
   * Sets the base URL. Override in subclasses if the client needs special handling.
   * By default, stores the URL and attempts to update the client's baseURL property.
   */
  setUrl(url: string): void {
    this.url = url;

    const client = this.client as Record<string, unknown> | undefined;
    if (client && "baseURL" in client) {
      client.baseURL = url;
    }
  }

  // ============================================
  // Abstract methods (must be implemented by subclasses)
  // ============================================

  abstract setProvider(provider: TProvider): void;

  abstract setPrevMessages(prevMessages: ThreadMessageLike[]): void;

  abstract setTools(tools: TMCPItem[]): void;

  abstract createChatName(message: string): Promise<string>;

  abstract sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    message?: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  >;

  abstract sendMessageAfterToolCall(
    message: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  >;

  abstract getName(): string;

  abstract getBaseUrl(): string;

  abstract checkProvider(data: TData): Promise<boolean | TErrorData>;

  abstract getProviderModels(data: TData): Promise<Model[]>;

  // ============================================
  // Concrete methods (overridable by subclasses)
  // ============================================

  /**
   * Non-streaming chat request. Returns complete response text.
   * Default implementation drains the sendMessage() async generator.
   * Providers MAY override for a more efficient single-request call.
   */
  async sendMessageSync(messages: ThreadMessageLike[]): Promise<string> {
    const result = "";
    for await (const chunk of this.sendMessage(messages)) {
      if ("isEnd" in chunk) {
        const content = chunk.responseMessage.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          return content
            .filter((p) => p.type === "text")
            .map((p) => ("text" in p ? p.text : ""))
            .join("");
        }
      }
    }
    return result;
  }

  /**
   * Image generation. Returns base64-encoded image data.
   * Only providers with CapabilitiesUI.Image should implement this.
   */
  async imageGeneration?(request: {
    prompt: string;
    width?: number;
    height?: number;
  }): Promise<string>;

  /**
   * Image analysis — sends an image with a prompt and returns text response.
   */
  async imageVision(request: {
    image: string;
    prompt: string;
  }): Promise<string> {
    const message: ThreadMessageLike = {
      role: "user",
      content: [
        { type: "text", text: request.prompt },
        { type: "image", image: request.image },
      ],
    };
    return this.sendMessageSync([message]);
  }

  /**
   * OCR — extracts text from an image.
   */
  async imageOCR(request: { image: string }): Promise<string> {
    return this.imageVision({
      image: request.image,
      prompt:
        "Extract all text from this image exactly as it appears. Preserve the original formatting, line breaks, and structure.",
    });
  }

  /**
   * Whether this provider supports streaming responses.
   */
  isSupportStreaming(): boolean {
    return true;
  }
}
