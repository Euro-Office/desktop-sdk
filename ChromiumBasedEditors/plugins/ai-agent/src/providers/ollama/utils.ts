import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Message, Tool } from "ollama/browser";
import type { TMCPItem } from "@/lib/types";

// ============================================================================
// Constants
// ============================================================================

export const START_TOOL_TAG = "<TOOL_CALL>";
export const END_TOOL_TAG = "</TOOL_CALL>";

// ============================================================================
// Tool Conversion
// ============================================================================

/**
 * Converts MCP tools to Ollama tool format
 */
export const convertToolsToModelFormat = (tools: TMCPItem[]): Tool[] => {
  return tools.map((tool) => ({
    type: "string",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
};

/**
 * Builds the tool usage instructions string for the system prompt
 */
export const convertToolsToString = (tools: Tool[]): string => {
  const toolsJson = JSON.stringify(tools);
  const exampleJson = JSON.stringify({
    name: "toolName",
    args: { arg1: "arg1", arg2: "arg2" },
  });

  return [
    "\n\nAvailable tools:\n\n",
    toolsJson,
    "\n\n When you call a tool, output must look EXACTLY like this: \n",
    `${START_TOOL_TAG}\n${exampleJson}\n${END_TOOL_TAG}`,
    "\n\n Do not add explanations, markdown, or extra text outside the tags.",
  ].join("");
};

// ============================================================================
// Message Content Helpers
// ============================================================================

/**
 * Extracts filename from a file path (handles both Unix and Windows paths)
 */
export const extractFilename = (path: string): string => {
  const separator = path.includes("\\") ? "\\" : "/";
  return path.split(separator).pop() ?? path;
};

/**
 * Formats a file attachment as a readable string
 */
export const formatFileContent = (path: string, data: string): string => {
  const filename = extractFilename(path);
  return `File: ${filename}\nFile content:\n${data}`;
};

/**
 * Converts a single content part to a string
 */
export const convertContentPartToString = (
  part: Exclude<ThreadMessageLike["content"], string>[number]
): string => {
  if (part.type === "text") {
    return part.text;
  }

  if (part.type === "file") {
    const path = JSON.parse(part.mimeType).path;
    return formatFileContent(path, part.data);
  }

  return "";
};

// ============================================================================
// Message Type Converters
// ============================================================================

/**
 * Converts a user message to Ollama format
 */
export const convertUserMessage = (message: ThreadMessageLike): Message => {
  const content =
    typeof message.content === "string"
      ? message.content
      : message.content
          .map(convertContentPartToString)
          .filter((part) => part !== "")
          .join("\n\n");

  return { role: "user", content };
};

/**
 * Converts a system message to Ollama format (as user role)
 */
export const convertSystemMessage = (message: ThreadMessageLike): Message => {
  const content =
    typeof message.content === "string"
      ? message.content
      : (message.content.find((part) => part.type === "text")?.text ?? "");

  return { role: "user", content };
};

/**
 * Result of converting an assistant message
 */
interface AssistantMessageResult {
  assistantMessage: Message;
  toolResultMessage?: Message;
}

/**
 * Converts an assistant message to Ollama format
 * Returns both the assistant message and optional tool result message
 */
export const convertAssistantMessage = (
  message: ThreadMessageLike
): AssistantMessageResult => {
  if (typeof message.content === "string") {
    return {
      assistantMessage: { role: "assistant", content: message.content },
    };
  }

  let toolResultContent = "";

  const content = message.content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      if (part.type === "tool-call") {
        // Capture tool result for separate message
        toolResultContent = JSON.stringify({
          name: part.toolName,
          result: part.result,
        });

        return `${START_TOOL_TAG}${part.argsText}${END_TOOL_TAG}`;
      }

      return "";
    })
    .join("");

  const result: AssistantMessageResult = {
    assistantMessage: { role: "assistant", content },
  };

  if (toolResultContent) {
    result.toolResultMessage = {
      role: "user",
      content: `${toolResultContent}\n`,
    };
  }

  return result;
};

// ============================================================================
// Main Converter
// ============================================================================

/**
 * Converts thread messages to Ollama message format
 */
export const convertMessagesToModelFormat = (
  messages: ThreadMessageLike[]
): Message[] => {
  const convertedMessages: Message[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      convertedMessages.push(convertUserMessage(message));
    } else if (message.role === "system") {
      convertedMessages.push(convertSystemMessage(message));
    } else {
      const { assistantMessage, toolResultMessage } =
        convertAssistantMessage(message);
      convertedMessages.push(assistantMessage);

      if (toolResultMessage) {
        convertedMessages.push(toolResultMessage);
      }
    }
  }

  return convertedMessages;
};
