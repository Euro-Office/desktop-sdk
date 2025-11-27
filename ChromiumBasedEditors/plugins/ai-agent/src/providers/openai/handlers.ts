import type {
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

/**
 * Handles incoming text content from a streaming chunk.
 * Appends or creates text parts in the response message.
 *
 * @param responseMessage - The current response being built
 * @param chunk - The streaming chunk containing new text
 * @param afterToolCall - If true, always creates a new text part after tool calls
 *                        (prevents appending to pre-tool-call text)
 */
export const handleTextMessage = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice,
  afterToolCall?: boolean
): ThreadMessageLike => {
  const delta = chunk.delta.content;
  if (!delta) return responseMessage;
  if (!Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  // Case 1: Empty content - create first text part
  if (!lastPart) {
    content.push({ type: "text", text: delta });
  }
  // Case 2: Last part is text - append to it
  else if (lastPart.type === "text") {
    content[content.length - 1] = { ...lastPart, text: lastPart.text + delta };
  }
  // Case 3: After tool call - create new text part
  // (don't append to tool-call parts, start fresh text after tool response)
  else if (afterToolCall) {
    content.push({ type: "text", text: delta });
  }

  return { ...responseMessage, content };
};

/**
 * Creates a new tool-call message part from a streaming delta.
 */
const createToolCallPart = (
  delta?: ChatCompletionChunk.Choice["delta"]
): ToolCallMessagePart =>
  ({
    type: "tool-call",
    args: {},
    argsText: delta?.tool_calls?.[0]?.function?.arguments ?? "",
    toolName: delta?.tool_calls?.[0]?.function?.name ?? "",
    toolCallId: delta?.tool_calls?.[0]?.id ?? "",
  }) as ToolCallMessagePart;

/**
 * Merges new tool call data into an existing tool-call part.
 * Tool calls stream incrementally, so we accumulate the arguments text
 * and attempt to parse them as JSON when complete.
 */
const mergeToolCall = (
  existing: ToolCallMessagePart,
  delta?: ChatCompletionChunk.Choice["delta"]
): ToolCallMessagePart => {
  const update = delta?.tool_calls?.[0];
  const argsText = existing.argsText + (update?.function?.arguments ?? "");

  // Attempt to parse accumulated arguments as JSON
  let parsedArgs = {};
  try {
    parsedArgs = JSON.parse(argsText || "{}");
  } catch {
    // Arguments still incomplete, keep empty args until fully received
  }

  return {
    ...existing,
    args: parsedArgs,
    argsText,
    toolName: existing.toolName || update?.function?.name || "",
    toolCallId: existing.toolCallId || update?.id || "",
  };
};

/**
 * Handles incoming tool call data from a streaming chunk.
 * Either creates a new tool-call part or merges into the existing one.
 *
 * @param responseMessage - The current response being built
 * @param chunk - The streaming chunk containing tool call data
 */
export const handleToolCall = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice
): ThreadMessageLike => {
  const delta = chunk.delta.tool_calls;
  if (!delta || !Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  // Create new tool-call or merge into existing
  if (!lastPart || lastPart.type !== "tool-call") {
    content.push(createToolCallPart(chunk.delta));
  } else {
    content[content.length - 1] = mergeToolCall(lastPart, chunk.delta);
  }

  return { ...responseMessage, content };
};
