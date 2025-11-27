import type { ThreadMessageLike } from "@assistant-ui/react";
import cloneDeep from "lodash.clonedeep";
import Together from "together-ai";
import type { ModelListResponse, Tools } from "together-ai/resources";
import type {
  ChatCompletionChunk,
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
 * Processes a stream chunk, updating the response message.
 */
const processChunk = (
  chunk: ChatCompletionChunk.Choice,
  responseMessage: ThreadMessageLike,
  afterToolCall?: boolean
): ThreadMessageLike => {
  let result = responseMessage;

  if (chunk.delta.content) {
    result = handleTextMessage(result, chunk, afterToolCall);
  }

  if (chunk.delta.tool_calls && typeof result.content !== "string") {
    result = handleToolCall(result, chunk);
  }

  return result;
};

/**
 * Filters message content for after-tool-call scenarios.
 * Keeps tool-call parts and new text parts added after tool execution.
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

      const convertedMessages = convertMessagesToModelFormat(messages);
      const systemMessage: ChatCompletionSystemMessageParam = {
        role: "system",
        content: this.systemPrompt,
      };

      const stream = await this.client.chat.completions.create({
        messages: [systemMessage, ...this.prevMessages, ...convertedMessages],
        model: this.modelKey,
        tools: this.tools,
        stream: true,
      });

      this.prevMessages.push(...convertedMessages);

      let responseMessage: ThreadMessageLike =
        afterToolCall && message
          ? cloneDeep(message)
          : { role: "assistant", content: [] };

      let isFinished = false;

      for await (const event of stream) {
        // Process all chunks in this event
        for (const chunk of event.choices) {
          if (isFinished) break;

          if (chunk.finish_reason) {
            isFinished = true;
            const finalMsg = afterToolCall
              ? filterAfterToolCallContent(responseMessage, message)
              : responseMessage;
            this.prevMessages.push(...convertMessagesToModelFormat([finalMsg]));
            break;
          }

          responseMessage = processChunk(chunk, responseMessage, afterToolCall);
        }

        // Handle stop flag
        if (this.stopFlag) {
          if (hasContent(responseMessage)) {
            this.prevMessages.push(
              ...convertMessagesToModelFormat([responseMessage])
            );
          }
          stream.controller.abort();
          this.stopFlag = false;
          yield { isEnd: true, responseMessage };
          return;
        }

        // Yield current state
        if (isFinished) {
          yield { isEnd: true, responseMessage };
        } else {
          yield responseMessage;
        }
      }
    } catch (e) {
      console.error("Together sendMessage error:", e);
      yield createErrorResponse(e);
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
