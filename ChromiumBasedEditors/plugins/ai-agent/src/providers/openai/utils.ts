import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import type { TMCPItem } from "@/lib/types";
import { generateFallbackToolCallId } from "./constants";

// ============================================
// Tool Conversion
// ============================================

/**
 * Converts MCP tools to OpenAI's tool format.
 */
export const convertToolsToModelFormat = (
  tools: TMCPItem[]
): ChatCompletionTool[] =>
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: { ...tool.inputSchema },
    },
  }));

// ============================================
// Message Content Conversion
// ============================================

/**
 * Converts user message content to OpenAI format.
 * Handles text and file parts.
 */
const convertUserContent = (
  content: ThreadMessageLike["content"]
): string | ChatCompletionContentPart[] => {
  if (typeof content === "string") return content;

  return content.map((part): ChatCompletionContentPart => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }

    if (part.type === "file") {
      const meta = JSON.parse(part.mimeType);
      return {
        type: "text",
        text: JSON.stringify({
          file_data: part.data,
          filename: meta.path,
          file_id: meta.path,
        }),
      };
    }

    // Fallback for unknown part types
    return { type: "text", text: "" };
  });
};

// ============================================
// Assistant Message Processing
// ============================================

/** Result of processing assistant message parts */
interface ProcessedAssistantParts {
  content: ChatCompletionAssistantMessageParam["content"];
  toolCalls: ChatCompletionMessageFunctionToolCall[];
  toolResults: ChatCompletionToolMessageParam[];
}

/**
 * Processes assistant message parts into OpenAI format.
 * Separates text content, tool calls, and tool results.
 */
const processAssistantParts = (
  message: ThreadMessageLike
): ProcessedAssistantParts => {
  // Handle simple string content
  if (typeof message.content === "string") {
    return { content: message.content, toolCalls: [], toolResults: [] };
  }

  const content: ChatCompletionAssistantMessageParam["content"] = [];
  const toolCalls: ChatCompletionMessageFunctionToolCall[] = [];
  const toolResults: ChatCompletionToolMessageParam[] = [];

  for (const part of message.content) {
    // Handle text parts
    if (part.type === "text") {
      content.push({ type: "text", text: part.text });
      continue;
    }

    // Skip non-tool-call parts
    if (part.type !== "tool-call") continue;

    // Collect tool result if present
    if (part.result) {
      toolResults.push({
        role: "tool",
        content: part.result,
        tool_call_id: part.toolCallId ?? generateFallbackToolCallId(),
      });
    }

    // Collect tool call
    toolCalls.push({
      id: part.toolCallId ?? generateFallbackToolCallId(),
      type: "function",
      function: {
        arguments: part.argsText ?? "",
        name: part.toolName,
      },
    });
  }

  return { content, toolCalls, toolResults };
};

// ============================================
// Message Array Conversion
// ============================================

/**
 * Converts ThreadMessageLike messages to OpenAI's message format.
 * Handles user, system, and assistant messages with tool calls.
 */
export const convertMessagesToModelFormat = (
  messages: ThreadMessageLike[]
): ChatCompletionMessageParam[] => {
  const result: ChatCompletionMessageParam[] = [];

  for (const message of messages) {
    // Handle user and system messages (system converted to user for API compatibility)
    if (message.role === "user" || message.role === "system") {
      const role = message.role === "system" ? "user" : message.role;
      result.push({
        role,
        content: convertUserContent(message.content),
      } as ChatCompletionMessageParam);
      continue;
    }

    // Handle assistant messages
    const { content, toolCalls, toolResults } = processAssistantParts(message);

    const assistantMessage: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content,
    };

    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls;
    }

    result.push(assistantMessage);

    // Append tool results after assistant message
    if (toolResults.length > 0) {
      result.push(...toolResults);
    }
  }

  return result;
};
