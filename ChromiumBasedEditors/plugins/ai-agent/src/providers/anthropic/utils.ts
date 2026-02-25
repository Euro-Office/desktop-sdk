import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
  ToolUnion,
} from "@anthropic-ai/sdk/resources/index.mjs";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "@/lib/types";

// ============================================================================
// Constants
// ============================================================================

type ImageMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const MIME_TYPE_MAP: Record<string, ImageMimeType> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const DEFAULT_MIME_TYPE: ImageMimeType = "image/jpeg";

// ============================================================================
// Image Helpers
// ============================================================================

const parseDataUrl = (dataUrl: string) => ({
  base64: dataUrl.split(",")[1],
  mimeType: dataUrl.split(";")[0].split(":")[1],
});

const toValidMimeType = (mimeType: string): ImageMimeType =>
  MIME_TYPE_MAP[mimeType] ?? DEFAULT_MIME_TYPE;

const convertImageToBlock = (imageDataUrl: string): ContentBlockParam => {
  const { base64, mimeType } = parseDataUrl(imageDataUrl);

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: toValidMimeType(mimeType),
      data: base64,
    },
  };
};

// export const convertImageAttachmentsToContent = (
//   attachments: readonly CompleteAttachment[]
// ): ContentBlockParam[] =>
//   attachments.flatMap(({ content }) =>
//     content
//       .filter((part) => part.type === "image")
//       .map((part) => convertImageToBlock(part.image))
//   );

// ============================================================================
// Tools Conversion
// ============================================================================

export const convertToolsToModelFormat = (tools: TMCPItem[]): ToolUnion[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      ...tool.inputSchema,
    },
  }));

// ============================================================================
// Message Conversion Helpers
// ============================================================================

type ContentPart = Exclude<ThreadMessageLike["content"], string>[number];

const convertTextPart = (part: ContentPart): ContentBlockParam =>
  part.type === "text"
    ? { type: "text", text: part.text }
    : { type: "text", text: "" };

const convertFilePart = (part: ContentPart): ContentBlockParam => {
  if (part.type !== "file") return { type: "text", text: "" };

  return {
    type: "document",
    source: {
      type: "text",
      media_type: "text/plain",
      data: part.data,
    },
    context: JSON.parse(part.mimeType).path,
  };
};

export const convertImagePart = (part: ContentPart): ContentBlockParam => {
  if (part.type !== "image") return { type: "text", text: "" };

  return convertImageToBlock(part.image);
};

const convertUserContentPart = (part: ContentPart): ContentBlockParam => {
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.type === "file") return convertFilePart(part);
  if (part.type === "image") return convertImagePart(part);

  return { type: "text", text: "" };
};

// ============================================================================
// Message Converters by Role
// ============================================================================

const convertUserMessage = (message: ThreadMessageLike): MessageParam[] => {
  const content: MessageParam["content"] =
    typeof message.content === "string"
      ? message.content
      : message.content.map(convertUserContentPart);

  // if (message.attachments?.length && Array.isArray(content)) {
  //   content.push(...convertImageAttachmentsToContent(message.attachments));
  // }

  return [{ role: "user", content }];
};

const convertSystemMessage = (message: ThreadMessageLike): MessageParam[] => {
  const content: MessageParam["content"] =
    typeof message.content === "string"
      ? message.content
      : message.content.map(convertTextPart);

  return [{ role: "user", content }];
};

const convertAssistantMessage = (
  message: ThreadMessageLike
): MessageParam[] => {
  const result: MessageParam[] = [];

  if (typeof message.content === "string") {
    return [{ role: "assistant", content: message.content || [] }];
  }

  let content: ContentBlockParam[] = [];
  let toolResults: ToolResultBlockParam[] = [];

  for (const part of message.content) {
    if (part.type === "reasoning") {
      content.push({
        type: "thinking",
        thinking: part.text,
        signature: part.parentId ?? "",
      });

      continue;
    }

    if (part.type === "text") {
      content.push({ type: "text", text: part.text });

      continue;
    }

    if (part.type === "tool-call") {
      if (part.result) {
        toolResults.push({
          type: "tool_result",
          content: part.result,
          tool_use_id: part.toolCallId ?? "",
        });
      }

      content.push({
        type: "tool_use",
        id: part.toolCallId ?? "",
        name: part.toolName,
        input: part.args || {},
      });

      result.push({ role: "assistant", content });

      if (toolResults.length) {
        result.push({ role: "user", content: toolResults });
        toolResults = [];
      }

      content = [];
    }
  }

  if (content.length) {
    result.push({ role: "assistant", content });
  }

  return result;
};

// ============================================================================
// Main Export
// ============================================================================

export const convertMessagesToModelFormat = (
  messages: ThreadMessageLike[]
): MessageParam[] =>
  messages.flatMap((message) => {
    if (message.role === "user") return convertUserMessage(message);
    if (message.role === "system") return convertSystemMessage(message);

    return convertAssistantMessage(message);
  });
