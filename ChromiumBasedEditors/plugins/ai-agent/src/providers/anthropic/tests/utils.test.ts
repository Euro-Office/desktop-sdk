import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertImagePart,
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "../utils";

describe("anthropic utils", () => {
  // ==========================================================================
  // convertImagePart
  // ==========================================================================

  describe("convertImagePart", () => {
    it("should convert image part to content block", () => {
      const imagePart = {
        type: "image" as const,
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      };

      const result = convertImagePart(imagePart);

      expect(result).toEqual({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUg==",
        },
      });
    });

    it("should map jpg to jpeg mime type", () => {
      const imagePart = {
        type: "image" as const,
        image: "data:image/jpg;base64,/9j/4AAQSkZJRg==",
      };

      const result = convertImagePart(imagePart);

      expect(result).toMatchObject({
        source: { media_type: "image/jpeg" },
      });
    });

    it("should default to jpeg for unknown mime types", () => {
      const imagePart = {
        type: "image" as const,
        image: "data:image/bmp;base64,Qk0=",
      };

      const result = convertImagePart(imagePart);

      expect(result).toMatchObject({
        source: { media_type: "image/jpeg" },
      });
    });

    it("should return empty text for non-image content", () => {
      const textPart = {
        type: "text" as const,
        text: "hello",
      };

      const result = convertImagePart(textPart);

      expect(result).toEqual({ type: "text", text: "" });
    });
  });

  // ==========================================================================
  // convertToolsToModelFormat
  // ==========================================================================

  describe("convertToolsToModelFormat", () => {
    it("should convert tools to Anthropic format", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get current weather",
          inputSchema: {
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
        name: "get_weather",
        description: "Get current weather",
        input_schema: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      });
    });

    it("should handle empty tools array", () => {
      const result = convertToolsToModelFormat([]);

      expect(result).toEqual([]);
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

        expect(result).toEqual([{ role: "user", content: "Hello" }]);
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

      it("should handle unknown content part types", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "unknown-type" } as unknown as {
                type: "text";
                text: string;
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [{ type: "text", text: "" }],
          },
        ]);
      });

      it("should convert user message with image attachments", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "text", text: "Check this image" },
              { type: "image", image: "data:image/png;base64,abc123" },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toHaveLength(2);
        expect((result[0].content as Array<{ type: string }>)[1].type).toBe(
          "image"
        );
      });

      it("should convert user message with file part", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: "file content",
                mimeType: '{"path": "/path/to/file.txt"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "text",
                  media_type: "text/plain",
                  data: "file content",
                },
                context: "/path/to/file.txt",
              },
            ],
          },
        ]);
      });
    });

    describe("system messages", () => {
      it("should convert system message as user role", () => {
        const messages: ThreadMessageLike[] = [
          { role: "system", content: "You are helpful" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([{ role: "user", content: "You are helpful" }]);
      });

      it("should convert system message with text parts", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "system",
            content: [{ type: "text", text: "System prompt" }],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [{ type: "text", text: "System prompt" }],
          },
        ]);
      });

      it("should handle non-text parts in system message", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "system",
            content: [
              { type: "unknown" } as unknown as { type: "text"; text: string },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [{ type: "text", text: "" }],
          },
        ]);
      });
    });

    describe("assistant messages", () => {
      it("should convert assistant message with string content", () => {
        const messages: ThreadMessageLike[] = [
          { role: "assistant", content: "Hello!" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([{ role: "assistant", content: "Hello!" }]);
      });

      it("should skip empty assistant message", () => {
        const messages: ThreadMessageLike[] = [
          { role: "assistant", content: "" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            content: [],
            role: "assistant",
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
            content: [
              {
                type: "tool_use",
                id: "tool_123",
                name: "get_weather",
                input: { city: "NYC" },
              },
            ],
          },
        ]);
      });

      it("should convert tool call with result", () => {
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
                result: "Sunny, 72°F",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool_123",
              name: "get_weather",
              input: { city: "NYC" },
            },
          ],
        });
        expect(result[1]).toEqual({
          role: "user",
          content: [
            {
              type: "tool_result",
              content: "Sunny, 72°F",
              tool_use_id: "tool_123",
            },
          ],
        });
      });

      it("should handle tool call with undefined toolCallId", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: undefined as unknown as string,
                toolName: "test_tool",
                args: { key: "value" },
                argsText: '{"key":"value"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0]).toEqual({
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "",
              name: "test_tool",
              input: { key: "value" },
            },
          ],
        });
      });

      it("should handle tool call with undefined toolCallId and result", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: undefined as unknown as string,
                toolName: "test_tool",
                args: { key: "value" },
                argsText: '{"key":"value"}',
                result: "test result",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({
          role: "user",
          content: [
            {
              type: "tool_result",
              content: "test result",
              tool_use_id: "",
            },
          ],
        });
      });

      it("should handle tool call with falsy args", () => {
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "tool-call" as const,
                toolCallId: "tool_123",
                toolName: "test_tool",
                args: null,
                argsText: "",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(
          messages as unknown as ThreadMessageLike[]
        );

        expect(result[0]).toEqual({
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool_123",
              name: "test_tool",
              input: {},
            },
          ],
        });
      });

      it("should convert assistant message with reasoning part", () => {
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "reasoning" as const,
                text: "Let me think about this problem",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(
          messages as unknown as ThreadMessageLike[]
        );

        expect(result).toEqual([
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Let me think about this problem",
                signature: "",
              },
            ],
          },
        ]);
      });

      it("should convert assistant message with reasoning part and signature", () => {
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "reasoning" as const,
                text: "Let me analyze this",
                parentId: "signature_abc123",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(
          messages as unknown as ThreadMessageLike[]
        );

        expect(result).toEqual([
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Let me analyze this",
                signature: "signature_abc123",
              },
            ],
          },
        ]);
      });

      it("should convert assistant message with mixed reasoning and text parts", () => {
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "reasoning" as const,
                text: "Internal thought process",
              },
              {
                type: "text" as const,
                text: "Here's my answer",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(
          messages as unknown as ThreadMessageLike[]
        );

        expect(result).toEqual([
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Internal thought process",
                signature: "",
              },
              {
                type: "text",
                text: "Here's my answer",
              },
            ],
          },
        ]);
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

        expect(result).toEqual([
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello!" },
          { role: "user", content: "How are you?" },
        ]);
      });
    });
  });
});
