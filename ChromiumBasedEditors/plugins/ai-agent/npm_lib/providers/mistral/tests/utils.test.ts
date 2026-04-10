import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "../utils";

describe("mistral utils", () => {
  // ==========================================================================
  // convertToolsToModelFormat
  // ==========================================================================

  describe("convertToolsToModelFormat", () => {
    it("should convert tools to Mistral format", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get current weather",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
            required: ["city"],
          },
        },
      ];

      const result = convertToolsToModelFormat(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "function",
        function: {
          name: "get_weather",
          description: "Get current weather",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
            required: ["city"],
          },
        },
      });
    });

    it("should handle empty tools array", () => {
      const result = convertToolsToModelFormat([]);

      expect(result).toEqual([]);
    });

    it("should convert multiple tools", () => {
      const tools = [
        {
          name: "tool_1",
          description: "First tool",
          inputSchema: { properties: {} },
        },
        {
          name: "tool_2",
          description: "Second tool",
          inputSchema: { properties: {} },
        },
      ];

      const result = convertToolsToModelFormat(tools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe("tool_1");
      expect(result[1].function.name).toBe("tool_2");
    });
  });

  // ==========================================================================
  // convertMessagesToModelFormat
  // ==========================================================================

  describe("convertMessagesToModelFormat", () => {
    describe("user messages", () => {
      it("should convert user message with string content", () => {
        const messages: ThreadMessageLike[] = [
          { role: "user", content: "Hello" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
          },
        ]);
      });

      it("should convert user message with text parts", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [{ type: "text", text: "Hello world" }],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [{ type: "text", text: "Hello world" }],
          },
        ]);
      });

      it("should convert user message with file attachments", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: "Check this file",
            attachments: [
              {
                type: "file",
                name: "test.txt",
                content: "file content",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContainEqual({
          type: "text",
          text: "File: test.txt: file content",
        });
      });

      it("should convert user message with image attachments", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: "Check this image",
            attachments: [
              {
                type: "image",
                name: "photo.png",
                content: "base64data",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContainEqual({
          type: "text",
          text: "Image: photo.png: base64data",
        });
      });

      it("should handle user message with image content part", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "text", text: "Look at this" },
              {
                type: "image",
                image: "base64imagedata",
                filename: "screenshot.png",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContainEqual({
          type: "text",
          text: "Image: screenshot.png: base64imagedata",
        });
      });

      it("should handle user message with file content part", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "text", text: "Check this" },
              {
                type: "file",
                data: "file data here",
                filename: "doc.txt",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContainEqual({
          type: "text",
          text: "File: doc.txt: file data here",
        });
      });

      it("should handle tool result in user message", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_123",
                toolName: "get_weather",
                args: {},
                argsText: "{}",
                result: "Sunny, 72F",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        // Should have user message and tool message
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({
          role: "tool",
          content: "Sunny, 72F",
          name: "get_weather",
          toolCallId: "tool_123",
        });
      });
    });

    describe("assistant messages", () => {
      it("should convert assistant message with string content", () => {
        const messages: ThreadMessageLike[] = [
          { role: "assistant", content: "Hello!" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            toolCalls: undefined,
          },
        ]);
      });

      it("should convert assistant message with text parts", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [{ type: "text", text: "Response" }],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "assistant",
            content: [{ type: "text", text: "Response" }],
            toolCalls: undefined,
          },
        ]);
      });

      it("should convert assistant message with tool call", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_123",
                toolName: "get_weather",
                args: { city: "NYC" },
                argsText: '{"city":"NYC"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "assistant",
            content: [],
            toolCalls: [
              {
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"city":"NYC"}',
                },
              },
            ],
          },
        ]);
      });

      it("should convert assistant message with reasoning part", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "reasoning",
                text: "Let me think about this",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContainEqual({
          type: "thinking",
          thinking: [{ type: "text", text: "Let me think about this" }],
        });
      });

      it("should handle tool call with args object when argsText is empty", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_456",
                toolName: "test_tool",
                args: { key: "value" },
                argsText: "",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].toolCalls[0].function.arguments).toBe(
          '{"key":"value"}'
        );
      });

      it("should handle tool call with empty args", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_789",
                toolName: "no_args",
                args: undefined,
                argsText: "",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].toolCalls[0].function.arguments).toBe("");
      });
    });

    describe("multiple messages", () => {
      it("should convert conversation with multiple messages", () => {
        const messages: ThreadMessageLike[] = [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello!" },
          { role: "user", content: "How are you?" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toHaveLength(3);
        expect(result[0].role).toBe("user");
        expect(result[1].role).toBe("assistant");
        expect(result[2].role).toBe("user");
      });

      it("should handle mixed content types in conversation", () => {
        const messages: ThreadMessageLike[] = [
          { role: "user", content: "Check the weather" },
          {
            role: "assistant",
            content: [
              { type: "text", text: "Let me check" },
              {
                type: "tool-call",
                toolCallId: "tool_1",
                toolName: "get_weather",
                args: { city: "NYC" },
                argsText: '{"city":"NYC"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toHaveLength(2);
        expect(result[1].toolCalls).toHaveLength(1);
      });
    });
  });
});
