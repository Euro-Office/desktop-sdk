import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  AssistantMessage,
  Messages,
  Tool,
  ToolMessage,
  UserMessage,
} from "@mistralai/mistralai/models/components";
import type { TMCPItem } from "@/lib/types";

export const convertToolsToModelFormat = (tools: TMCPItem[]): Tool[] => {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
};

export const convertMessagesToModelFormat = (
  messages: ThreadMessageLike[]
): Messages[] => {
  const result: Messages[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      const content: UserMessage["content"] = [];
      const toolContent: ToolMessage = { content: null };
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((attachment) => {
          if (attachment.type === "file") {
            content.push({
              type: "text",
              text: `File: ${attachment.name}: ${attachment.content}`,
            });
          }

          if (attachment.type === "image") {
            content.push({
              type: "text",
              text: `Image: ${attachment.name}: ${attachment.content}`,
            });
          }
        });
      }

      if (typeof msg.content === "string") {
        content.push({ type: "text", text: msg.content });
      } else {
        msg.content.forEach((part) => {
          if (part.type === "text") {
            content.push({ type: "text", text: part.text });
          }

          if (part.type === "tool-call") {
            toolContent.content = part.result || null;
            toolContent.name = part.toolName;
            toolContent.toolCallId = part.toolCallId;
          }

          if (part.type === "image") {
            content.push({
              type: "text",
              text: `Image: ${part.filename}: ${part.image}`,
            });
          }

          if (part.type === "file") {
            content.push({
              type: "text",
              text: `File: ${part.filename}: ${part.data}`,
            });
          }
        });
      }

      result.push({
        role: "user",
        content,
      });

      if (toolContent.content) {
        result.push({
          role: "tool",
          ...toolContent,
        });
      }
      continue;
    }

    if (msg.role === "assistant") {
      const content: AssistantMessage["content"] = [];
      const toolCalls: AssistantMessage["toolCalls"] = [];
      if (typeof msg.content === "string") {
        content.push({ type: "text", text: msg.content });
      } else {
        msg.content.forEach((part) => {
          if (part.type === "text") {
            content.push({ type: "text", text: part.text });
          }

          if (part.type === "reasoning") {
            content.push({
              type: "thinking",
              thinking: [{ type: "text", text: part.text }],
            });
          }

          if (part.type === "tool-call") {
            toolCalls.push({
              type: "function",
              id: part.parentId,
              function: {
                name: part.toolName,
                arguments:
                  part.argsText || part.args ? JSON.stringify(part.args) : "",
              },
            });
          }
        });
      }

      result.push({
        role: "assistant",
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    }
  }

  return result;
};
