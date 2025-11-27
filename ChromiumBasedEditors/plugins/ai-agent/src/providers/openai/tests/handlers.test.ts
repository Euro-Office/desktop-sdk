import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { describe, expect, it } from "vitest";
import { handleTextMessage, handleToolCall } from "../handlers";

const createChoice = (
  delta: ChatCompletionChunk.Choice["delta"],
  finishReason?: ChatCompletionChunk.Choice["finish_reason"]
): ChatCompletionChunk.Choice => ({
  index: 0,
  delta,
  finish_reason: finishReason || null,
});

describe("openai handlers", () => {
  // ==========================================================================
  // handleTextMessage
  // ==========================================================================

  describe("handleTextMessage", () => {
    it("should return unchanged message when no content in delta", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const choice = createChoice({ content: undefined });

      const result = handleTextMessage(message, choice);

      expect(result).toEqual(message);
    });

    it("should return unchanged message when content is string", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "existing text",
      };

      const choice = createChoice({ content: " more text" });

      const result = handleTextMessage(message, choice);

      expect(result.content).toBe("existing text");
    });

    it("should add new text part when content array is empty", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const choice = createChoice({ content: "Hello" });

      const result = handleTextMessage(message, choice);

      expect(Array.isArray(result.content)).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({ type: "text", text: "Hello" });
    });

    it("should append to existing text part", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const choice = createChoice({ content: " world" });

      const result = handleTextMessage(message, choice);

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toBe("Hello world");
    });

    it("should not add text when last content is not text and afterToolCall is false", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "test",
            args: {},
            argsText: "",
          },
        ],
      };

      const choice = createChoice({ content: "Response" });

      const result = handleTextMessage(message, choice);

      const content = result.content as unknown as Array<{ type: string }>;
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe("tool-call");
    });

    it("should add new text part when afterToolCall is true", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Original" }],
      };

      const choice = createChoice({ content: "New" });

      const result = handleTextMessage(message, choice, true);

      const content = result.content as unknown as Array<{
        type: string;
        text: string;
      }>;
      // When afterToolCall is true, a new text part is added, but then the second condition
      // also appends to the last text part, resulting in the new part having the content
      expect(content).toHaveLength(1);
      expect(content[0].text).toBe("OriginalNew");
    });

    it("should handle multiple consecutive text deltas", () => {
      let message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      message = handleTextMessage(message, createChoice({ content: "Hello" }));
      message = handleTextMessage(message, createChoice({ content: " " }));
      message = handleTextMessage(message, createChoice({ content: "world" }));

      const content = message.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toBe("Hello world");
    });
  });

  // ==========================================================================
  // handleToolCall
  // ==========================================================================

  describe("handleToolCall", () => {
    it("should return unchanged message when no tool_calls in delta", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const choice = createChoice({ tool_calls: undefined });

      const result = handleToolCall(message, choice);

      expect(result).toEqual(message);
    });

    it("should return unchanged message when content is string", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "test", arguments: "{}" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      expect(result.content).toBe("string content");
    });

    it("should create new tool call when none exists", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "get_weather", arguments: '{"city":"NYC"}' },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{ type: string }>;
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe("tool-call");
    });

    it("should append to existing tool call", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: '{"city"',
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "get_weather", arguments: ':"NYC"}' },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        argsText: string;
      }>;
      expect(content[0].argsText).toBe('{"city":"NYC"}');
    });

    it("should parse complete JSON arguments", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: '{"city":"NYC","temp":72}',
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "get_weather", arguments: "" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        args: Record<string, unknown>;
      }>;
      expect(content[0].args).toEqual({ city: "NYC", temp: 72 });
    });

    it("should handle invalid JSON gracefully", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "test",
            args: {},
            argsText: "invalid json",
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "test", arguments: "" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        args: Record<string, unknown>;
      }>;
      expect(content[0].args).toEqual({});
    });

    it("should use toolCallId from existing tool call if present", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "existing_id",
            toolName: "test",
            args: {},
            argsText: "",
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "new_id",
            type: "function",
            function: { name: "test", arguments: "" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        toolCallId: string;
      }>;
      expect(content[0].toolCallId).toBe("existing_id");
    });

    it("should use new toolCallId if not present in existing tool call", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "",
            toolName: "test",
            args: {},
            argsText: "",
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "new_id",
            type: "function",
            function: { name: "test", arguments: "" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        toolCallId: string;
      }>;
      expect(content[0].toolCallId).toBe("new_id");
    });

    it("should use toolName from delta if not present in existing tool call", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "",
            args: {},
            argsText: "",
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "get_weather", arguments: "" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        toolName: string;
      }>;
      expect(content[0].toolName).toBe("get_weather");
    });

    it("should handle tool call with no function data", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: undefined, arguments: undefined },
          },
        ] as unknown as ChatCompletionChunk.Choice["delta"]["tool_calls"],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{ type: string }>;
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe("tool-call");
    });

    it("should add new tool call when last content is not tool-call", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Let me check" }],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "test", arguments: "{}" },
          },
        ],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{ type: string }>;
      expect(content).toHaveLength(2);
      expect(content[1].type).toBe("tool-call");
    });

    it("should handle tool call with undefined id and name", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: undefined,
            type: "function",
            function: { name: undefined, arguments: undefined },
          },
        ] as unknown as ChatCompletionChunk.Choice["delta"]["tool_calls"],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        toolCallId: string;
        toolName: string;
      }>;
      expect(content).toHaveLength(1);
      expect(content[0].toolCallId).toBe("");
      expect(content[0].toolName).toBe("");
    });

    it("should handle tool call with undefined arguments", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "test",
            args: {},
            argsText: "",
          },
        ],
      };

      const choice = createChoice({
        tool_calls: [
          {
            index: 0,
            id: "tool_123",
            type: "function",
            function: { name: "test", arguments: undefined },
          },
        ] as unknown as ChatCompletionChunk.Choice["delta"]["tool_calls"],
      });

      const result = handleToolCall(message, choice);

      const content = result.content as unknown as Array<{
        type: string;
        argsText: string;
      }>;
      expect(content[0].argsText).toBe("");
    });
  });
});
