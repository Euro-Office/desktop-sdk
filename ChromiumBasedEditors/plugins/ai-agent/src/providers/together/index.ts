import type { ThreadMessageLike } from "@assistant-ui/react";
import cloneDeep from "lodash.clonedeep";
import Together from "together-ai";
import type { ModelListResponse, Tools } from "together-ai/resources";
import type {
  ChatCompletionSystemMessageParam,
  CompletionCreateParams,
} from "together-ai/resources/chat/completions";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { getErrorStatus, ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import { handleTextMessage, handleToolCall } from "./handlers";
import { togetherInfo } from "./info";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
  type TogetherMessageParam,
} from "./utils";

class TogetherProvider extends AbstractBaseProvider<
  Tools,
  TogetherMessageParam,
  Together
> {
  setProvider = (provider: TProvider) => {
    this.provider = provider;

    this.client = new Together({
      apiKey: provider.key,
      baseURL: provider.baseUrl,
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

      const systemMessage: ChatCompletionSystemMessageParam = {
        role: "system",
        content: CREATE_TITLE_SYSTEM_PROMPT,
      };

      const response = await this.client.chat.completions.create({
        messages: [systemMessage, { role: "user", content: message }],
        model: this.modelKey,
        stream: false,
      });

      const title = response.choices[0].message?.content;

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

      const systemMessage: ChatCompletionSystemMessageParam = {
        role: "system",
        content: this.systemPrompt,
      };

      const stream = await this.client.chat.completions.create({
        messages: [systemMessage, ...this.prevMessages, ...convertedMessage],
        model: this.modelKey,
        tools: this.tools,
        stream: true,
      });

      this.prevMessages.push(...convertedMessage);

      let responseMessage: ThreadMessageLike =
        afterToolCall && message
          ? cloneDeep(message)
          : {
              role: "assistant",
              content: [],
            };

      let stop = false;

      for await (const messageStreamEvent of stream) {
        const chunks = messageStreamEvent.choices;

        chunks.forEach((chunk) => {
          if (stop) return;

          if (chunk.finish_reason) {
            stop = true;

            const curMsg = afterToolCall
              ? {
                  ...responseMessage,
                  content:
                    typeof responseMessage.content === "string"
                      ? responseMessage.content
                      : responseMessage.content.filter((part, index) => {
                          // Keep tool-call parts and new text parts added after tool execution
                          if (part.type === "tool-call") return true;
                          // Only keep text parts that were added after the original message
                          const originalLength = message?.content.length ?? 0;
                          return index >= originalLength;
                        }),
                }
              : responseMessage;

            const providerMsg = convertMessagesToModelFormat([curMsg]);

            this.prevMessages.push(...providerMsg);

            return;
          }

          if (chunk.delta.content) {
            responseMessage = handleTextMessage(
              responseMessage,
              chunk,
              afterToolCall
            );
          }

          if (
            chunk.delta.tool_calls &&
            typeof responseMessage.content !== "string"
          ) {
            responseMessage = handleToolCall(responseMessage, chunk);
          }
        });

        if (this.stopFlag) {
          // Only push to prevMessages if there's actual content
          const hasContent =
            typeof responseMessage.content === "string"
              ? responseMessage.content.length > 0
              : responseMessage.content.length > 0;

          if (hasContent) {
            const providerMsg = convertMessagesToModelFormat([responseMessage]);
            this.prevMessages.push(...providerMsg);
          }

          stream.controller.abort();

          this.stopFlag = false;

          yield {
            isEnd: true,
            responseMessage,
          };
        } else if (stop) {
          yield {
            isEnd: true,
            responseMessage,
          };
        } else {
          yield responseMessage;
        }
      }
    } catch (e) {
      console.log(e);
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

    const toolResult: CompletionCreateParams.ChatCompletionToolMessageParam = {
      role: "tool",
      content: result.result || "",
      tool_call_id: result.toolCallId ?? "",
    };

    this.prevMessages.push(toolResult);

    yield* this.sendMessage([], true, message);

    return message;
  }

  getName = () => {
    return togetherInfo.name;
  };

  getBaseUrl = () => {
    return togetherInfo.baseUrl;
  };

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const checkClient = new Together({
      baseURL: data.url,
      apiKey: data.apiKey,
    });

    try {
      await checkClient.models.list();

      return true;
    } catch (error) {
      if (getErrorStatus(error) === 401) {
        return ProviderErrors.invalidKey();
      }

      return data.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const newClient = new Together({
      baseURL: data.url,
      apiKey: data.apiKey,
    });

    const response: ModelListResponse = (await newClient.models.list()).filter(
      (m) => m.type === "chat"
    );

    return response
      .filter((m) => togetherInfo.modelFilters.includes(m.id))
      .map((model) => ({
        id: model.id,
        name:
          togetherInfo.modelNames[model.id] || model.display_name || model.id,
        provider: "together" as const,
      }));
  };
}

const togetherProvider = new TogetherProvider();

export { TogetherProvider, togetherProvider };
