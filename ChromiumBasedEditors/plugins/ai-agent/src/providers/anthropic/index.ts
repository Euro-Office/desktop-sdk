import type Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolResultBlockParam,
  ToolUnion,
} from "@anthropic-ai/sdk/resources/messages";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { extractErrorMessage, getErrorStatus, ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import {
  handleContentBlockDelta,
  handleContentBlockStart,
  handleMessageStart,
} from "./handlers";
import {
  createClient,
  createEndResult,
  createErrorResult,
  createInitialResponse,
  getLastToolCall,
} from "./helpers";
import { anthropicInfo } from "./info";
import type { StreamResult } from "./types";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "./utils";

// ============================================================================
// Provider Class
// ============================================================================

class AnthropicProvider extends AbstractBaseProvider<
  ToolUnion,
  MessageParam,
  Anthropic
> {
  // --------------------------------------------------------------------------
  // Setup Methods
  // --------------------------------------------------------------------------

  setProvider = (provider: TProvider): void => {
    this.provider = provider;

    this.client = createClient(provider.key, provider.baseUrl);

    if (provider.key) this.setApiKey(provider.key);
    if (provider.baseUrl) this.setUrl(provider.baseUrl);
  };

  setPrevMessages = (prevMessages: ThreadMessageLike[]): void => {
    this.prevMessages = convertMessagesToModelFormat(prevMessages);
  };

  setTools = (tools: TMCPItem[]): void => {
    this.tools = convertToolsToModelFormat(tools);
  };

  // --------------------------------------------------------------------------
  // History Management
  // --------------------------------------------------------------------------

  private pushToHistory = (message: ThreadMessageLike): void => {
    const converted = convertMessagesToModelFormat([message]);
    this.prevMessages.push(...converted);
  };

  private pushToHistorySliced = (
    responseMessage: ThreadMessageLike,
    originalMessage: ThreadMessageLike
  ): void => {
    if (typeof responseMessage.content === "string") return;
    if (typeof originalMessage.content === "string") return;

    const newContent = responseMessage.content.slice(
      originalMessage.content.length
    );
    this.pushToHistory({ ...responseMessage, content: newContent });
  };

  // --------------------------------------------------------------------------
  // Chat Name
  // --------------------------------------------------------------------------

  async createChatName(message: string): Promise<string> {
    if (!this.client) return "";

    try {
      const response = await this.client.messages.create({
        messages: [{ role: "user", content: message }],
        model: this.modelKey,
        system: CREATE_TITLE_SYSTEM_PROMPT,
        max_tokens: 2048,
        stream: false,
      });

      const title = response.content.find((c) => c.type === "text")?.text;

      return title ?? message.substring(0, 25);
    } catch {
      return "";
    }
  }

  // --------------------------------------------------------------------------
  // Message Streaming
  // --------------------------------------------------------------------------

  async *sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    message?: ThreadMessageLike
  ): AsyncGenerator<StreamResult> {
    if (!this.client) return;

    try {
      const convertedMessages = convertMessagesToModelFormat(messages);
      this.prevMessages.push(...convertedMessages);

      const stream = await this.client.messages.create({
        messages: [...this.prevMessages],
        model: this.modelKey,
        system: this.systemPrompt,
        tools: this.tools,
        stream: true,
        max_tokens: 30000,
        tool_choice: { disable_parallel_tool_use: true, type: "auto" },
      });

      let responseMessage = createInitialResponse(afterToolCall, message);

      for await (const event of stream) {
        // Handle stop flag
        if (this.stopFlag) {
          this.stopFlag = false;
          this.pushToHistory(responseMessage);
          stream.controller.abort();
          yield createEndResult(responseMessage);
          return;
        }

        // Process event by type
        switch (event.type) {
          case "message_start":
            if (afterToolCall && message) {
              yield message;
            } else {
              responseMessage = handleMessageStart(event);
            }
            break;

          case "content_block_start":
            responseMessage = handleContentBlockStart(event, responseMessage);
            break;

          case "content_block_delta":
            responseMessage = handleContentBlockDelta(event, responseMessage);
            break;

          case "message_stop":
            if (afterToolCall && message) {
              this.pushToHistorySliced(responseMessage, message);
            } else {
              this.pushToHistory(responseMessage);
            }
            yield createEndResult(responseMessage);
            return;

          default:
            break;
        }

        yield responseMessage;
      }
    } catch (error) {
      yield createErrorResult(error);
    }
  }

  async *sendMessageAfterToolCall(
    message: ThreadMessageLike
  ): AsyncGenerator<StreamResult> {
    const lastToolCall = getLastToolCall(message);
    if (!lastToolCall) return message;

    const toolResult: ToolResultBlockParam = {
      type: "tool_result",
      content: lastToolCall.result,
      tool_use_id: lastToolCall.toolCallId ?? "",
    };

    this.prevMessages.push({ role: "user", content: [toolResult] });

    yield* this.sendMessage([], true, message);
  }

  // --------------------------------------------------------------------------
  // Provider Info
  // --------------------------------------------------------------------------

  getBaseUrl = (): string => anthropicInfo.baseUrl;

  getName = (): string => anthropicInfo.name;

  // --------------------------------------------------------------------------
  // Provider Validation & Models
  // --------------------------------------------------------------------------

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const client = createClient(data.apiKey, data.url);

    try {
      await client.models.list();
      return true;
    } catch (error) {
      const status = getErrorStatus(error);

      // Network/connection error (unreachable URL)
      if (
        status === 0 ||
        (error && typeof error === "object" && "cause" in error)
      ) {
        return ProviderErrors.invalidUrl();
      }

      if (status === 401) {
        return ProviderErrors.invalidKey(extractErrorMessage(error));
      }
      if (status === 404) {
        return ProviderErrors.invalidUrl();
      }

      return data.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = createClient(data.apiKey, data.url);

    try {
      const { data: models } = await client.models.list();

      return models
        .filter((model) =>
          anthropicInfo.modelFilters.some((f) => model.id.includes(f))
        )
        .map((model) => ({
          id: model.id,
          name: anthropicInfo.modelNames[model.id] || model.display_name,
          provider: "anthropic" as const,
        }));
    } catch {
      return [];
    }
  };
}

const anthropicProvider = new AnthropicProvider();

export { AnthropicProvider, anthropicProvider };
