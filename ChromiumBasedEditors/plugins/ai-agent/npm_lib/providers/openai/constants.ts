import type { ThreadMessageLike } from "@assistant-ui/react";

/**
 * Generates a fallback tool call ID using current timestamp.
 * Used when the API doesn't provide a tool call ID.
 */
export const generateFallbackToolCallId = (): string =>
  new Date().toISOString();

/**
 * Creates an empty assistant response shell for building streaming responses.
 */
export const createEmptyResponse = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

/**
 * Creates an error response when the stream fails.
 */
export const createErrorResponse = (error: unknown): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: {
      type: "incomplete",
      reason: "error",
      error,
    },
  }) as ThreadMessageLike;
