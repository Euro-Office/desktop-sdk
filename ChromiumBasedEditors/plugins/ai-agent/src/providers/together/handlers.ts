import type {
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { ChatCompletionChunk } from "together-ai/resources/chat/completions";

// Type alias for tool call delta
type ToolCallDelta = NonNullable<
  ChatCompletionChunk.Choice["delta"]["tool_calls"]
>[number];

/**
 * Handles incoming text content from a streaming chunk.
 * Appends or creates text parts in the response message.
 */
export const handleTextMessage = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice,
  afterToolCall?: boolean
): ThreadMessageLike => {
  const delta = chunk.delta.content;
  if (!delta) return responseMessage;

  const content = responseMessage.content;
  if (typeof content === "string") return responseMessage;

  const newContent = [...content];
  const lastPart = newContent[newContent.length - 1];

  // No content yet or after tool call - add new text part
  if (!lastPart || afterToolCall) {
    newContent.push({ type: "text", text: delta });
  }
  // Last part is text - append to it
  else if (lastPart.type === "text") {
    newContent[newContent.length - 1] = {
      ...lastPart,
      text: lastPart.text + delta,
    };
  }

  return { ...responseMessage, content: newContent };
};

/**
 * Safely parses JSON, returning empty object on failure.
 */
const parseArgs = (argsText: string): Record<string, unknown> => {
  try {
    return JSON.parse(argsText || "{}");
  } catch {
    return {};
  }
};

/**
 * Creates a new tool call part from chunk delta.
 */
const createToolCallPart = (delta: ToolCallDelta): ToolCallMessagePart =>
  ({
    type: "tool-call",
    args: {},
    argsText: delta?.function?.arguments ?? "",
    toolName: delta?.function?.name ?? "",
    toolCallId: delta?.id ?? "",
  }) as ToolCallMessagePart;

/**
 * Merges tool call delta into existing tool call part.
 */
const mergeToolCall = (
  existing: ToolCallMessagePart,
  delta: ToolCallDelta
): ToolCallMessagePart => {
  const argsText = existing.argsText + (delta?.function?.arguments ?? "");

  return {
    ...existing,
    args: parseArgs(argsText),
    argsText,
    toolName: existing.toolName || delta?.function?.name || "",
    toolCallId: existing.toolCallId || delta?.id || "",
  } as ToolCallMessagePart;
};

/**
 * Handles incoming tool call from a streaming chunk.
 * Creates new or merges into existing tool call part.
 */
export const handleToolCall = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice
): ThreadMessageLike => {
  const delta = chunk.delta.tool_calls?.[0];
  if (!delta) return responseMessage;

  const content = responseMessage.content;
  if (typeof content === "string") return responseMessage;

  const newContent = [...content];
  const lastPart = newContent[newContent.length - 1];

  // Create new tool call or merge into existing
  if (!lastPart || lastPart.type !== "tool-call") {
    newContent.push(createToolCallPart(delta));
  } else {
    // Type assertion safe: we verified lastPart.type === "tool-call"
    newContent[newContent.length - 1] = mergeToolCall(
      lastPart as ToolCallMessagePart,
      delta
    );
  }

  return { ...responseMessage, content: newContent };
};
