import type { ThreadMessageLike } from "@assistant-ui/react";
import cloneDeep from "lodash.clonedeep";
import {
  type ListResponse,
  type Message,
  Ollama,
  type Tool,
} from "ollama/browser";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { CREATE_TITLE_SYSTEM_PROMPT } from "../prompts";
import { handleToolCall, type ToolCallResult } from "./handlers";
import { ollamaInfo } from "./info";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
  convertToolsToString,
} from "./utils";

// ============================================================================
// Helper Types
// ============================================================================

type ContentPart = { type: "text"; text: string } | { type: "tool-call" };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Updates response message content based on tool call parsing result.
 * Handles text content and tool call transitions during streaming.
 */
const updateMessageContent = (
  content: ContentPart[],
  result: ToolCallResult
): void => {
  const { content: textContent, toolContent } = result;
  const lastPart = content[content.length - 1];
  const lastIsToolCall = lastPart?.type === "tool-call";

  // Empty content - add first text part
  if (content.length === 0) {
    content.push({ type: "text", text: textContent });
    return;
  }

  // Has tool content
  if (toolContent) {
    if (lastIsToolCall) {
      // Update existing tool call
      content[content.length - 1] = toolContent;
    } else {
      // Update text, then add tool call
      content[content.length - 1] = { type: "text", text: textContent };
      content.push(toolContent);
    }
    return;
  }

  // Text only - update or add text part
  if (lastIsToolCall) {
    content.push({ type: "text", text: textContent });
  } else {
    content[content.length - 1] = { type: "text", text: textContent };
  }
};

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
    status: {
      type: "incomplete",
      reason: "error",
      error,
    },
  } as ThreadMessageLike,
});

class OllamaProvider extends AbstractBaseProvider<Tool, Message, Ollama> {
  setProvider = (provider: TProvider) => {
    this.provider = provider;

    this.client = new Ollama({
      host: provider.baseUrl,
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

      const systemMsg = {
        role: "system",
        content: CREATE_TITLE_SYSTEM_PROMPT,
      };

      const response = await this.client.chat({
        messages: [systemMsg, { role: "user", content: message }],
        model: this.modelKey,
        stream: false,
      });

      const title = response.message.content;

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

      const toolsString = convertToolsToString(this.tools);

      const systemMsg = {
        role: "system",
        content: this.systemPrompt + toolsString,
      };

      const response = await this.client.chat({
        model: this.modelKey,
        messages: [systemMsg, ...this.prevMessages, ...convertedMessages],
        stream: true,
      });

      this.prevMessages.push(...convertedMessages);

      const responseMessage: ThreadMessageLike =
        afterToolCall && message
          ? cloneDeep(message)
          : {
              role: "assistant",
              content: [],
            };

      let msg = "";

      for await (const part of response) {
        msg += part.message.content;

        const result = handleToolCall(msg);

        if (Array.isArray(responseMessage.content)) {
          updateMessageContent(
            responseMessage.content as ContentPart[],
            result
          );
        }

        if (part.done) {
          this.prevMessages.push({
            role: "assistant",
            content: msg,
          });

          yield {
            isEnd: true,
            responseMessage,
          };
        }

        if (this.stopFlag) {
          this.stopFlag = false;

          this.prevMessages.push({
            role: "assistant",
            content: msg,
          });

          yield { isEnd: true, responseMessage };

          this.client.abort();

          continue;
        }

        yield responseMessage;
      }
    } catch (e) {
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

    const toolResultStr: string = JSON.stringify({
      name: result.toolName,
      result: result.result,
    });

    this.prevMessages.push({
      role: "user",
      content: toolResultStr,
    });

    yield* this.sendMessage([], true, message);

    return message;
  }

  getName = () => {
    return ollamaInfo.name;
  };

  getBaseUrl = () => {
    return ollamaInfo.baseUrl;
  };

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const checkClient = new Ollama({
      host: data.url,
    });

    try {
      await checkClient.list();

      return true;
    } catch {
      return ProviderErrors.invalidUrl();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const newClient = new Ollama({
      host: data.url,
    });

    const response: ListResponse = await newClient.list();

    return response.models.map((model) => ({
      id: model.model,
      name: ollamaInfo.modelNames[model.model] || model.name,
      provider: "ollama" as const,
    }));
  };
}

const ollamaProvider = new OllamaProvider();

export { OllamaProvider, ollamaProvider };
