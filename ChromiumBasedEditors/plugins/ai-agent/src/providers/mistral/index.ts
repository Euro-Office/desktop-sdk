import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Mistral } from "@mistralai/mistralai";
import type { Messages, Tool } from "@mistralai/mistralai/models/components";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { extractErrorMessage, getErrorStatus, ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import {
  getChoiceFromEvent,
  handleTextContent,
  handleToolCall,
} from "./handlers";
import {
  createClient,
  createErrorResponse,
  createResponseShell,
  getLastToolCall,
} from "./helpers";
import { mistralInfo } from "./info";
import type { StreamResult } from "./types";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "./utils";

class MistralProvider extends AbstractBaseProvider<Tool, Messages, Mistral> {
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

  async createChatName(message: string): Promise<string> {
    if (!this.client) return "";

    try {
      const response = await this.client.chat.complete({
        model: this.modelKey,
        messages: [
          { role: "system", content: CREATE_TITLE_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        return content.substring(0, 25);
      }

      return message.substring(0, 25);
    } catch {
      return "";
    }
  }

  private getModelKey = (withThinking?: boolean): string => {
    if (!withThinking) return this.modelKey;

    const reasoningModel = mistralInfo.reasoningModels.find(
      ([level, _modelKeyy]) => this.modelKey.includes(level)
    );

    return reasoningModel ? reasoningModel[1] : this.modelKey;
  };

  async *sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    previousMessage?: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<StreamResult> {
    if (!this.client) return;

    try {
      const convertedMessages = convertMessagesToModelFormat(messages);
      this.prevMessages.push(...convertedMessages);

      const model = this.getModelKey(withThinking);

      const allMessages: Messages[] = [
        { role: "system", content: this.systemPrompt },
        ...this.prevMessages,
      ];

      const stream = await this.client.chat.stream({
        model,
        messages: allMessages,
        tools: this.tools.length > 0 ? this.tools : undefined,
      });

      let responseMessage = createResponseShell(afterToolCall, previousMessage);

      for await (const event of stream) {
        // Handle stop flag
        if (this.stopFlag) {
          this.stopFlag = false;
          this.pushToHistory(responseMessage);
          yield { isEnd: true, responseMessage };
          return;
        }

        const choice = getChoiceFromEvent(event);
        if (!choice) continue;

        const delta = choice.delta;

        // Handle tool call
        responseMessage = handleToolCall(delta, responseMessage);

        // Handle text content
        responseMessage = handleTextContent(delta, responseMessage);

        // Handle finish
        if (choice.finishReason) {
          if (afterToolCall && previousMessage) {
            this.pushToHistorySliced(responseMessage, previousMessage);
          } else {
            this.pushToHistory(responseMessage);
          }
          yield { isEnd: true, responseMessage };
          return;
        }

        yield responseMessage;
      }
    } catch (_error) {
      console.error("Mistral sendMessage error:", _error);
      yield { isEnd: true, responseMessage: createErrorResponse(_error) };
    }
  }

  async *sendMessageAfterToolCall(
    message: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<StreamResult> {
    if (typeof message.content === "string") return message;

    const lastToolCall = getLastToolCall(message);
    if (!lastToolCall) return message;

    const toolResult = {
      role: "tool" as const,
      content:
        typeof lastToolCall.result === "string"
          ? lastToolCall.result
          : JSON.stringify(lastToolCall.result),
      toolCallId: lastToolCall.toolCallId ?? "",
      name: lastToolCall.toolName,
    };

    this.prevMessages.push(toolResult as Messages);
    yield* this.sendMessage([], true, message, withThinking);
  }

  getBaseUrl = (): string => mistralInfo.baseUrl;

  getName = (): string => mistralInfo.name;

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const client = createClient(data.apiKey, data.url);

    try {
      await client.models.list();
      return true;
    } catch (error) {
      const status = getErrorStatus(error);

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
      const response = await client.models.list();
      const models = response.data ?? [];

      const result: Model[] = [];

      for (const model of models) {
        const matchesFilter =
          mistralInfo.modelFilters.length === 0 ||
          mistralInfo.modelFilters.some((f) => model.id?.includes(f));

        if (!matchesFilter) continue;

        const displayName =
          mistralInfo.modelNames[model.id ?? ""] ?? model.id ?? "Unknown";

        result.push({
          id: model.id ?? "",
          name: displayName,
          provider: "mistral" as const,
        });
      }

      return result;
    } catch {
      return [];
    }
  };
}

const mistralProvider = new MistralProvider();

export { MistralProvider, mistralProvider };
