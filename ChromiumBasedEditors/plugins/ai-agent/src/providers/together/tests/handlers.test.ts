import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "together-ai/resources/chat/completions";
import { describe, expect, it } from "vitest";
import { handleTextMessage, handleToolCall } from "../handlers";

// =============================================================================
// Test Helpers
// =============================================================================

const createTextChunk = (content: string): ChatCompletionChunk.Choice =>
  ({
    index: 0,
    delta: { content },
    finish_reason: null,
  }) as ChatCompletionChunk.Choice;

const createToolCallChunk = (
  id: string,
  name: string,
  args: string
): ChatCompletionChunk.Choice =>
  ({
    index: 0,
    delta: {
      tool_calls: [
        {
          index: 0,
          id,
          type: "function",
          function: { name, arguments: args },
        },
      ],
    },
    finish_reason: null,
  }) as ChatCompletionChunk.Choice;

describe("together handlers", () => {
  // ==========================================================================
  // handleTextMessage
  // ==========================================================================

  describe("handleTextMessage", () => {
    it("should return message unchanged when no delta content", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const chunk = {
        index: 0,
        delta: {},
        finish_reason: null,
      } as ChatCompletionChunk.Choice;

      const result = handleTextMessage(message, chunk);

      expect(result).toEqual(message);
    });

    it("should return message unchanged when content is string", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "existing",
      };

      const result = handleTextMessage(message, createTextChunk("new"));

      expect(result.content).toBe("existing");
    });

    it("should add first text part to empty content", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleTextMessage(message, createTextChunk("Hello"));

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should append to existing text part", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = handleTextMessage(message, createTextChunk(" world"));

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
    });

    it("should not mutate original message", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      handleTextMessage(message, createTextChunk(" world"));

      expect(message.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should handle afterToolCall flag", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleTextMessage(
        message,
        createTextChunk("New text"),
        true
      );

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([{ type: "text", text: "New text" }]);
    });
  });

  // ==========================================================================
  // handleToolCall
  // ==========================================================================

  describe("handleToolCall", () => {
    it("should return message unchanged when no tool calls in delta", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const chunk = {
        index: 0,
        delta: {},
        finish_reason: null,
      } as ChatCompletionChunk.Choice;

      const result = handleToolCall(message, chunk);

      expect(result).toEqual(message);
    });

    it("should return message unchanged when content is string", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const result = handleToolCall(
        message,
        createToolCallChunk("id", "test", "{}")
      );

      expect(result.content).toBe("string content");
    });

    it("should create new tool call part", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(
        message,
        createToolCallChunk("tool_123", "get_weather", '{"city":"NYC"}')
      );

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([
        {
          type: "tool-call",
          toolCallId: "tool_123",
          toolName: "get_weather",
          args: {},
          argsText: '{"city":"NYC"}',
        },
      ]);
    });

    it("should merge tool call data", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: '{"city":',
          },
        ],
      };

      const result = handleToolCall(
        message,
        createToolCallChunk("", "", '"NYC"}')
      );

      const content = result.content as Array<{
        type: string;
        argsText: string;
        args: unknown;
      }>;

      expect(content).toHaveLength(1);
      expect(content[0].argsText).toBe('{"city":"NYC"}');
      expect(content[0].args).toEqual({ city: "NYC" });
    });

    it("should handle invalid JSON in args gracefully", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "test",
            args: {},
            argsText: "{invalid",
          },
        ],
      };

      const result = handleToolCall(message, createToolCallChunk("", "", "}"));

      const content = result.content as Array<{ args: unknown }>;
      expect(content[0].args).toEqual({});
    });

    it("should not mutate original message", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      handleToolCall(message, createToolCallChunk("id", "test", "{}"));

      expect(message.content).toEqual([]);
    });

    it("should preserve toolName from initial chunk", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "original_name",
            args: {},
            argsText: "{}",
          },
        ],
      };

      // Subsequent chunk with empty name
      const result = handleToolCall(message, createToolCallChunk("", "", ""));

      const content = result.content as Array<{ toolName: string }>;
      expect(content[0].toolName).toBe("original_name");
    });
  });
});
