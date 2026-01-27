import type { ThreadMessageLike } from "@assistant-ui/react";
import { Mistral } from "@mistralai/mistralai";
import cloneDeep from "lodash.clonedeep";
import type { ToolCallPart } from "./types";

export const createClient = (apiKey?: string, baseUrl?: string): Mistral => {
  return new Mistral({
    apiKey: apiKey ?? "",
    serverURL: baseUrl,
  });
};

export const createEmptyResponse = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

export const createErrorResponse = (error: unknown): ThreadMessageLike => ({
  role: "assistant",
  content: [
    {
      type: "text",
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
    },
  ],
});

export const createResponseShell = (
  afterToolCall?: boolean,
  existingMessage?: ThreadMessageLike
): ThreadMessageLike => {
  if (afterToolCall && existingMessage) {
    return cloneDeep(existingMessage);
  }
  return createEmptyResponse();
};

export const getLastToolCall = (
  message: ThreadMessageLike
): ToolCallPart | undefined => {
  if (typeof message.content === "string") return undefined;

  for (let i = message.content.length - 1; i >= 0; i -= 1) {
    const part = message.content[i];
    if (part.type === "tool-call") {
      return part as ToolCallPart;
    }
  }
  return undefined;
};
