import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  CompletionEvent,
  DeltaMessage,
} from "@mistralai/mistralai/models/components";
import { describe, expect, it } from "vitest";
import {
  getChoiceFromEvent,
  handleTextContent,
  handleToolCall,
} from "../handlers";

// Helper to create partial event objects for testing
const createEvent = <T>(partial: Partial<T>) => partial as T;

describe("mistral handlers", () => {
  // ==========================================================================
  // handleToolCall
  // ==========================================================================

  describe("handleToolCall", () => {
    it("should return unchanged message when no tool calls", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: undefined,
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(result).toEqual(prevMessage);
    });

    it("should return unchanged message when tool calls array is empty", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(result).toEqual(prevMessage);
    });

    it("should add tool call to message content", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: "tool_123",
            function: {
              name: "get_weather",
              arguments: '{"city": "NYC"}',
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([
        {
          type: "tool-call",
          toolCallId: "tool_123",
          toolName: "get_weather",
          args: { city: "NYC" },
          argsText: '{"city": "NYC"}',
          result: "",
          parentId: "tool_123",
        },
      ]);
    });

    it("should handle tool call with empty arguments", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: "tool_456",
            function: {
              name: "no_args_tool",
              arguments: "",
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(result.content).toHaveLength(1);
      expect(
        (result.content as unknown as Array<{ args: unknown }>)[0].args
      ).toEqual({});
    });

    it("should handle tool call with undefined id", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: undefined,
            function: {
              name: "test_tool",
              arguments: "{}",
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(
        (result.content as unknown as Array<{ toolCallId: string }>)[0]
          .toolCallId
      ).toBe("");
    });

    it("should handle tool call with undefined function name", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: "tool_789",
            function: {
              name: undefined as unknown as string,
              arguments: "{}",
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(
        (result.content as unknown as Array<{ toolName: string }>)[0].toolName
      ).toBe("");
    });

    it("should append tool call to existing content", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: "tool_new",
            function: {
              name: "new_tool",
              arguments: "{}",
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Let me check that" }],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(result.content).toHaveLength(2);
      expect(
        (result.content as unknown as Array<{ type: string }>)[0].type
      ).toBe("text");
      expect(
        (result.content as unknown as Array<{ type: string }>)[1].type
      ).toBe("tool-call");
    });

    it("should return unchanged message when content is string", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: "tool_123",
            function: {
              name: "test_tool",
              arguments: "{}",
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const result = handleToolCall(delta, prevMessage);

      expect(result).toEqual(prevMessage);
    });

    it("should handle object arguments", () => {
      const delta = createEvent<DeltaMessage>({
        toolCalls: [
          {
            id: "tool_obj",
            function: {
              name: "obj_args_tool",
              arguments: { key: "value" } as unknown as string,
            },
          },
        ],
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleToolCall(delta, prevMessage);

      expect(
        (result.content as unknown as Array<{ args: unknown }>)[0].args
      ).toEqual({
        key: "value",
      });
    });
  });

  // ==========================================================================
  // handleTextContent
  // ==========================================================================

  describe("handleTextContent", () => {
    it("should return unchanged message when delta content is not string", () => {
      const delta = createEvent<DeltaMessage>({
        content: undefined,
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleTextContent(delta, prevMessage);

      expect(result).toEqual(prevMessage);
    });

    it("should return unchanged message when response content is string", () => {
      const delta = createEvent<DeltaMessage>({
        content: "new text",
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const result = handleTextContent(delta, prevMessage);

      expect(result).toEqual(prevMessage);
    });

    it("should add new text part when content is empty", () => {
      const delta = createEvent<DeltaMessage>({
        content: "Hello",
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = handleTextContent(delta, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should append to existing text part", () => {
      const delta = createEvent<DeltaMessage>({
        content: " world",
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = handleTextContent(delta, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
    });

    it("should add new text part when last content is not text", () => {
      const delta = createEvent<DeltaMessage>({
        content: "New text",
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "test",
            args: {},
            argsText: "{}",
          },
        ],
      };

      const result = handleTextContent(delta, prevMessage);

      expect(result.content).toHaveLength(2);
      expect(
        (result.content as unknown as Array<{ type: string }>)[1].type
      ).toBe("text");
      expect(
        (result.content as unknown as Array<{ text?: string }>)[1].text
      ).toBe("New text");
    });

    it("should not mutate original message", () => {
      const delta = createEvent<DeltaMessage>({
        content: " world",
      });

      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      handleTextContent(delta, prevMessage);

      expect(prevMessage.content).toEqual([{ type: "text", text: "Hello" }]);
    });
  });

  // ==========================================================================
  // getChoiceFromEvent
  // ==========================================================================

  describe("getChoiceFromEvent", () => {
    it("should return first choice from event", () => {
      const event = createEvent<CompletionEvent>({
        data: {
          id: "test-id",
          model: "mistral-small",
          choices: [
            { index: 0, delta: { content: "Hello" }, finishReason: null },
            { index: 1, delta: { content: "World" }, finishReason: null },
          ],
        },
      });

      const result = getChoiceFromEvent(event);

      expect(result?.delta.content).toBe("Hello");
    });

    it("should return undefined when no choices", () => {
      const event = createEvent<CompletionEvent>({
        data: {
          id: "test-id",
          model: "mistral-small",
          choices: [],
        },
      });

      const result = getChoiceFromEvent(event);

      expect(result).toBeUndefined();
    });

    it("should return undefined when data is undefined", () => {
      const event = createEvent<CompletionEvent>({
        data: undefined,
      });

      const result = getChoiceFromEvent(event);

      expect(result).toBeUndefined();
    });
  });
});
