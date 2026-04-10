import type {
  FileMessagePart,
  ImageMessagePart,
  ThreadMessageLike,
} from "@assistant-ui/react";
import type { TAttachmentFile, TAttachmentImage } from "../types";
import type { SendMessageReturnType } from "../providers";
import { getProviderInstance } from "../providers/provider-holder";
import { getStorageInstance } from "../storage/storage-holder";
import { getServersInstance } from "../tools/tools-holder";

// --- Event types ---

export type ChatEvent =
  | { type: "message-start"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-delta"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-end"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-incomplete"; message: ThreadMessageLike }
  | {
      type: "tool-call-pending";
      message: ThreadMessageLike;
      idx: number;
      messageUID: string;
    }
  | {
      type: "thread-title";
      title: string;
      profileId?: string;
    };

export type ToolCallData = {
  message: ThreadMessageLike;
  idx: number;
  messageUID: string;
};

// --- ChatEngine ---

export class ChatEngine {
  async *sendMessage(params: {
    text: string;
    threadId: string;
    files?: TAttachmentFile[];
    images?: TAttachmentImage[];
    existingMessages: ThreadMessageLike[];
    extendedThinking: boolean;
    profileId?: string;
  }): AsyncGenerator<ChatEvent> {
    const fileContent: FileMessagePart[] = (params.files ?? []).map(
      (file) => ({
        type: "file",
        mimeType: JSON.stringify({ path: file.path, type: file.type }),
        data: file.content,
      })
    );

    const imageContent: ImageMessagePart[] = (params.images ?? []).map(
      (image) => ({
        type: "image",
        image: image.base64,
        name: image.name,
      })
    );

    const content: ThreadMessageLike["content"] = [
      ...fileContent,
      ...imageContent,
      { type: "text", text: params.text },
    ];

    const userMessage: ThreadMessageLike = {
      role: "user",
      content,
    };

    const storage = getStorageInstance();
    const existingThread = await storage.threads.getById(params.threadId);

    if (!existingThread) {
      let textForTitle = "";
      for (const msg of params.existingMessages) {
        if (msg.status?.type === "incomplete" && msg.status?.error) continue;
        textForTitle +=
          typeof msg.content === "string"
            ? msg.content
            : msg.content[0].type === "text"
              ? msg.content[0].text
              : "";
        textForTitle += "\n\n";
      }
      textForTitle += `\n\n${params.text}`;

      for (const msg of params.existingMessages) {
        if (msg.status?.type === "incomplete" && msg.status?.error) continue;
        await storage.messages.create(
          params.threadId,
          crypto.randomUUID(),
          msg
        );
      }

      await storage.messages.create(
        params.threadId,
        crypto.randomUUID(),
        userMessage
      );

      getProviderInstance()
        .createChatName(textForTitle)
        .then(async (title) => {
          if (!title) return;
          // Notify the caller to create the thread
          this._pendingTitle = { title, profileId: params.profileId };
        });
    } else {
      storage.threads.touch(params.threadId, {
        ...(params.profileId !== undefined
          ? { profileId: params.profileId }
          : {}),
      });
      storage.messages.create(
        params.threadId,
        crypto.randomUUID(),
        userMessage
      );
    }

    const stream = getProviderInstance().sendMessage(
      [userMessage],
      params.extendedThinking
    );

    if (stream) {
      yield* this._processStream(stream, params.threadId, false);
    }

    // Yield title event if generated
    if (this._pendingTitle) {
      yield {
        type: "thread-title" as const,
        title: this._pendingTitle.title,
        profileId: this._pendingTitle.profileId,
      };
      this._pendingTitle = null;
    }
  }

  async *approveToolCall(
    data: ToolCallData,
    allowAlways: boolean,
    extendedThinking: boolean
  ): AsyncGenerator<ChatEvent> {
    const toolCall = data.message.content[data.idx];
    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const toolName = toolCall.toolName;
    const type = getServersInstance().getServerType(toolName);
    const name = toolName.replace(`${type}_`, "");

    if (allowAlways) {
      getServersInstance().setAllowAlways(true, type, name);
    }

    yield* this._executeToolCall(
      data.message,
      data.idx,
      data.messageUID,
      extendedThinking,
      false
    );
  }

  async *denyToolCall(
    data: ToolCallData,
    extendedThinking: boolean
  ): AsyncGenerator<ChatEvent> {
    yield* this._executeToolCall(
      data.message,
      data.idx,
      data.messageUID,
      extendedThinking,
      true
    );
  }

  stop(): void {
    getProviderInstance().stopMessage();
  }

  // --- Internal ---

  private _pendingTitle: {
    title: string;
    profileId?: string;
  } | null = null;

  async *handleToolCall(
    msg: ThreadMessageLike,
    idx: number,
    messageUID: string,
    extendedThinking: boolean
  ): AsyncGenerator<ChatEvent> {
    const toolCall = msg.content[idx];
    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const toolName = toolCall.toolName;
    const type = getServersInstance().getServerType(toolName);
    const name = toolName.replace(`${type}_`, "");

    if (getServersInstance().checkAllowAlways(type, name)) {
      yield* this._executeToolCall(
        msg,
        idx,
        messageUID,
        extendedThinking,
        false
      );
    } else {
      yield {
        type: "tool-call-pending" as const,
        message: msg,
        idx,
        messageUID,
      };
    }
  }

  private async *_executeToolCall(
    msg: ThreadMessageLike,
    idx: number,
    messageUID: string,
    extendedThinking: boolean,
    deny: boolean
  ): AsyncGenerator<ChatEvent> {
    const toolCall = msg.content[idx];
    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const result = deny
      ? "User deny tool call"
      : await getServersInstance().callTools(
          getServersInstance().getServerType(toolCall.toolName),
          toolCall.toolName.replace(
            `${getServersInstance().getServerType(toolCall.toolName)}_`,
            ""
          ),
          toolCall.args as Record<string, unknown>
        );

    const updatedContent = Array.isArray(msg.content)
      ? msg.content.map((item, index) =>
          index === idx ? { ...toolCall, result } : item
        )
      : msg.content;

    const updatedMessage = { ...msg, content: updatedContent };

    yield {
      type: "message-delta" as const,
      message: updatedMessage,
      messageUID,
    };
    getStorageInstance().messages.update(messageUID, updatedMessage);

    const streamAfterToolCall =
      getProviderInstance().sendMessageAfterToolCall(
        updatedMessage,
        extendedThinking
      );

    if (streamAfterToolCall) {
      yield* this._processStream(
        streamAfterToolCall,
        "",
        true,
        messageUID
      );
    }
  }

  private async *_processStream(
    stream: SendMessageReturnType,
    threadId: string,
    afterToolCall: boolean,
    messageUIDProp?: string
  ): AsyncGenerator<ChatEvent> {
    let initedMessage = afterToolCall;
    const messageUID =
      afterToolCall && messageUIDProp ? messageUIDProp : crypto.randomUUID();

    for await (const message of stream) {
      if ("isEnd" in message) {
        if (message.responseMessage.status?.type === "incomplete") {
          yield {
            type: "message-incomplete" as const,
            message: message.responseMessage,
          };
          return;
        }

        const lastMessage = message.responseMessage;

        if (
          lastMessage?.role === "assistant" &&
          Array.isArray(lastMessage.content)
        ) {
          const toolCallIdx = lastMessage.content.findIndex(
            (c) => c.type === "tool-call" && !c.result
          );

          if (toolCallIdx !== -1) {
            yield {
              type: "tool-call-pending" as const,
              message: lastMessage,
              idx: toolCallIdx,
              messageUID,
            };
            return;
          }
        }

        yield {
          type: "message-end" as const,
          message: message.responseMessage,
          messageUID,
        };
        return;
      }

      if (!initedMessage) {
        yield {
          type: "message-start" as const,
          message,
          messageUID,
        };
        if (!afterToolCall) {
          getStorageInstance().messages.create(threadId, messageUID, message);
        }
        initedMessage = true;
      } else {
        getStorageInstance().messages.update(messageUID, message);
        yield {
          type: "message-delta" as const,
          message,
          messageUID,
        };
      }
    }
  }
}
