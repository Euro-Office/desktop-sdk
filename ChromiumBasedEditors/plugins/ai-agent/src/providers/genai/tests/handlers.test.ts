import type { ThreadMessageLike } from "@assistant-ui/react";
import type { GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import { createEmptyMessage } from "@/providers/tests/test-utils";
import {
  handleFunctionCall,
  handleTextContent,
  handleThoughtContent,
  processGenAIResponse,
} from "../handlers";

describe("handleThoughtContent", () => {

  it("should return unchanged message for empty text", () => {
    const message = createEmptyMessage();
    const result = handleThoughtContent(message, "");
    expect(result.content).toEqual([]);
  });

  it("should add new reasoning part when content is empty", () => {
    const message = createEmptyMessage();
    const result = handleThoughtContent(message, "Thinking...");
    expect(result.content).toEqual([
      { type: "reasoning", text: "Thinking..." },
    ]);
  });

  it("should append to existing reasoning part", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "First thought" }],
    };
    const result = handleThoughtContent(message, " and more");
    expect(result.content).toEqual([
      { type: "reasoning", text: "First thought and more" },
    ]);
  });

  it("should add new reasoning part after tool-call", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "test_123",
          toolName: "test",
          args: {},
        },
      ],
    };
    const result = handleThoughtContent(message, "New thought");
    expect(result.content).toHaveLength(2);
    expect(result.content[1]).toEqual({
      type: "reasoning",
      text: "New thought",
    });
  });

  it("should add new reasoning part after text part", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "Some text" }],
    };
    const result = handleThoughtContent(message, "Thinking again");
    expect(result.content).toHaveLength(2);
    expect(result.content[1]).toEqual({
      type: "reasoning",
      text: "Thinking again",
    });
  });

  it("should return unchanged message for string content", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: "string content",
    };
    const result = handleThoughtContent(message, "more thought");
    expect(result.content).toBe("string content");
  });

  it("should append multiple chunks to same reasoning part", () => {
    let message = createEmptyMessage();
    message = handleThoughtContent(message, "Let me ");
    message = handleThoughtContent(message, "think about ");
    message = handleThoughtContent(message, "this.");
    expect(message.content).toEqual([
      { type: "reasoning", text: "Let me think about this." },
    ]);
  });
});

describe("handleTextContent", () => {
  it("should return unchanged message for empty text", () => {
    const message = createEmptyMessage();
    const result = handleTextContent(message, "");
    expect(result.content).toEqual([]);
  });

  it("should add new text part when content is empty", () => {
    const message = createEmptyMessage();
    const result = handleTextContent(message, "Hello");
    expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("should append to existing text part", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
    };
    const result = handleTextContent(message, " World");
    expect(result.content).toEqual([{ type: "text", text: "Hello World" }]);
  });

  it("should add new text part after tool-call", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "test_123",
          toolName: "test",
          args: {},
        },
      ],
    };
    const result = handleTextContent(message, "After tool");
    expect(result.content).toHaveLength(2);
    expect(result.content[1]).toEqual({ type: "text", text: "After tool" });
  });

  it("should append multiple chunks to same text part", () => {
    let message = createEmptyMessage();
    message = handleTextContent(message, "I");
    message = handleTextContent(message, "'m sorry");
    message = handleTextContent(message, ", I can't help.");
    expect(message.content).toEqual([
      { type: "text", text: "I'm sorry, I can't help." },
    ]);
  });

  it("should return unchanged message for string content", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: "string content",
    };
    const result = handleTextContent(message, "more text");
    expect(result.content).toBe("string content");
  });
});

describe("handleFunctionCall", () => {
  it("should add function call part", () => {
    const message = createEmptyMessage();
    const result = handleFunctionCall(message, {
      name: "get_weather",
      args: { city: "London" },
    });

    const content = result.content as Array<{
      type: string;
      toolName: string;
      args: unknown;
    }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("tool-call");
    expect(content[0].toolName).toBe("get_weather");
    expect(content[0].args).toEqual({ city: "London" });
  });

  it("should include thought_signature in metadata when provided", () => {
    const message = createEmptyMessage();
    const result = handleFunctionCall(message, {
      name: "search",
      args: { query: "test" },
      thoughtSignature: "sig_abc123",
    });

    expect(result.content).toHaveLength(1);
    const part = result.content[0] as unknown as {
      metadata?: { thoughtSignature: string };
    };
    expect(part.metadata?.thoughtSignature).toBe("sig_abc123");
  });

  it("should not include metadata when thought_signature is not provided", () => {
    const message = createEmptyMessage();
    const result = handleFunctionCall(message, {
      name: "search",
      args: { query: "test" },
    });

    const part = result.content[0] as unknown as {
      metadata?: { thoughtSignature: string };
    };
    expect(part.metadata).toBeUndefined();
  });

  it("should return unchanged message for string content", () => {
    const message: ThreadMessageLike = {
      role: "assistant",
      content: "string content",
    };
    const result = handleFunctionCall(message, {
      name: "test",
      args: {},
    });
    expect(result.content).toBe("string content");
  });
});

describe("processGenAIResponse", () => {
  it("should handle text response", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [{ text: "Hello world" }],
          },
        },
      ],
    } as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("should handle function call response", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "get_data",
                  args: { id: 123 },
                },
              },
            ],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    const content = result.content as unknown as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("tool-call");
  });

  it("should handle function call with thought_signature", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "get_data",
                  args: { id: 123 },
                },
                thoughtSignature: "sig_xyz789",
              },
            ],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    const part = result.content[0] as unknown as {
      metadata?: { thoughtSignature: string };
    };
    expect(part.metadata?.thoughtSignature).toBe("sig_xyz789");
  });

  it("should handle mixed text and function call", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [
              { text: "Let me search for that" },
              {
                functionCall: {
                  name: "search",
                  args: { query: "test" },
                },
              },
            ],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    const content = result.content as unknown as Array<{ type: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe("text");
    expect(content[1].type).toBe("tool-call");
  });

  it("should return unchanged message for empty response", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    expect(result.content).toEqual([]);
  });

  it("should handle function call with missing name and args", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  // name and args are undefined
                },
              },
            ],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    const content = result.content as Array<{
      type: string;
      toolName: string;
      args: unknown;
    }>;
    expect(content).toHaveLength(1);
    expect(content[0].toolName).toBe("");
    expect(content[0].args).toEqual({});
  });

  it("should return unchanged for missing parts", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {},
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    expect(result.content).toEqual([]);
  });

  it("should handle thought content in response", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [{ thought: true, text: "Analyzing the request..." }],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    expect(result.content).toEqual([
      { type: "reasoning", text: "Analyzing the request..." },
      { type: "text", text: "Analyzing the request..." },
    ]);
  });

  it("should handle thought without text", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [{ thought: true }],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    expect(result.content).toEqual([]);
  });

  it("should handle mixed thought and regular text", () => {
    const message = createEmptyMessage();
    const response = {
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "Thinking..." },
              { text: "Here's my response" },
            ],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const result = processGenAIResponse(message, response);
    const content = result.content as Array<{ type: string; text: string }>;
    // When thought is true and text exists, both handleThoughtContent and handleTextContent
    // are called with the same text. This creates:
    // 1. reasoning part from handleThoughtContent
    // 2. text part from handleTextContent (since last part is reasoning)
    // Then the second part's text is appended to the text part
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe("reasoning");
    expect(content[0].text).toBe("Thinking...");
    expect(content[1].type).toBe("text");
    // The text part contains the thought text + the regular text
    expect(content[1].text).toBe("Thinking...Here's my response");
  });
});
