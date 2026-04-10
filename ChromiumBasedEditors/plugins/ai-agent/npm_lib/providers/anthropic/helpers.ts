import Anthropic from "@anthropic-ai/sdk";
import type { ThreadMessageLike } from "@assistant-ui/react";
import cloneDeep from "lodash.clonedeep";
import type { StreamResult } from "./types";

// =============================================================================
// Client
// =============================================================================

export const createClient = (apiKey?: string, baseURL?: string): Anthropic =>
  new Anthropic({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });

// =============================================================================
// Stream Result Factories
// =============================================================================

export const createEndResult = (
  responseMessage: ThreadMessageLike
): StreamResult => ({
  isEnd: true,
  responseMessage,
});

export const createErrorResult = (error: unknown): StreamResult => ({
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

// =============================================================================
// Message Helpers
// =============================================================================

export const createInitialResponse = (
  afterToolCall: boolean | undefined,
  message: ThreadMessageLike | undefined
): ThreadMessageLike =>
  afterToolCall && message
    ? cloneDeep(message)
    : { role: "assistant", content: [] };

export const getLastToolCall = (message: ThreadMessageLike) => {
  if (typeof message.content === "string") return null;

  return message.content.filter((c) => c.type === "tool-call").at(-1) ?? null;
};
