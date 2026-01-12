import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, TMCPItem, TProvider } from "@/lib/types";

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
}
