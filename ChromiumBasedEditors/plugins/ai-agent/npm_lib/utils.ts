import type { ThreadMessageLike } from "@assistant-ui/react";

export const convertMessagesToMd = (messages: ThreadMessageLike[]) => {
  let content = "";

  messages.forEach((message) => {
    if (Array.isArray(message.content)) {
      message.content.forEach((part: ThreadMessageLike["content"]) => {
        if (typeof part === "string") {
          content += message.role === "user" ? `## ${part}\n\n` : `${part}\n\n`;
          return;
        }

        if (!part || typeof part !== "object" || !("type" in part)) return;

        if (part.type === "text" && "text" in part) {
          content +=
            message.role === "user"
              ? `## ${part.text}\n\n`
              : `${part.text}\n\n`;
        } else if (part.type === "tool-call" && "toolName" in part) {
          return;
        }
      });
    } else if (typeof message.content === "string") {
      content +=
        message.role === "user"
          ? `## ${message.content}\n\n`
          : `${message.content}\n\n`;
    }
  });

  return content;
};

export const removeSpecialCharacter = (str: string) => {
  return str.replace(/[\\/:*"<>|?]/g, "");
};

export const getMessageTitleFromMd = (md: string) => {
  const lines = md.split("\n");

  const title = lines[0].replace("## ", "");

  return removeSpecialCharacter(title).substring(0, 30);
};
