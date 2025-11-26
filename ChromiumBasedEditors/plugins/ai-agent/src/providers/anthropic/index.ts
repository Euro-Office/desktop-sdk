import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolResultBlockParam,
  ToolUnion,
} from "@anthropic-ai/sdk/resources/messages";
import type { ThreadMessageLike } from "@assistant-ui/react";
import cloneDeep from "lodash.clonedeep";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { extractErrorMessage, getErrorStatus, ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import {
  handleContentBlockDelta,
  handleContentBlockStart,
  handleMessageStart,
} from "./handlers";
import { anthropicInfo } from "./info";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "./utils";

class AnthropicProvider extends AbstractBaseProvider<
  ToolUnion,
  MessageParam,
  Anthropic
> {
  setProvider = (provider: TProvider) => {
    this.provider = provider;

    this.client = new Anthropic({
      apiKey: provider.key,
      baseURL: provider.baseUrl,
      dangerouslyAllowBrowser: true,
    });

    if (provider.key) this.setApiKey(provider.key);
    if (provider.baseUrl) this.setUrl(provider.baseUrl);
  };

  setPrevMessages = (prevMessages: ThreadMessageLike[]) => {
    this.prevMessages = convertMessagesToModelFormat(prevMessages);
  };

  setTools = (tools: TMCPItem[]) => {
    this.tools = convertToolsToModelFormat(tools);
  };

  async createChatName(message: string) {
    try {
      if (!this.client) return "";

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

  async *sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    message?: ThreadMessageLike
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    try {
      if (!this.client) return;

      const convertedMessage = convertMessagesToModelFormat(messages);

      const stream = await this.client.messages.create({
        messages: [...this.prevMessages, ...convertedMessage],
        model: this.modelKey,
        system: this.systemPrompt,
        tools: this.tools,
        stream: true,
        max_tokens: 30000,
        tool_choice: {
          disable_parallel_tool_use: true,
          type: "auto",
        },
      });

      this.prevMessages.push(...convertedMessage);

      let responseMessage: ThreadMessageLike =
        afterToolCall && message
          ? cloneDeep(message)
          : {
              role: "assistant",
              content: [],
            };

      for await (const messageStreamEvent of stream) {
        const { type } = messageStreamEvent;

        if (type === "message_start") {
          if (afterToolCall && message) {
            yield message;

            continue;
          }

          responseMessage = handleMessageStart(messageStreamEvent);
        }

        if (type === "content_block_start") {
          responseMessage = handleContentBlockStart(
            messageStreamEvent,
            responseMessage
          );
        }

        if (type === "content_block_delta") {
          responseMessage = handleContentBlockDelta(
            messageStreamEvent,
            responseMessage
          );
        }

        if (type === "message_stop") {
          if (afterToolCall && message) {
            const newContent = responseMessage.content.slice(
              message.content.length
            );

            const newMsg = {
              ...responseMessage,
              content: newContent,
            };

            const providerMsg = convertMessagesToModelFormat([newMsg]);

            this.prevMessages.push(...providerMsg);

            yield { isEnd: true, responseMessage };
            continue;
          }
          const providerMsg = convertMessagesToModelFormat([responseMessage]);

          this.prevMessages.push(...providerMsg);

          yield { isEnd: true, responseMessage };
          continue;
        }

        if (this.stopFlag) {
          this.stopFlag = false;

          const providerMsg = convertMessagesToModelFormat([responseMessage]);

          this.prevMessages.push(...providerMsg);

          stream.controller.abort();

          yield { isEnd: true, responseMessage };

          continue;
        }

        yield responseMessage;
      }
    } catch (e) {
      yield {
        isEnd: true,
        responseMessage: {
          role: "assistant",
          content: "",
          status: {
            type: "incomplete",
            reason: "error",
            error: e,
          },
        } as ThreadMessageLike,
      };
    }
  }

  async *sendMessageAfterToolCall(
    message: ThreadMessageLike
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    if (typeof message.content === "string") return message;

    const result = message.content
      .filter((c) => c.type === "tool-call")
      .reverse()[0];

    if (!result) return message;

    const toolResult: ToolResultBlockParam = {
      type: "tool_result",
      content: result.result,
      tool_use_id: result.toolCallId ?? "",
    };

    this.prevMessages.push({
      role: "user",
      content: [toolResult],
    });

    yield* this.sendMessage([], true, message);

    return message;
  }

  getBaseUrl = (): string => {
    return anthropicInfo.baseUrl;
  };

  getName = (): string => {
    return anthropicInfo.name;
  };

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const checkClient = new Anthropic({
      apiKey: data.apiKey,
      baseURL: data.url,
      dangerouslyAllowBrowser: true,
    });

    try {
      await checkClient.models.list();
      return true;
    } catch (error) {
      const status = getErrorStatus(error);

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
    const checkClient = new Anthropic({
      apiKey: data.apiKey,
      baseURL: data.url,
      dangerouslyAllowBrowser: true,
    });

    try {
      const modelsRes = await checkClient.models.list();

      const body = modelsRes.data;

      return body
        .filter((model) =>
          anthropicInfo.modelFilters.some((filter) => model.id.includes(filter))
        )
        .map((model) => ({
          id: model.id,
          name: anthropicInfo.modelNames[model.id] || model.display_name,
          provider: "anthropic" as const,
        }));
    } catch (error) {
      console.log(error);
      return [];
    }
  };
}

const anthropicProvider = new AnthropicProvider();

export { AnthropicProvider, anthropicProvider };
