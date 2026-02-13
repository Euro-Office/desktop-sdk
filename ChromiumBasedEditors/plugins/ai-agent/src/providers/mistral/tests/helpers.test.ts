import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";
import {
  createClient,
  createEmptyResponse,
  createErrorResponse,
  createResponseShell,
  getLastToolCall,
} from "../helpers";

// Mock the Mistral SDK
vi.mock("@mistralai/mistralai", () => {
  return {
    Mistral: class MockMistral {
      apiKey: string;
      serverURL: string | undefined;
      constructor(config: { apiKey: string; serverURL?: string }) {
        this.apiKey = config.apiKey;
        this.serverURL = config.serverURL;
      }
    },
  };
});

describe("mistral helpers", () => {
  // ==========================================================================
  // createClient
  // ==========================================================================

  describe("createClient", () => {
    it("should create client with apiKey and baseUrl", () => {
      const client = createClient("test-api-key", "https://api.mistral.ai");

      expect(client).toBeDefined();
    });

    it("should create client with empty apiKey when not provided", () => {
      const client = createClient(undefined, "https://api.mistral.ai");

      expect(client).toBeDefined();
    });

    it("should create client with undefined serverURL", () => {
      const client = createClient("test-key", undefined);

      expect(client).toBeDefined();
    });

    it("should create client with no arguments", () => {
      const client = createClient();

      expect(client).toBeDefined();
    });
  });

  // ==========================================================================
  // createEmptyResponse
  // ==========================================================================

  describe("createEmptyResponse", () => {
    it("should create empty assistant response", () => {
      const result = createEmptyResponse();

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });
  });

  // ==========================================================================
  // createErrorResponse
  // ==========================================================================

  describe("createErrorResponse", () => {
    it("should create error response from Error instance", () => {
      const error = new Error("Something went wrong");
      const result = createErrorResponse(error);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Error: Something went wrong",
          },
        ],
      });
    });

    it("should create error response from string", () => {
      const result = createErrorResponse("String error");

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Error: String error",
          },
        ],
      });
    });

    it("should create error response from object", () => {
      const result = createErrorResponse({
        code: 500,
        message: "Server error",
      });

      expect(result.content).toHaveLength(1);
      expect(
        (result.content as unknown as Array<{ text: string }>)[0].text
      ).toContain("Error:");
    });

    it("should create error response from null", () => {
      const result = createErrorResponse(null);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Error: null",
          },
        ],
      });
    });

    it("should create error response from undefined", () => {
      const result = createErrorResponse(undefined);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Error: undefined",
          },
        ],
      });
    });
  });

  // ==========================================================================
  // createResponseShell
  // ==========================================================================

  describe("createResponseShell", () => {
    it("should return empty response when afterToolCall is false", () => {
      const result = createResponseShell(false, undefined);

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });

    it("should return empty response when existingMessage is undefined", () => {
      const result = createResponseShell(true, undefined);

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });

    it("should return cloned existing message when afterToolCall and existingMessage provided", () => {
      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = createResponseShell(true, existingMessage);

      expect(result).toEqual(existingMessage);
      expect(result).not.toBe(existingMessage); // Should be a clone
    });

    it("should return empty response when called with no arguments", () => {
      const result = createResponseShell();

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });
  });

  // ==========================================================================
  // getLastToolCall
  // ==========================================================================

  describe("getLastToolCall", () => {
    it("should return undefined for string content", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "Just text",
      };

      const result = getLastToolCall(message);

      expect(result).toBeUndefined();
    });

    it("should return undefined when no tool calls exist", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = getLastToolCall(message);

      expect(result).toBeUndefined();
    });

    it("should return the last tool call", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_1",
            toolName: "first_tool",
            args: {},
            argsText: "{}",
          },
          { type: "text", text: "Some text" },
          {
            type: "tool-call",
            toolCallId: "tool_2",
            toolName: "last_tool",
            args: { key: "value" },
            argsText: '{"key":"value"}',
          },
        ],
      };

      const result = getLastToolCall(message);

      expect(result).toBeDefined();
      expect(result?.toolCallId).toBe("tool_2");
      expect(result?.toolName).toBe("last_tool");
    });

    it("should return tool call when it is the only content", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_only",
            toolName: "single_tool",
            args: {},
            argsText: "{}",
          },
        ],
      };

      const result = getLastToolCall(message);

      expect(result?.toolCallId).toBe("tool_only");
    });

    it("should return undefined for empty content array", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = getLastToolCall(message);

      expect(result).toBeUndefined();
    });
  });
});
