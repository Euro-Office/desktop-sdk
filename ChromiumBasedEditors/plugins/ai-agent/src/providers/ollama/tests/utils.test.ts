import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertAssistantMessage,
  convertContentPartToString,
  convertMessagesToModelFormat,
  convertSystemMessage,
  convertToolsToModelFormat,
  convertToolsToString,
  convertUserMessage,
  END_TOOL_TAG,
  extractFilename,
  formatFileContent,
  START_TOOL_TAG,
} from "../utils";

describe("ollama utils", () => {
  // ==========================================================================
  // convertToolsToModelFormat
  // ==========================================================================

  describe("convertToolsToModelFormat", () => {
    it("should convert tools to Ollama format", () => {
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
        type: "string",
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
        {
          name: "tool1",
          description: "First tool",
          inputSchema: {},
        },
        {
          name: "tool2",
          description: "Second tool",
          inputSchema: {},
        },
      ];

      const result = convertToolsToModelFormat(tools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe("tool1");
      expect(result[1].function.name).toBe("tool2");
    });
  });

  // ==========================================================================
  // convertToolsToString
  // ==========================================================================

  describe("convertToolsToString", () => {
    it("should generate tools string with instructions", () => {
      const tools = [
        {
          type: "string" as const,
          function: {
            name: "test_tool",
            description: "A test tool",
            parameters: {},
          },
        },
      ];

      const result = convertToolsToString(tools);

      expect(result).toContain("Available tools:");
      expect(result).toContain("test_tool");
      expect(result).toContain(START_TOOL_TAG);
      expect(result).toContain(END_TOOL_TAG);
    });

    it("should include example format", () => {
      const tools = [
        {
          type: "string" as const,
          function: {
            name: "example",
            description: "Example tool",
            parameters: {},
          },
        },
      ];

      const result = convertToolsToString(tools);

      // JSON.stringify produces minified output without spaces
      expect(result).toContain('"name":"toolName"');
      expect(result).toContain('"args"');
    });

    it("should handle empty tools array", () => {
      const result = convertToolsToString([]);

      expect(result).toContain("Available tools:");
      expect(result).toContain("[]");
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
      it("should convert system message with string content as user", () => {
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

        expect(result).toEqual([{ role: "user", content: "System prompt" }]);
      });

      it("should return empty string for non-text parts", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "system",
            content: [
              { type: "unknown" } as unknown as { type: "text"; text: string },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([{ role: "user", content: "" }]);
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

        expect(result).toEqual([
          { role: "assistant", content: "Response here" },
        ]);
      });

      it("should convert assistant message with tool call", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "123",
                toolName: "get_weather",
                args: { city: "NYC" },
                argsText: '{"city":"NYC"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].content).toContain(START_TOOL_TAG);
        expect(result[0].content).toContain(END_TOOL_TAG);
        expect(result[0].content).toContain('{"city":"NYC"}');
      });

      it("should add tool result as user message", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "123",
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
        expect(result[1].role).toBe("user");
        expect(result[1].content).toContain("Sunny, 72°F");
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
        expect(result[0].content).toContain(START_TOOL_TAG);
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

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  describe("extractFilename", () => {
    it("should extract filename from Unix path", () => {
      expect(extractFilename("/path/to/file.txt")).toBe("file.txt");
    });

    it("should extract filename from Windows path", () => {
      expect(extractFilename("C:\\Users\\test\\file.txt")).toBe("file.txt");
    });

    it("should return filename if no path separator", () => {
      expect(extractFilename("file.txt")).toBe("file.txt");
    });
  });

  describe("formatFileContent", () => {
    it("should format file with path and content", () => {
      const result = formatFileContent("/path/to/test.js", "const x = 1;");

      expect(result).toBe("File: test.js\nFile content:\nconst x = 1;");
    });
  });

  describe("convertContentPartToString", () => {
    it("should convert text part", () => {
      const result = convertContentPartToString({
        type: "text",
        text: "Hello",
      });
      expect(result).toBe("Hello");
    });

    it("should convert file part", () => {
      const result = convertContentPartToString({
        type: "file",
        data: "content",
        mimeType: '{"path": "/test.txt"}',
      });
      expect(result).toContain("File: test.txt");
      expect(result).toContain("content");
    });

    it("should return empty string for unknown type", () => {
      const result = convertContentPartToString({
        type: "unknown",
      } as unknown as { type: "text"; text: string });
      expect(result).toBe("");
    });
  });

  describe("convertUserMessage", () => {
    it("should convert string content", () => {
      const result = convertUserMessage({ role: "user", content: "Hello" });
      expect(result).toEqual({ role: "user", content: "Hello" });
    });

    it("should convert array content", () => {
      const result = convertUserMessage({
        role: "user",
        content: [{ type: "text", text: "Hi" }],
      });
      expect(result).toEqual({ role: "user", content: "Hi" });
    });
  });

  describe("convertSystemMessage", () => {
    it("should convert to user role", () => {
      const result = convertSystemMessage({
        role: "system",
        content: "Be helpful",
      });
      expect(result).toEqual({ role: "user", content: "Be helpful" });
    });
  });

  describe("convertAssistantMessage", () => {
    it("should convert string content", () => {
      const result = convertAssistantMessage({
        role: "assistant",
        content: "Hi",
      });
      expect(result.assistantMessage).toEqual({
        role: "assistant",
        content: "Hi",
      });
      expect(result.toolResultMessage).toBeUndefined();
    });

    it("should return tool result message when tool call has result", () => {
      const result = convertAssistantMessage({
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "1",
            toolName: "test",
            args: {},
            argsText: "{}",
            result: "done",
          },
        ],
      });

      expect(result.assistantMessage.role).toBe("assistant");
      expect(result.toolResultMessage).toBeDefined();
      expect(result.toolResultMessage?.role).toBe("user");
      expect(result.toolResultMessage?.content).toContain("done");
    });
  });
});
