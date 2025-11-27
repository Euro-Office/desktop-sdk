import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import type { TMCPItem } from "@/lib/types";

export type GenAIMessageParam = Content;

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

// ============================================================================
// Tools Conversion
// ============================================================================

/**
 * Converts MCP tools to Google GenAI function declaration format.
 */
export const convertToolsToModelFormat = (
  tools: TMCPItem[]
): FunctionDeclaration[] =>
  tools.map(
    (tool) =>
      ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "OBJECT",
          ...tool.inputSchema,
        },
      }) as FunctionDeclaration
  );

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * Converts user/system message content to GenAI parts.
 */
const convertUserContent = (message: ThreadMessageLike): Part[] => {
  if (typeof message.content === "string") {
    return [{ text: message.content }];
  }

  const parts: Part[] = [];
  for (const part of message.content) {
    const text = convertContentPartToString(part);
    if (text) {
      parts.push({ text });
    }
  }
  return parts;
};

/**
 * Converts assistant message to GenAI format.
 * Returns the model content and any function response contents.
 */
const convertAssistantMessage = (
  message: ThreadMessageLike
): GenAIMessageParam[] => {
  const results: GenAIMessageParam[] = [];

  if (typeof message.content === "string") {
    if (message.content) {
      results.push({ role: "model", parts: [{ text: message.content }] });
    }
    return results;
  }

  const parts: Part[] = [];
  const functionResponses: Part[] = [];

  for (const part of message.content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
    } else if (part.type === "tool-call") {
      // Get thought_signature from metadata if available (for Gemini 3)
      const metadata = (
        part as unknown as { metadata?: { thoughtSignature?: string } }
      ).metadata;
      const thoughtSignature = metadata?.thoughtSignature;

      // Add function call with thought_signature if present
      parts.push({
        functionCall: {
          name: part.toolName,
          args: part.args as Record<string, unknown>,
        },
        ...(thoughtSignature && { thoughtSignature }),
      } as Part);

      // Add function response if result exists
      if (part.result) {
        functionResponses.push({
          functionResponse: {
            name: part.toolName,
            response: { result: part.result },
          },
        });
      }
    }
  }

  if (parts.length) {
    results.push({ role: "model", parts });
  }

  if (functionResponses.length) {
    results.push({ role: "user", parts: functionResponses });
  }

  return results;
};

// ============================================================================
// Main Converter
// ============================================================================

/**
 * Converts thread messages to Google GenAI content format.
 */
export const convertMessagesToModelFormat = (
  messages: ThreadMessageLike[]
): GenAIMessageParam[] => {
  const result: GenAIMessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user" || message.role === "system") {
      result.push({ role: "user", parts: convertUserContent(message) });
    } else {
      result.push(...convertAssistantMessage(message));
    }
  }

  return result;
};
