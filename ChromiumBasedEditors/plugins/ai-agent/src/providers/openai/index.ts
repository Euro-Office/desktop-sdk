import type { ThreadMessageLike } from "@assistant-ui/react";
import cloneDeep from "lodash.clonedeep";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import type { Model as OpenAIModel } from "openai/resources/models";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { getErrorCode, ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import {
  createEmptyResponse,
  createErrorResponse,
  generateFallbackToolCallId,
} from "./constants";
import { handleTextMessage, handleToolCall } from "./handlers";
import { openaiInfo } from "./info";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "./utils";

// ============================================
// Type Definitions
// ============================================

/**
 * Extracts the array type from ThreadMessageLike content,
 * excluding the string variant.
 */
type MessageArray = Exclude<ThreadMessageLike["content"], string>;

/**
 * Represents a single element in the message content array.
 */
type ToolCallElement = MessageArray extends ReadonlyArray<infer T> ? T : never;

/**
 * Extracts specifically the tool-call type from message content parts.
 * Used for type-safe access to tool call properties.
 */
type ToolCallPart = Extract<ToolCallElement, { type: "tool-call" }>;

class OpenAIProvider extends AbstractBaseProvider<
  ChatCompletionTool,
  ChatCompletionMessageParam,
  OpenAI
> {
  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Creates a new OpenAI client with the given credentials.
   * Centralizes client creation to avoid duplication.
   * Protected to allow subclasses (e.g., OpenRouter) to reuse.
   */
  protected createClient(apiKey?: string, baseURL?: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Builds a system message in OpenAI format.
   */
  private buildSystemMessage(
    content: string
  ): ChatCompletionSystemMessageParam {
    return { role: "system", content };
  }

  /**
   * Creates the initial response object for streaming.
   * If continuing after a tool call, clones the existing message to preserve tool calls.
   */
  private createResponseShell(
    afterToolCall?: boolean,
    existingMessage?: ThreadMessageLike
  ): ThreadMessageLike {
    if (afterToolCall && existingMessage) {
      return cloneDeep(existingMessage);
    }
    return createEmptyResponse();
  }

  /**
   * Appends messages to the conversation history.
   */
  private pushHistory(messages: ChatCompletionMessageParam[]): void {
    this.prevMessages.push(...messages);
  }

  /**
   * Converts and appends a single message to history.
   */
  private pushSingleMessage(message: ThreadMessageLike): void {
    const providerMsg = convertMessagesToModelFormat([message]);
    this.pushHistory(providerMsg);
  }

  /**
   * Filters response content after a tool call to remove duplicated content.
   * Keeps all tool-calls and only new text content (content added after the original message).
   */
  private filterAfterToolCallContent(
    responseMessage: ThreadMessageLike,
    originalMessage?: ThreadMessageLike
  ): ThreadMessageLike {
    const currentContent = responseMessage.content;

    // Skip filtering for string content or missing original
    const shouldSkip =
      typeof currentContent === "string" ||
      !originalMessage ||
      typeof originalMessage.content === "string";

    if (shouldSkip) return responseMessage;

    const originalLength = originalMessage.content.length;
    const filtered = currentContent.filter((part, index) => {
      // Always keep tool-calls
      if (part.type === "tool-call") return true;
      // Only keep new content (added after original)
      return index >= originalLength;
    });

    return { ...responseMessage, content: filtered };
  }

  /**
   * Finds the last tool-call in a message's content array.
   * Used to extract tool results for continuation.
   */
  private getLastToolCall(
    message: ThreadMessageLike
  ): ToolCallPart | undefined {
    if (typeof message.content === "string") return undefined;

    // Iterate backwards to find the most recent tool-call
    for (let i = message.content.length - 1; i >= 0; i -= 1) {
      const part = message.content[i];
      if (part.type === "tool-call") {
        return part as ToolCallPart;
      }
    }
    return undefined;
  }

  // ============================================
  // Public Configuration Methods
  // ============================================

  setProvider = (provider: TProvider): void => {
    this.provider = provider;
    this.client = this.createClient(provider.key, provider.baseUrl);

    if (provider.key) this.setApiKey(provider.key);
    if (provider.baseUrl) this.setUrl(provider.baseUrl);
  };

  setPrevMessages = (prevMessages: ThreadMessageLike[]): void => {
    this.prevMessages = convertMessagesToModelFormat(prevMessages);
  };

  setTools = (tools: TMCPItem[]): void => {
    this.tools = convertToolsToModelFormat(tools);
  };

  // ============================================
  // Chat Operations
  // ============================================

  async createChatName(message: string) {
    try {
      if (!this.client) return "";

      const modelThinking = this.modelKey.includes("-thinking");

      const model = modelThinking
        ? this.modelKey.replace("-thinking", "")
        : this.modelKey;

      const systemMessage = this.buildSystemMessage(CREATE_TITLE_SYSTEM_PROMPT);

      const response = await this.client.chat.completions.create({
        messages: [systemMessage, { role: "user", content: message }],
        model,
        stream: false,
      });

      const title = response.choices[0].message.content;

      return title ?? message.substring(0, 25);
    } catch {
      return "";
    }
  }

  async getStream(
    systemMessage: ChatCompletionSystemMessageParam,
    convertedMessages: ChatCompletionMessageParam[],
    withThinking?: boolean
  ) {
    if (!this.client) return;

    const modelThinking = this.modelKey.includes("-thinking");

    const model = modelThinking
      ? this.modelKey.replace("-thinking", "")
      : this.modelKey;

    const reasoning_effort =
      withThinking && modelThinking ? "medium" : undefined;

    const stream = await this.client.chat.completions.create({
      messages: [systemMessage, ...this.prevMessages, ...convertedMessages],
      model,
      tools: this.tools,
      stream: true,
      reasoning_effort,
    });

    return stream;
  }

  /**
   * Sends a message and streams the response.
   *
   * @param messages - New messages to send
   * @param afterToolCall - Whether this is a continuation after a tool call
   * @param previousMessage - The previous message (used when afterToolCall is true)
   */
  async *sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    previousMessage?: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    if (!this.client) return;

    try {
      const convertedMessages = convertMessagesToModelFormat(messages);
      const systemMessage = this.buildSystemMessage(this.systemPrompt);

      const stream = await this.getStream(
        systemMessage,
        convertedMessages,
        withThinking
      );

      if (!stream) return;

      this.pushHistory(convertedMessages);

      let responseMessage = this.createResponseShell(
        afterToolCall,
        previousMessage
      );
      let isStreamComplete = false;

      for await (const streamEvent of stream) {
        // Process each chunk in the stream event
        for (const chunk of streamEvent.choices) {
          if (isStreamComplete) break;

          // Handle stream completion
          if (chunk.finish_reason) {
            responseMessage = afterToolCall
              ? this.filterAfterToolCallContent(
                  responseMessage,
                  previousMessage
                )
              : responseMessage;

            this.pushSingleMessage(responseMessage);
            isStreamComplete = true;
            break;
          }

          // Handle text content
          if (chunk.delta.content) {
            responseMessage = handleTextMessage(
              responseMessage,
              chunk,
              afterToolCall
            );
          }

          // Handle tool calls
          if (
            chunk.delta.tool_calls &&
            typeof responseMessage.content !== "string"
          ) {
            responseMessage = handleToolCall(responseMessage, chunk);
          }
        }

        // Handle user-initiated stop
        if (this.stopFlag) {
          this.pushSingleMessage(responseMessage);
          stream.controller.abort();
          this.stopFlag = false;

          yield { isEnd: true, responseMessage };
          continue;
        }

        // Yield final response if stream is complete
        if (isStreamComplete) {
          yield { isEnd: true, responseMessage };
          return;
        }

        // Yield intermediate response for UI updates
        yield responseMessage;
      }
    } catch (error) {
      console.error("OpenAI sendMessage error:", error);
      yield {
        isEnd: true,
        responseMessage: createErrorResponse(error),
      };
    }
  }

  /**
   * Continues the conversation after a tool call has been executed.
   * Extracts the tool result and sends it back to the model.
   */
  async *sendMessageAfterToolCall(
    message: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    if (typeof message.content === "string") return message;

    const lastToolCall = this.getLastToolCall(message);
    if (!lastToolCall) return message;

    const toolResult: ChatCompletionToolMessageParam = {
      role: "tool",
      content: lastToolCall.result,
      tool_call_id: lastToolCall.toolCallId ?? generateFallbackToolCallId(),
    };

    this.pushHistory([toolResult]);
    yield* this.sendMessage([], true, message, withThinking);

    return message;
  }

  // ============================================
  // Provider Info Methods
  // ============================================

  getName = (): string => openaiInfo.name;

  getBaseUrl = (): string => openaiInfo.baseUrl;

  // ============================================
  // Provider Validation & Model Fetching
  // ============================================

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const client = this.createClient(data.apiKey, data.url);

    try {
      await client.models.list();
      return true;
    } catch (error) {
      const errorCode = getErrorCode(error);
      const isInvalidKey = errorCode === "invalid_api_key";
      if (isInvalidKey) return ProviderErrors.invalidKey();

      if (errorCode === 404) {
        return ProviderErrors.invalidUrl();
      }

      return data.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient(data.apiKey, data.url);
    const response: OpenAIModel[] = (await client.models.list()).data;

    return response
      .filter((model) => openaiInfo.modelFilters.includes(model.id))
      .map((model) => {
        const baseName =
          openaiInfo.modelNames[model.id] || model.id.toUpperCase();

        return {
          id: `${model.id}-thinking`,
          name: baseName,
          provider: "openai" as const,
        };
      });
  };
}

const openaiProvider = new OpenAIProvider();

export { OpenAIProvider, openaiProvider };
