import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Tools } from "together-ai/resources";
import type { CompletionCreateParams } from "together-ai/resources/chat/completions";
import type { TMCPItem } from "@/lib/types";

export type TogetherMessageParam = CompletionCreateParams["messages"][number];

/**
 * Converts MCP tools to Together AI tool format.
 */
export const convertToolsToModelFormat = (tools: TMCPItem[]): Tools[] =>
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        ...tool.inputSchema,
      },
    },
  }));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts filename from a file path (handles both Unix and Windows paths).
 */
const extractFilename = (path: string): string => {
  const separator = path.includes("\\") ? "\\" : "/";
  return path.split(separator).pop() ?? path;
};

/**
 * Converts a content part to string representation.
 */
const convertContentPartToString = (
  part: Exclude<ThreadMessageLike["content"], string>[number]
): string => {
  if (part.type === "text") return part.text;

  if (part.type === "file") {
    const path = JSON.parse(part.mimeType).path;
    return `File: ${extractFilename(path)}\nFile content:\n${part.data}`;
  }

  return "";
};

/**
 * Converts user/system message content to string.
 */
const convertUserContent = (message: ThreadMessageLike): string => {
  if (typeof message.content === "string") return message.content;

  return message.content
    .map(convertContentPartToString)
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Converts assistant message to Together format.
 * Returns the assistant message and any tool result messages.
 */
const convertAssistantMessage = (
  message: ThreadMessageLike
): TogetherMessageParam[] => {
  const results: TogetherMessageParam[] = [];

  if (typeof message.content === "string") {
    results.push({ role: "assistant", content: message.content });
    return results;
  }

  let content = "";
  const toolCalls: CompletionCreateParams.ChatCompletionAssistantMessageParam["tool_calls"] =
    [];
  const toolResults: CompletionCreateParams.ChatCompletionToolMessageParam[] =
    [];

  message.content.forEach((part, idx) => {
    if (part.type === "text") {
      content += part.text;
    } else if (part.type === "tool-call") {
      const callId = part.toolCallId ?? new Date().toISOString();

      toolCalls.push({
        id: callId,
        index: idx,
        type: "function",
        function: { arguments: part.argsText ?? "", name: part.toolName },
      });

      if (part.result) {
        toolResults.push({
          role: "tool",
          content: part.result,
          tool_call_id: callId,
        });
      }
    }
  });

  const assistantMsg: CompletionCreateParams.ChatCompletionAssistantMessageParam =
    { role: "assistant", content };

  if (toolCalls.length) assistantMsg.tool_calls = toolCalls;

  results.push(assistantMsg, ...toolResults);
  return results;
};

// ============================================================================
// Main Converter
// ============================================================================

/**
 * Converts thread messages to Together AI message format.
 */
export const convertMessagesToModelFormat = (
  messages: ThreadMessageLike[]
): TogetherMessageParam[] => {
  const result: TogetherMessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user" || message.role === "system") {
      result.push({ role: "user", content: convertUserContent(message) });
    } else {
      result.push(...convertAssistantMessage(message));
    }
  }

  return result;
};
