import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "../utils";

describe("together utils", () => {
  // ==========================================================================
  // convertToolsToModelFormat
  // ==========================================================================

  describe("convertToolsToModelFormat", () => {
    it("should convert tools to Together format", () => {
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

    it("should handle multiple tools", () => {
      const tools = [
        { name: "tool1", description: "First tool", inputSchema: {} },
        { name: "tool2", description: "Second tool", inputSchema: {} },
      ];

      const result = convertToolsToModelFormat(tools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe("tool1");
      expect(result[1].function.name).toBe("tool2");
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
            content: [
              { type: "text", text: "Hello" },
              { type: "text", text: "World" },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([{ role: "user", content: "Hello\n\nWorld" }]);
      });

      it("should convert user message with file part", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: "file content here",
                mimeType: '{"path": "/path/to/file.txt"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContain("File: file.txt");
        expect(result[0].content).toContain("file content here");
      });

      it("should handle file path with backslashes (Windows)", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: "content",
                mimeType: '{"path": "C:\\\\Users\\\\test\\\\file.txt"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContain("File: file.txt");
      });

      it("should filter empty content parts", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "text", text: "Hello" },
              { type: "unknown" } as unknown as { type: "text"; text: string },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toBe("Hello");
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
    });

    describe("assistant messages", () => {
      it("should convert assistant message with string content", () => {
        const messages: ThreadMessageLike[] = [
          { role: "assistant", content: "Hello!" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([{ role: "assistant", content: "Hello!" }]);
      });

      it("should convert assistant message with text parts", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [{ type: "text", text: "Response here" }],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].role).toBe("assistant");
        expect(result[0].content).toBe("Response here");
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

        expect(result).toHaveLength(1);
        expect(result[0].role).toBe("assistant");
        expect(
          (result[0] as { tool_calls?: unknown[] }).tool_calls
        ).toHaveLength(1);
      });

      it("should add tool result as separate message", () => {
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
        expect(result[0].role).toBe("assistant");
        expect(result[1].role).toBe("tool");
        expect(result[1].content).toBe("Sunny, 72°F");
      });

      it("should handle mixed text and tool call content", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Let me check" },
              {
                type: "tool-call",
                toolCallId: "123",
                toolName: "test",
                args: {},
                argsText: "{}",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContain("Let me check");
        expect(
          (result[0] as { tool_calls?: unknown[] }).tool_calls
        ).toHaveLength(1);
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
        expect(result[0]).toEqual({ role: "user", content: "Hi" });
        expect(result[1]).toEqual({ role: "assistant", content: "Hello!" });
        expect(result[2]).toEqual({ role: "user", content: "How are you?" });
      });

      it("should handle empty messages array", () => {
        const result = convertMessagesToModelFormat([]);

        expect(result).toEqual([]);
      });
    });
  });
});
