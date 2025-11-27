import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "../utils";

describe("openai utils", () => {
  // ==========================================================================
  // convertToolsToModelFormat
  // ==========================================================================

  describe("convertToolsToModelFormat", () => {
    it("should convert tools to OpenAI format", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get weather for a location",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
          },
        },
      ];

      const result = convertToolsToModelFormat(tools);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("function");
      const func = (
        result[0] as { function: { name: string; description: string } }
      ).function;
      expect(func.name).toBe("get_weather");
      expect(func.description).toBe("Get weather for a location");
    });

    it("should handle multiple tools", () => {
      const tools = [
        {
          name: "tool1",
          description: "First tool",
          inputSchema: { type: "object" },
        },
        {
          name: "tool2",
          description: "Second tool",
          inputSchema: { type: "object" },
        },
      ];

      const result = convertToolsToModelFormat(tools);

      expect(result).toHaveLength(2);
      expect(
        (result[0] as unknown as { function: { name: string } }).function.name
      ).toBe("tool1");
      expect(
        (result[1] as unknown as { function: { name: string } }).function.name
      ).toBe("tool2");
    });

    it("should handle empty tools array", () => {
      const result = convertToolsToModelFormat([]);

      expect(result).toHaveLength(0);
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
            content: [{ type: "text", text: "Hello" }],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([
          {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
          },
        ]);
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

        expect(result[0].role).toBe("user");
        expect(Array.isArray(result[0].content)).toBe(true);
        const content = result[0].content as Array<{
          type: string;
          text: string;
        }>;
        expect(content[0].type).toBe("text");
        expect(content[0].text).toContain("file_data");
        expect(content[0].text).toContain("filename");
      });

      it("should handle unknown part type in user message", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "user",
            content: [
              { type: "unknown" } as unknown as { type: "text"; text: string },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result[0].role).toBe("user");
        const content = result[0].content as Array<{
          type: string;
          text: string;
        }>;
        expect(content[0]).toEqual({ type: "text", text: "" });
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

        // Tool call without result creates empty assistant message with tool_calls
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe("assistant");
        const msg = result[0] as { tool_calls?: Array<{ type: string }> };
        expect(msg.tool_calls).toBeDefined();
        expect(msg.tool_calls?.[0].type).toBe("function");
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
        expect(result[0].role).toBe("assistant");
        expect(result[1].role).toBe("tool");
        expect(result[1].content).toBe("Sunny, 72°F");
      });

      it("should handle tool call with undefined toolCallId", () => {
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "tool-call" as const,
                toolCallId: undefined as unknown as string,
                toolName: "test_tool",
                args: { key: "value" },
                argsText: '{"key":"value"}',
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(
          messages as unknown as ThreadMessageLike[]
        );

        expect(result).toHaveLength(1);
        const msg = result[0] as { tool_calls?: Array<{ type: string }> };
        expect(msg.tool_calls).toBeDefined();
        expect(msg.tool_calls?.[0].type).toBe("function");
      });

      it("should handle tool call with undefined toolCallId and result", () => {
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "tool-call" as const,
                toolCallId: undefined as unknown as string,
                toolName: "test_tool",
                args: { key: "value" },
                argsText: '{"key":"value"}',
                result: "test result",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(
          messages as unknown as ThreadMessageLike[]
        );

        expect(result).toHaveLength(2);
        expect(result[1].role).toBe("tool");
        expect(result[1].content).toBe("test result");
      });

      it("should handle assistant message with string content (no tool calls)", () => {
        const messages: ThreadMessageLike[] = [
          { role: "assistant", content: "" },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toEqual([{ role: "assistant", content: "" }]);
      });

      it("should handle multiple tool calls in one message", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_1",
                toolName: "tool_a",
                args: {},
                argsText: "{}",
                result: "result_a",
              },
              {
                type: "tool-call",
                toolCallId: "tool_2",
                toolName: "tool_b",
                args: {},
                argsText: "{}",
                result: "result_b",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toHaveLength(3);
        expect(result[0].role).toBe("assistant");
        expect(result[1].role).toBe("tool");
        expect(result[2].role).toBe("tool");
      });

      it("should handle mixed text and tool-call content", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Let me check" },
              {
                type: "tool-call",
                toolCallId: "tool_123",
                toolName: "get_weather",
                args: {},
                argsText: "{}",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        // Mixed content: text is kept in content, tool-call goes to tool_calls
        expect(result).toHaveLength(1);
        const content = result[0].content as unknown as Array<{ type: string }>;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe("text");
        const msg = result[0] as { tool_calls?: Array<{ type: string }> };
        expect(msg.tool_calls).toBeDefined();
        expect(msg.tool_calls?.[0].type).toBe("function");
      });

      it("should handle tool call with falsy argsText", () => {
        const messages: ThreadMessageLike[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_123",
                toolName: "test_tool",
                args: { key: "value" },
                argsText: "",
              },
            ],
          },
        ];

        const result = convertMessagesToModelFormat(messages);

        expect(result).toHaveLength(1);
        const msg = result[0] as {
          tool_calls?: Array<{ function: { arguments: string } }>;
        };
        expect(msg.tool_calls?.[0].function.arguments).toBe("");
      });

      it("should handle content that is not an array when processing assistant message", () => {
        const message: ThreadMessageLike = {
          role: "assistant",
          content: "string content",
        };

        const result = convertMessagesToModelFormat([message]);

        expect(result).toEqual([
          { role: "assistant", content: "string content" },
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
