import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import type { TMCPItem } from "@/lib/types";
import {
  convertMessagesToModelFormat,
  convertToolsToModelFormat,
} from "../utils";

describe("convertToolsToModelFormat", () => {
  it("should convert MCP tools to function declarations", () => {
    const tools: TMCPItem[] = [
      {
        name: "get_weather",
        description: "Get weather for a city",
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
    expect(result[0].name).toBe("get_weather");
    expect(result[0].description).toBe("Get weather for a city");
    expect(result[0].parameters).toEqual({
      type: "OBJECT",
      properties: {
        city: { type: "string" },
      },
      required: ["city"],
    });
  });

  it("should handle empty tools array", () => {
    const result = convertToolsToModelFormat([]);
    expect(result).toEqual([]);
  });
});

describe("convertMessagesToModelFormat", () => {
  it("should convert user message", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "user",
        content: "Hello",
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].parts).toEqual([{ text: "Hello" }]);
  });

  it("should convert assistant text message", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "Hi there" }],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("model");
    expect(result[0].parts).toEqual([{ text: "Hi there" }]);
  });

  it("should convert tool call without thought_signature", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_123",
            toolName: "get_data",
            args: { id: 1 },
          },
        ],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("model");
    expect(result[0].parts).toHaveLength(1);

    const part = result[0]?.parts?.[0] as { functionCall: { name: string } };
    expect(part.functionCall.name).toBe("get_data");
  });

  it("should include thought_signature in function call when present", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_123",
            toolName: "search",
            args: { query: "test" },
            // Simulate stored thought_signature in metadata
            metadata: { thoughtSignature: "sig_abc123" },
          } as unknown as ThreadMessageLike["content"] extends (infer T)[]
            ? T
            : never,
        ],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    const part = result[0]?.parts?.[0] as {
      functionCall: { name: string };
      thoughtSignature?: string;
    };
    expect(part.functionCall.name).toBe("search");
    expect(part.thoughtSignature).toBe("sig_abc123");
  });

  it("should convert tool call with result to function response", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_123",
            toolName: "get_data",
            args: { id: 1 },
            result: { data: "success" },
          },
        ],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    // Should have model message with function call and user message with function response
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("model");
    expect(result[1].role).toBe("user");

    const responsePart = result[1]?.parts?.[0] as {
      functionResponse: { name: string; response: unknown };
    };
    expect(responsePart.functionResponse.name).toBe("get_data");
    expect(responsePart.functionResponse.response).toEqual({
      result: { data: "success" },
    });
  });

  it("should handle system message as user role", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "system",
        content: "You are a helpful assistant",
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });

  it("should convert user message with array content", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Check this file" },
          {
            type: "file",
            mimeType: JSON.stringify({ path: "/path/to/file.txt" }),
            data: "file contents here",
          } as unknown as ThreadMessageLike["content"] extends (infer T)[]
            ? T
            : never,
        ],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    expect(result[0]?.parts).toHaveLength(2);
    expect(result[0]?.parts?.[0]).toEqual({ text: "Check this file" });
    expect((result[0]?.parts?.[1] as { text: string }).text).toContain(
      "File: file.txt"
    );
    expect((result[0]?.parts?.[1] as { text: string }).text).toContain(
      "file contents here"
    );
  });

  it("should handle Windows file paths", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            mimeType: JSON.stringify({ path: "C:\\Users\\test\\doc.txt" }),
            data: "windows file",
          } as unknown as ThreadMessageLike["content"] extends (infer T)[]
            ? T
            : never,
        ],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect((result[0]?.parts?.[0] as { text: string }).text).toContain(
      "File: doc.txt"
    );
  });

  it("should handle assistant message with empty string content", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: "",
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    // Empty string content should not create any parts
    expect(result).toHaveLength(0);
  });

  it("should handle assistant message with non-empty string content", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: "Hello there",
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("model");
    expect(result[0].parts).toEqual([{ text: "Hello there" }]);
  });

  it("should skip unknown content part types", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Valid text" },
          {
            type: "unknown-type",
          } as unknown as ThreadMessageLike["content"] extends (infer T)[]
            ? T
            : never,
        ],
      },
    ];

    const result = convertMessagesToModelFormat(messages);

    // Should only have one part (the text part)
    expect(result[0]?.parts).toHaveLength(1);
    expect(result[0]?.parts?.[0]).toEqual({ text: "Valid text" });
  });
});
