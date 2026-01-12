import type Anthropic from "@anthropic-ai/sdk";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  handleContentBlockDelta,
  handleContentBlockStart,
  handleMessageStart,
} from "../handlers";

// Helper to create partial event objects for testing
const createEvent = <T>(partial: Partial<T>) => partial as T;

describe("anthropic handlers", () => {
  describe("handleMessageStart", () => {
    it("should create initial message with empty content", () => {
      const event = createEvent<Anthropic.Messages.RawMessageStartEvent>({
        type: "message_start",
        message: { role: "assistant" } as Anthropic.Messages.Message,
      });

      const result = handleMessageStart(event);

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });
  });

  describe("handleContentBlockStart", () => {
    it("should add text block to message content", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "text",
          text: "Hello",
        } as Anthropic.Messages.TextBlock,
      });

      const result = handleContentBlockStart(event, prevMessage);

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should add tool_use block to message content", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_use",
          id: "tool_123",
          name: "get_weather",
        } as Anthropic.Messages.ToolUseBlock,
      });

      const result = handleContentBlockStart(event, prevMessage);

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([
        {
          type: "tool-call",
          toolCallId: "tool_123",
          toolName: "get_weather",
          args: {},
          argsText: "",
        },
      ]);
    });

    it("should not mutate original message", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "text",
          text: "Hello",
        } as Anthropic.Messages.TextBlock,
      });

      handleContentBlockStart(event, prevMessage);

      expect(prevMessage.content).toHaveLength(0);
    });

    it("should return message unchanged when content is string", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "text",
          text: "Hello",
        } as Anthropic.Messages.TextBlock,
      });

      const result = handleContentBlockStart(event, prevMessage);

      expect(result.content).toBe("string content");
    });

    it("should handle unknown content_block type", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "unknown_type",
        } as unknown as Anthropic.Messages.TextBlock,
      });

      const result = handleContentBlockStart(event, prevMessage);

      expect(result.content).toHaveLength(0);
    });

    it("should add thinking block to message content", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "thinking",
          thinking: "Let me think about this...",
        } as unknown as Anthropic.Messages.TextBlock,
      });

      const result = handleContentBlockStart(event, prevMessage);

      expect(result.content).toHaveLength(1);
      expect(result.content).toEqual([
        {
          type: "reasoning",
          text: "Let me think about this...",
        },
      ]);
    });

    it("should close unclosed thinking block when starting new text block", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "<think>Let me analyze this problem",
          },
        ],
      };

      const event = createEvent<Anthropic.Messages.ContentBlockStartEvent>({
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "text",
          text: "Here's my answer",
        } as Anthropic.Messages.TextBlock,
      });

      const result = handleContentBlockStart(event, prevMessage);

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: "text",
        text: "<think>Let me analyze this problem\n</think>\n\n",
      });
      expect(result.content[1]).toEqual({
        type: "text",
        text: "Here's my answer",
      });
    });
  });

  describe("handleContentBlockDelta", () => {
    it("should append text to existing text block", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " world" },
      });

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
    });

    it("should append JSON to tool-call args", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: '{"city": "New York"',
          },
        ],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "}" },
      });

      const result = handleContentBlockDelta(event, prevMessage);
      const content = result.content as unknown as Array<{
        args: unknown;
        argsText: string;
      }>;

      expect(content[0].argsText).toBe('{"city": "New York"}');
      expect(content[0].args).toEqual({ city: "New York" });
    });

    it("should handle invalid JSON gracefully", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: "{invalid json",
          },
        ],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "}" },
      });

      const result = handleContentBlockDelta(event, prevMessage);
      const content = result.content as unknown as Array<{
        args: unknown;
        argsText: string;
      }>;

      expect(content[0].argsText).toBe("{invalid json}");
      expect(content[0].args).toEqual({});
    });

    it("should not mutate original message", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " world" },
      });

      handleContentBlockDelta(event, prevMessage);

      expect(prevMessage.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should return message unchanged when content is string", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " world" },
      });

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toBe("string content");
    });

    it("should not modify content when text_delta and last content is not text", () => {
      const prevMessage: ThreadMessageLike = {
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

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " world" },
      });

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toHaveLength(1);
      expect(
        (result.content as unknown as Array<{ type: string }>)[0].type
      ).toBe("tool-call");
    });

    it("should not modify content when input_json_delta and last content is not tool-call", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"key": "value"}' },
      });

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should not parse JSON when argsText does not end with }", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: "",
          },
        ],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: '{"city": "New York"',
        },
      });

      const result = handleContentBlockDelta(event, prevMessage);
      const content = result.content as unknown as Array<{
        args: unknown;
        argsText: string;
      }>;

      expect(content[0].argsText).toBe('{"city": "New York"');
      expect(content[0].args).toEqual({});
    });

    it("should handle unknown delta type", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const event = {
        type: "content_block_delta",
        index: 0,
        delta: { type: "unknown_delta" },
      } as unknown as Anthropic.Messages.RawContentBlockDeltaEvent;

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should handle empty content array for text delta", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      });

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([]);
    });

    it("should handle empty content array for input_json_delta", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const event = createEvent<Anthropic.Messages.RawContentBlockDeltaEvent>({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "{}" },
      });

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([]);
    });

    it("should append thinking text to existing reasoning block", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "reasoning", text: "Let me think" }],
      };

      const event = {
        type: "content_block_delta",
        index: 0,
        delta: { type: "thinking_delta", thinking: " about this..." },
      } as unknown as Anthropic.Messages.RawContentBlockDeltaEvent;

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([
        { type: "reasoning", text: "Let me think about this..." },
      ]);
    });

    it("should not modify content when thinking_delta and last content is not reasoning", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const event = {
        type: "content_block_delta",
        index: 0,
        delta: { type: "thinking_delta", thinking: " thinking" },
      } as unknown as Anthropic.Messages.RawContentBlockDeltaEvent;

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should add signature to reasoning block", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "reasoning", text: "Let me think about this" }],
      };

      const event = {
        type: "content_block_delta",
        index: 0,
        delta: { type: "signature_delta", signature: "signature_abc123" },
      } as unknown as Anthropic.Messages.RawContentBlockDeltaEvent;

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([
        {
          type: "reasoning",
          text: "Let me think about this",
          parentId: "signature_abc123",
        },
      ]);
    });

    it("should not modify content when signature_delta and last content is not reasoning", () => {
      const prevMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const event = {
        type: "content_block_delta",
        index: 0,
        delta: { type: "signature_delta", signature: "sig_123" },
      } as unknown as Anthropic.Messages.RawContentBlockDeltaEvent;

      const result = handleContentBlockDelta(event, prevMessage);

      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });
  });
});
