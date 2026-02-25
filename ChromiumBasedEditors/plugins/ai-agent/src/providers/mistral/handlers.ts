import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  CompletionEvent,
  DeltaMessage,
} from "@mistralai/mistralai/models/components";

export const handleToolCall = (
  delta: DeltaMessage,
  responseMessage: ThreadMessageLike
): ThreadMessageLike => {
  if (!delta.toolCalls?.length) return responseMessage;

  const toolCall = delta.toolCalls[0];
  const toolCallId = toolCall.id || "";
  const toolCallArgs = toolCall.function?.arguments || "{}";
  const toolCallContent: ThreadMessageLike["content"] = [
    {
      type: "tool-call",
      toolCallId,
      toolName: toolCall.function?.name || "",
      args:
        typeof toolCallArgs === "string"
          ? JSON.parse(toolCallArgs)
          : toolCallArgs,
      argsText:
        typeof toolCallArgs === "string"
          ? toolCallArgs
          : JSON.stringify(toolCallArgs),
      result: "",
      parentId: toolCallId,
    },
  ];

  if (typeof responseMessage.content !== "string") {
    return {
      ...responseMessage,
      content: [...responseMessage.content, ...toolCallContent],
    };
  }

  return responseMessage;
};

export const handleTextContent = (
  delta: DeltaMessage,
  responseMessage: ThreadMessageLike
): ThreadMessageLike => {
  if (
    typeof delta?.content !== "string" ||
    typeof responseMessage.content === "string"
  ) {
    return responseMessage;
  }

  const content = delta.content;
  const lastContent = responseMessage.content.at(-1);

  if (lastContent && lastContent.type === "text") {
    return {
      ...responseMessage,
      content: [
        ...responseMessage.content.slice(0, -1),
        { ...lastContent, text: lastContent.text + content },
      ],
    };
  }

  return {
    ...responseMessage,
    content: [...responseMessage.content, { type: "text", text: content }],
  };
};

export const getChoiceFromEvent = (
  event: CompletionEvent
): CompletionEvent["data"]["choices"][number] | undefined => {
  return event.data?.choices?.[0];
};
