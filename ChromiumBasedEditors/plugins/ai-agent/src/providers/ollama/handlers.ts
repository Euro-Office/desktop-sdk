import type { ToolCallMessagePart } from "@assistant-ui/react";
import { END_TOOL_TAG, START_TOOL_TAG } from "./utils";

// ============================================================================
// Types
// ============================================================================

export interface ToolCallResult {
  content: string;
  toolContent?: ToolCallMessagePart;
}

interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if content contains a tool call start tag
 */
export const hasToolCallTag = (content: string): boolean => {
  return content.includes(START_TOOL_TAG);
};

/**
 * Checks if content contains a complete tool call (both start and end tags)
 */
export const isToolCallComplete = (content: string): boolean => {
  return content.includes(START_TOOL_TAG) && content.includes(END_TOOL_TAG);
};

/**
 * Extracts the text content before the tool call tag
 */
export const extractContentBeforeToolCall = (content: string): string => {
  return content.split(START_TOOL_TAG)[0];
};

/**
 * Extracts the raw tool call JSON string from between the tags
 */
export const extractToolCallJson = (
  content: string,
  isComplete: boolean
): string => {
  const afterStartTag = content.split(START_TOOL_TAG)[1] ?? "";
  if (isComplete) {
    return afterStartTag.split(END_TOOL_TAG)[0];
  }
  return afterStartTag;
};

/**
 * Safely parses tool call JSON, returning null on failure
 */
export const parseToolCallJson = (jsonStr: string): ParsedToolCall | null => {
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      name: parsed.name ?? "",
      args: parsed.args ?? {},
    };
  } catch {
    return null;
  }
};

/**
 * Creates a complete tool call message part from parsed data
 */
export const createCompleteToolContent = (
  parsed: ParsedToolCall,
  argsText: string
): ToolCallMessagePart =>
  ({
    type: "tool-call",
    toolCallId: "",
    toolName: parsed.name,
    args: parsed.args,
    argsText,
  }) as ToolCallMessagePart;

/**
 * Creates an incomplete/streaming tool call message part
 */
export const createIncompleteToolContent = (
  argsText: string
): ToolCallMessagePart =>
  ({
    type: "tool-call",
    toolCallId: "",
    toolName: "",
    args: {},
    argsText,
  }) as ToolCallMessagePart;

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Parses content for tool calls and extracts tool call data if present.
 * Handles both complete and streaming (incomplete) tool calls.
 */
export const handleToolCall = (content: string): ToolCallResult => {
  // No tool call present
  if (!hasToolCallTag(content)) {
    return { content };
  }

  const isComplete = isToolCallComplete(content);
  const textContent = extractContentBeforeToolCall(content);
  const toolCallJson = extractToolCallJson(content, isComplete);

  // Complete tool call - parse and create full tool content
  if (isComplete) {
    const parsed = parseToolCallJson(toolCallJson);
    if (parsed) {
      return {
        content: textContent,
        toolContent: createCompleteToolContent(parsed, toolCallJson),
      };
    }
  }

  // Incomplete tool call (streaming) - return partial tool content
  return {
    content: textContent,
    toolContent: createIncompleteToolContent(toolCallJson),
  };
};
