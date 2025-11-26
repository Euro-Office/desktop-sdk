import type Anthropic from "@anthropic-ai/sdk";
import type {
  TextMessagePart,
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";

type ContentArray = (TextMessagePart | ToolCallMessagePart)[];

// ============================================================================
// Helpers
// ============================================================================

const cloneMessage = (message: ThreadMessageLike): ThreadMessageLike => ({
  ...message,
  content: Array.isArray(message.content)
    ? [...message.content]
    : message.content,
});

const getContentArray = (message: ThreadMessageLike): ContentArray | null =>
  Array.isArray(message.content) ? message.content : null;

const getLastContent = (content: ContentArray) => content[content.length - 1];

// ============================================================================
// Content Block Start Handlers
// ============================================================================

const createTextPart = (text: string): TextMessagePart => ({
  type: "text",
  text,
});

const createToolCallPart = (id: string, name: string): ToolCallMessagePart => ({
  type: "tool-call",
  toolCallId: id,
  toolName: name,
  args: {},
  argsText: "",
});

const handleTextBlockStart = (
  block: Anthropic.Messages.TextBlock,
  content: ContentArray
): void => {
  content.push(createTextPart(block.text));
};

const handleToolUseBlockStart = (
  block: Anthropic.Messages.ToolUseBlock,
  content: ContentArray
): void => {
  content.push(createToolCallPart(block.id, block.name));
};

// ============================================================================
// Content Block Delta Handlers
// ============================================================================

const handleTextDelta = (
  delta: Anthropic.Messages.TextDelta,
  content: ContentArray
): void => {
  const last = getLastContent(content);
  if (last?.type !== "text") return;

  content[content.length - 1] = createTextPart(last.text + delta.text);
};

const tryParseJson = (text: string): ToolCallMessagePart["args"] => {
  if (!text.trim().endsWith("}")) return {};
  try {
    return JSON.parse(text) as ToolCallMessagePart["args"];
  } catch {
    return {};
  }
};

const handleInputJsonDelta = (
  delta: Anthropic.Messages.InputJSONDelta,
  content: ContentArray
): void => {
  const last = getLastContent(content);
  if (last?.type !== "tool-call") return;

  const argsText = last.argsText + delta.partial_json;

  content[content.length - 1] = {
    ...last,
    args: tryParseJson(argsText),
    argsText,
  };
};

// ============================================================================
// Exported Handlers
// ============================================================================

export const handleMessageStart = (
  event: Anthropic.Messages.RawMessageStartEvent
): ThreadMessageLike => ({
  role: event.message.role,
  content: [],
});

export const handleContentBlockStart = (
  event: Anthropic.Messages.ContentBlockStartEvent,
  prevMessage: ThreadMessageLike
): ThreadMessageLike => {
  const message = cloneMessage(prevMessage);
  const content = getContentArray(message);

  if (!content) return message;

  const { content_block } = event;

  if (content_block.type === "text") {
    handleTextBlockStart(content_block, content);
  } else if (content_block.type === "tool_use") {
    handleToolUseBlockStart(content_block, content);
  }

  return message;
};

export const handleContentBlockDelta = (
  event: Anthropic.Messages.RawContentBlockDeltaEvent,
  prevMessage: ThreadMessageLike
): ThreadMessageLike => {
  const message = cloneMessage(prevMessage);
  const content = getContentArray(message);

  if (!content) return message;

  const { delta } = event;

  if (delta.type === "text_delta") {
    handleTextDelta(delta, content);
  } else if (delta.type === "input_json_delta") {
    handleInputJsonDelta(delta, content);
  }

  return message;
};
