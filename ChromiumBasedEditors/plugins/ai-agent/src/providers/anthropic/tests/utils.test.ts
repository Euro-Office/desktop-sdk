import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertImageAttachmentsToContent,
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "../utils";

describe("anthropic utils", () => {
  // ==========================================================================
  // convertImageAttachmentsToContent
  // ==========================================================================

  describe("convertImageAttachmentsToContent", () => {
    it("should convert image attachments to content blocks", () => {
      const attachments = [
        {
          id: "1",
          type: "image" as const,
          name: "test.png",
          contentType: "image/png",
          content: [
            {
              type: "image" as const,
              image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
            },
          ],
          status: { type: "complete" as const },
        },
      ];

      const result = convertImageAttachmentsToContent(attachments);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUg==",
        },
      });
    });

    it("should map jpg to jpeg mime type", () => {
      const attachments = [
        {
          id: "1",
          type: "image" as const,
          name: "test.jpg",
          contentType: "image/jpg",
          content: [
            {
              type: "image" as const,
              image: "data:image/jpg;base64,/9j/4AAQSkZJRg==",
            },
          ],
          status: { type: "complete" as const },
        },
      ];

      const result = convertImageAttachmentsToContent(attachments);

      expect(result[0]).toMatchObject({
        source: { media_type: "image/jpeg" },
      });
    });

    it("should default to jpeg for unknown mime types", () => {
      const attachments = [
        {
          id: "1",
          type: "image" as const,
          name: "test.bmp",
          contentType: "image/bmp",
          content: [
            {
              type: "image" as const,
              image: "data:image/bmp;base64,Qk0=",
            },
          ],
          status: { type: "complete" as const },
        },
      ];

      const result = convertImageAttachmentsToContent(attachments);

      expect(result[0]).toMatchObject({
        source: { media_type: "image/jpeg" },
      });
    });

    it("should filter non-image content", () => {
      const attachments = [
        {
          id: "1",
          type: "file" as const,
          name: "test.txt",
          contentType: "text/plain",
          content: [
            {
              type: "text" as const,
              text: "hello",
            },
          ],
          status: { type: "complete" as const },
        },
      ];

      const result = convertImageAttachmentsToContent(
        attachments as unknown as Parameters<
          typeof convertImageAttachmentsToContent
        >[0]
      );

      expect(result).toHaveLength(0);
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
            content: [{ type: "text", text: "Check this image" }],
            attachments: [
              {
                id: "1",
                type: "image" as const,
                name: "photo.png",
                contentType: "image/png",
                content: [
                  {
                    type: "image" as const,
                    image: "data:image/png;base64,abc123",
                  },
                ],
                status: { type: "complete" as const },
              },
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

        expect(result).toEqual([]);
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
