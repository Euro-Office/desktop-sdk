import { describe, expect, it } from "vitest";
import {
  createCompleteToolContent,
  createIncompleteToolContent,
  extractContentBeforeToolCall,
  extractToolCallJson,
  handleToolCall,
  hasToolCallTag,
  isToolCallComplete,
  parseToolCallJson,
} from "../handlers";
import { END_TOOL_TAG, START_TOOL_TAG } from "../utils";

describe("ollama handlers", () => {
  describe("handleToolCall", () => {
    describe("no tool call", () => {
      it("should return content unchanged when no tool tag present", () => {
        const content = "Hello, how can I help you?";

        const result = handleToolCall(content);

        expect(result).toEqual({ content });
        expect(result.toolContent).toBeUndefined();
      });

      it("should handle empty string", () => {
        const result = handleToolCall("");

        expect(result).toEqual({ content: "" });
        expect(result.toolContent).toBeUndefined();
      });

      it("should handle content with special characters", () => {
        const content = 'Here\'s some code: { "key": "value" }';

        const result = handleToolCall(content);

        expect(result).toEqual({ content });
      });
    });

    describe("incomplete tool call (streaming)", () => {
      it("should return incomplete tool content when only start tag present", () => {
        const toolJson = '{"name": "test_tool", "args": {"key": "val';
        const content = `Some text${START_TOOL_TAG}${toolJson}`;

        const result = handleToolCall(content);

        expect(result.content).toBe("Some text");
        expect(result.toolContent).toEqual({
          type: "tool-call",
          toolCallId: "",
          toolName: "",
          args: {},
          argsText: toolJson,
        });
      });

      it("should handle start tag with empty content after", () => {
        const content = `Hello${START_TOOL_TAG}`;

        const result = handleToolCall(content);

        expect(result.content).toBe("Hello");
        expect(result.toolContent).toEqual({
          type: "tool-call",
          toolCallId: "",
          toolName: "",
          args: {},
          argsText: "",
        });
      });

      it("should handle content with only start tag (no text before)", () => {
        const toolJson = '{"name": "tool"';
        const content = `${START_TOOL_TAG}${toolJson}`;

        const result = handleToolCall(content);

        expect(result.content).toBe("");
        expect(result.toolContent?.argsText).toBe(toolJson);
      });
    });

    describe("complete tool call", () => {
      it("should parse complete tool call with name and args", () => {
        const toolJson = '{"name": "get_weather", "args": {"city": "NYC"}}';
        const content = `Let me check the weather${START_TOOL_TAG}${toolJson}${END_TOOL_TAG}`;

        const result = handleToolCall(content);

        expect(result.content).toBe("Let me check the weather");
        expect(result.toolContent).toEqual({
          type: "tool-call",
          toolCallId: "",
          toolName: "get_weather",
          args: { city: "NYC" },
          argsText: toolJson,
        });
      });

      it("should handle tool call with empty args", () => {
        const toolJson = '{"name": "list_files", "args": {}}';
        const content = `${START_TOOL_TAG}${toolJson}${END_TOOL_TAG}`;

        const result = handleToolCall(content);

        expect(result.content).toBe("");
        expect(result.toolContent).toEqual({
          type: "tool-call",
          toolCallId: "",
          toolName: "list_files",
          args: {},
          argsText: toolJson,
        });
      });

      it("should handle tool call with complex nested args", () => {
        const toolJson =
          '{"name": "create_file", "args": {"path": "/test.txt", "options": {"overwrite": true}}}';
        const content = `Creating file${START_TOOL_TAG}${toolJson}${END_TOOL_TAG}`;

        const result = handleToolCall(content);

        expect(result.toolContent?.toolName).toBe("create_file");
        expect(result.toolContent?.args).toEqual({
          path: "/test.txt",
          options: { overwrite: true },
        });
      });

      it("should handle tool call with text after end tag", () => {
        const toolJson = '{"name": "test", "args": {}}';
        const content = `Before${START_TOOL_TAG}${toolJson}${END_TOOL_TAG}After`;

        const result = handleToolCall(content);

        // Note: current implementation only returns content before start tag
        expect(result.content).toBe("Before");
        expect(result.toolContent?.toolName).toBe("test");
      });
    });

    describe("edge cases", () => {
      it("should handle multiple start tags (splits on all occurrences)", () => {
        // Note: split() splits on ALL occurrences, so content between first two tags is captured
        const content = `Text${START_TOOL_TAG}first${START_TOOL_TAG}second`;

        const result = handleToolCall(content);

        expect(result.content).toBe("Text");
        // split(START_TOOL_TAG)[1] returns content between first and second tag
        expect(result.toolContent?.argsText).toBe("first");
      });

      it("should handle whitespace in tool JSON", () => {
        const toolJson = `{
          "name": "test_tool",
          "args": {
            "key": "value"
          }
        }`;
        const content = `${START_TOOL_TAG}${toolJson}${END_TOOL_TAG}`;

        const result = handleToolCall(content);

        expect(result.toolContent?.toolName).toBe("test_tool");
        expect(result.toolContent?.args).toEqual({ key: "value" });
      });

      it("should handle tool call with array args", () => {
        const toolJson = '{"name": "process", "args": {"items": [1, 2, 3]}}';
        const content = `${START_TOOL_TAG}${toolJson}${END_TOOL_TAG}`;

        const result = handleToolCall(content);

        expect(result.toolContent?.args).toEqual({ items: [1, 2, 3] });
      });
    });
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  describe("hasToolCallTag", () => {
    it("should return true when content has start tag", () => {
      expect(hasToolCallTag(`text${START_TOOL_TAG}more`)).toBe(true);
    });

    it("should return false when content has no start tag", () => {
      expect(hasToolCallTag("plain text")).toBe(false);
    });
  });

  describe("isToolCallComplete", () => {
    it("should return true when both tags present", () => {
      const content = `${START_TOOL_TAG}json${END_TOOL_TAG}`;
      expect(isToolCallComplete(content)).toBe(true);
    });

    it("should return false when only start tag present", () => {
      const content = `${START_TOOL_TAG}json`;
      expect(isToolCallComplete(content)).toBe(false);
    });

    it("should return false when no tags present", () => {
      expect(isToolCallComplete("plain text")).toBe(false);
    });
  });

  describe("extractContentBeforeToolCall", () => {
    it("should extract text before start tag", () => {
      const content = `Hello world${START_TOOL_TAG}tool`;
      expect(extractContentBeforeToolCall(content)).toBe("Hello world");
    });

    it("should return empty string when tag at start", () => {
      const content = `${START_TOOL_TAG}tool`;
      expect(extractContentBeforeToolCall(content)).toBe("");
    });
  });

  describe("extractToolCallJson", () => {
    it("should extract JSON for complete tool call", () => {
      const json = '{"name":"test"}';
      const content = `text${START_TOOL_TAG}${json}${END_TOOL_TAG}`;
      expect(extractToolCallJson(content, true)).toBe(json);
    });

    it("should extract partial JSON for incomplete tool call", () => {
      const partial = '{"name":"test';
      const content = `text${START_TOOL_TAG}${partial}`;
      expect(extractToolCallJson(content, false)).toBe(partial);
    });
  });

  describe("parseToolCallJson", () => {
    it("should parse valid JSON", () => {
      const result = parseToolCallJson('{"name":"test","args":{"a":1}}');
      expect(result).toEqual({ name: "test", args: { a: 1 } });
    });

    it("should return null for invalid JSON", () => {
      expect(parseToolCallJson("{invalid")).toBeNull();
    });

    it("should default missing fields", () => {
      const result = parseToolCallJson("{}");
      expect(result).toEqual({ name: "", args: {} });
    });
  });

  describe("createCompleteToolContent", () => {
    it("should create tool content with parsed data", () => {
      const result = createCompleteToolContent(
        { name: "test_tool", args: { key: "value" } },
        '{"key":"value"}'
      );

      expect(result).toEqual({
        type: "tool-call",
        toolCallId: "",
        toolName: "test_tool",
        args: { key: "value" },
        argsText: '{"key":"value"}',
      });
    });
  });

  describe("createIncompleteToolContent", () => {
    it("should create incomplete tool content", () => {
      const result = createIncompleteToolContent('{"partial');

      expect(result).toEqual({
        type: "tool-call",
        toolCallId: "",
        toolName: "",
        args: {},
        argsText: '{"partial',
      });
    });
  });
});
