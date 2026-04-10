import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  cn,
  convertMessagesToMd,
  getMessageTitleFromMd,
  isDesktopEditor,
  isDjVu,
  isDocument,
  isExternalProcessAvailable,
  isPdf,
  isPdfForm,
  isPresentation,
  isSpreadsheet,
  isVisio,
  isXps,
  removeSpecialCharacter,
  sanitizeProviderName,
} from "../utils";

describe("convertMessagesToMd", () => {
  it("returns empty string for empty array", () => {
    expect(convertMessagesToMd([])).toBe("");
  });

  it("wraps user text content in ## heading", () => {
    const messages: ThreadMessageLike[] = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];
    expect(convertMessagesToMd(messages)).toBe("## Hello\n\n");
  });

  it("outputs assistant text content as plain text", () => {
    const messages: ThreadMessageLike[] = [
      { role: "assistant", content: [{ type: "text", text: "Hi there" }] },
    ];
    expect(convertMessagesToMd(messages)).toBe("Hi there\n\n");
  });

  it("handles string content in array", () => {
    const messages: ThreadMessageLike[] = [
      { role: "user", content: "plain string" },
    ];
    expect(convertMessagesToMd(messages)).toBe("## plain string\n\n");
  });

  it("skips tool-call content parts", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Before tool" },
          {
            type: "tool-call",
            toolCallId: "1",
            toolName: "test",
            args: {},
          },
          { type: "text", text: "After tool" },
        ],
      },
    ];
    expect(convertMessagesToMd(messages)).toBe("Before tool\n\nAfter tool\n\n");
  });

  it("handles multiple messages with mixed roles", () => {
    const messages: ThreadMessageLike[] = [
      { role: "user", content: [{ type: "text", text: "Question" }] },
      { role: "assistant", content: [{ type: "text", text: "Answer" }] },
      { role: "user", content: [{ type: "text", text: "Follow up" }] },
    ];
    expect(convertMessagesToMd(messages)).toBe(
      "## Question\n\nAnswer\n\n## Follow up\n\n"
    );
  });

  it("handles string content parts in array for assistant", () => {
    const messages: ThreadMessageLike[] = [
      // @ts-expect-error — testing runtime behavior with string parts in array
      { role: "assistant", content: ["raw string part"] },
    ];
    expect(convertMessagesToMd(messages)).toBe("raw string part\n\n");
  });

  it("handles string content parts in array for user", () => {
    const messages: ThreadMessageLike[] = [
      // @ts-expect-error — testing runtime behavior with string parts in array
      { role: "user", content: ["user string"] },
    ];
    expect(convertMessagesToMd(messages)).toBe("## user string\n\n");
  });

  it("skips null/undefined/non-object parts", () => {
    const messages: ThreadMessageLike[] = [
      // @ts-expect-error — testing runtime safety
      { role: "assistant", content: [null, undefined, 42] },
    ];
    expect(convertMessagesToMd(messages)).toBe("");
  });

  it("skips unknown content part types", () => {
    const messages: ThreadMessageLike[] = [
      {
        role: "assistant",
        // @ts-expect-error — testing runtime behavior with unknown type
        content: [{ type: "image", url: "http://example.com" }],
      },
    ];
    expect(convertMessagesToMd(messages)).toBe("");
  });

  it("handles assistant string content (not array)", () => {
    const messages: ThreadMessageLike[] = [
      { role: "assistant", content: "assistant string" },
    ];
    expect(convertMessagesToMd(messages)).toBe("assistant string\n\n");
  });
});

describe("removeSpecialCharacter", () => {
  it("removes backslash, slash, colon, asterisk, quotes, angle brackets, pipe, question mark", () => {
    expect(removeSpecialCharacter('a\\b/c:d*e"f<g>h|i?j')).toBe("abcdefghij");
  });

  it("returns same string if no special chars", () => {
    expect(removeSpecialCharacter("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(removeSpecialCharacter("")).toBe("");
  });
});

describe("getMessageTitleFromMd", () => {
  it("extracts title from first line removing ## prefix", () => {
    expect(getMessageTitleFromMd("## Hello World\n\nBody")).toBe("Hello World");
  });

  it("truncates to 30 characters", () => {
    const long = `## ${"a".repeat(50)}\n\nBody`;
    expect(getMessageTitleFromMd(long)).toHaveLength(30);
  });

  it("removes special characters from title", () => {
    expect(getMessageTitleFromMd('## Hello "World"')).toBe("Hello World");
  });
});

describe("sanitizeProviderName", () => {
  it("delegates to removeSpecialCharacter", () => {
    expect(sanitizeProviderName('My Provider: "test"')).toBe(
      "My Provider test"
    );
  });
});

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });
});

describe("isDesktopEditor", () => {
  it("returns false in node environment", () => {
    expect(isDesktopEditor()).toBe(false);
  });
});

describe("isExternalProcessAvailable", () => {
  it("returns false in node environment", () => {
    expect(isExternalProcessAvailable()).toBe(false);
  });
});

// File type detection utilities — host-specific but pure functions
describe("file type detection", () => {
  it("isDocument detects document type via bitmask 0x40", () => {
    expect(isDocument(0x40)).toBe(true);
    expect(isDocument(0x41)).toBe(true);
    expect(isDocument(0x00)).toBe(false);
  });

  it("isPresentation detects presentation type via bitmask 0x80", () => {
    expect(isPresentation(0x80)).toBe(true);
    expect(isPresentation(0x00)).toBe(false);
  });

  it("isSpreadsheet detects spreadsheet type via bitmask 0x0100", () => {
    expect(isSpreadsheet(0x0100)).toBe(true);
    expect(isSpreadsheet(0x00)).toBe(false);
  });

  it("isPdf detects PDF types 0x0201 and 0x0209", () => {
    expect(isPdf(0x0201)).toBe(true);
    expect(isPdf(0x0209)).toBe(true);
    expect(isPdf(0x0200)).toBe(false);
  });

  it("isDjVu detects type 0x0203", () => {
    expect(isDjVu(0x0203)).toBe(true);
    expect(isDjVu(0x00)).toBe(false);
  });

  it("isXps detects type 0x0204", () => {
    expect(isXps(0x0204)).toBe(true);
    expect(isXps(0x00)).toBe(false);
  });

  it("isPdfForm detects type 0x0057", () => {
    expect(isPdfForm(0x0057)).toBe(true);
    expect(isPdfForm(0x00)).toBe(false);
  });

  it("isVisio detects visio type via bitmask 0x4000", () => {
    expect(isVisio(0x4000)).toBe(true);
    expect(isVisio(0x00)).toBe(false);
  });
});
