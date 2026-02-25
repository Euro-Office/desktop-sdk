import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  type Content,
  type FunctionDeclaration,
  GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";
import cloneDeep from "lodash.clonedeep";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import { processGenAIResponse } from "./handlers";
import { genaiInfo } from "./info";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
  type GenAIMessageParam,
} from "./utils";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates an error response message for failed requests.
 */
const createErrorResponse = (
  error: unknown
): { isEnd: true; responseMessage: ThreadMessageLike } => ({
  isEnd: true,
  responseMessage: {
    role: "assistant",
    content: "",
    status: { type: "incomplete", reason: "error", error },
  } as ThreadMessageLike,
});

/**
 * Filters message content for after-tool-call scenarios.
 */
const filterAfterToolCallContent = (
  responseMessage: ThreadMessageLike,
  originalMessage?: ThreadMessageLike
): ThreadMessageLike => {
  if (typeof responseMessage.content === "string") return responseMessage;

  const originalLength =
    typeof originalMessage?.content === "string"
      ? 0
      : (originalMessage?.content.length ?? 0);

  return {
    ...responseMessage,
    content: responseMessage.content.filter(
      (part, index) => part.type === "tool-call" || index >= originalLength
    ),
  };
};

/**
 * Checks if a message has any content.
 */
const hasContent = (message: ThreadMessageLike): boolean =>
  typeof message.content === "string"
    ? message.content.length > 0
    : message.content.length > 0;

// ============================================================================
// Provider Class
// ============================================================================

class GenAIProvider extends AbstractBaseProvider<
  FunctionDeclaration,
  GenAIMessageParam,
  GoogleGenAI
> {
  /**
   * Recreates the GoogleGenAI client with current apiKey and url.
   */
  private recreateClient(): void {
    this.client = new GoogleGenAI({
      apiKey: this.apiKey ?? "",
      httpOptions: this.url ? { baseUrl: this.url } : undefined,
    });
  }

  setProvider = (provider: TProvider) => {
    this.provider = provider;
    this.apiKey = provider.key;
    this.url = provider.baseUrl;
    this.recreateClient();
  };

  /**
   * Override: GoogleGenAI requires client recreation when API key changes.
   */
  override setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.recreateClient();
  }

  /**
   * Override: GoogleGenAI requires client recreation when URL changes.
   */
  override setUrl(url: string): void {
    this.url = url;
    this.recreateClient();
  }

  setPrevMessages = (prevMessages: ThreadMessageLike[]) => {
    this.prevMessages = convertMessagesToModelFormat(prevMessages);
  };

  setTools = (tools: TMCPItem[]) => {
    this.tools = convertToolsToModelFormat(tools);
  };

  async createChatName(message: string) {
    try {
      if (!this.client) return "";

      const response = await this.client.models.generateContent({
        model: this.modelKey,
        contents: [{ role: "user", parts: [{ text: message }] }],
        config: {
          systemInstruction: CREATE_TITLE_SYSTEM_PROMPT,
        },
      });

      const title = response.text;
      return title ?? message.substring(0, 25);
    } catch {
      return "";
    }
  }

  async *sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    message?: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    try {
      if (!this.client) return;

      const convertedMessages = convertMessagesToModelFormat(messages);
      const allMessages: Content[] = [
        ...this.prevMessages,
        ...convertedMessages,
      ];

      this.prevMessages.push(...convertedMessages);

      let responseMessage: ThreadMessageLike =
        afterToolCall && message
          ? cloneDeep(message)
          : { role: "assistant", content: [] };

      const thinkingConfig = withThinking
        ? {
            thinkingLevel: ThinkingLevel.THINKING_LEVEL_UNSPECIFIED,
            includeThoughts: true,
          }
        : undefined;

      // Use streaming
      const stream = await this.client.models.generateContentStream({
        model: this.modelKey,
        contents: allMessages,
        config: {
          systemInstruction: this.systemPrompt,
          tools: this.tools.length
            ? [{ functionDeclarations: this.tools }]
            : undefined,
          thinkingConfig,
        },
      });

      for await (const chunk of stream) {
        if (this.stopFlag) {
          if (hasContent(responseMessage)) {
            this.prevMessages.push(
              ...convertMessagesToModelFormat([responseMessage])
            );
          }
          this.stopFlag = false;
          yield { isEnd: true, responseMessage };
          return;
        }

        responseMessage = processGenAIResponse(responseMessage, chunk);
        yield responseMessage;
      }

      // Final message
      const finalMsg = afterToolCall
        ? filterAfterToolCallContent(responseMessage, message)
        : responseMessage;
      this.prevMessages.push(...convertMessagesToModelFormat([finalMsg]));

      yield { isEnd: true, responseMessage };
    } catch (e) {
      console.error("GenAI sendMessage error:", e);
      yield createErrorResponse(e);
    }
  }

  async *sendMessageAfterToolCall(
    message: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    if (typeof message.content === "string") return message;

    const result = message.content
      .filter((c) => c.type === "tool-call")
      .reverse()[0];

    if (!result) return message;

    // Add function response to history
    const functionResponse: Content = {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: result.toolName,
            response: { result: result.result || "" },
          },
        },
      ],
    };

    this.prevMessages.push(functionResponse);

    yield* this.sendMessage([], true, message, withThinking);

    return message;
  }

  getName = () => genaiInfo.name;

  getBaseUrl = () => genaiInfo.baseUrl;

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    try {
      const checkClient = new GoogleGenAI({
        apiKey: data.apiKey ?? "",
        httpOptions: data.url ? { baseUrl: data.url } : undefined,
      });

      // Try listing models to verify API key
      await checkClient.models.list();

      return true;
    } catch (error) {
      if (!data.apiKey) return ProviderErrors.emptyKey();

      const message = error instanceof Error ? error.message : "";

      // Empty object error indicates invalid URL
      const isEmptyObject =
        error !== null &&
        typeof error === "object" &&
        Object.keys(error).length === 0;

      if (isEmptyObject) {
        return ProviderErrors.invalidUrl();
      }

      if (message.includes("API key")) {
        return ProviderErrors.invalidKey();
      }

      return data.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    try {
      const checkClient = new GoogleGenAI({
        apiKey: data.apiKey ?? "",
        httpOptions: data.url ? { baseUrl: data.url } : undefined,
      });

      const models: Model[] = [];
      const pager = await checkClient.models.list();

      // Collect models from all pages
      let page = await pager.page;

      while (page.length > 0) {
        for (const model of page) {
          const modelId = model.name?.replace("models/", "") ?? "";

          if (genaiInfo.modelFilters.includes(modelId)) {
            models.push({
              id: modelId,
              name:
                genaiInfo.modelNames[modelId] || model.displayName || modelId,
              provider: "genai" as const,
            });
          }
        }

        if (!pager.hasNextPage()) break;
        page = await pager.nextPage();
      }

      return models;
    } catch {
      return [];
    }
  };
}

const genaiProvider = new GenAIProvider();

export { GenAIProvider, genaiProvider };
