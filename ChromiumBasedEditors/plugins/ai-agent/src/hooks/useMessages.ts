import type {
  AppendMessage,
  FileMessagePart,
  ImageMessagePart,
  ThreadMessageLike,
} from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import { createMessage, updateMessage } from "@/database/messages";
import { getThread } from "@/database/metadata";
import { provider, type SendMessageReturnType } from "@/providers";
import server from "@/servers";
import useAttachmentsStore from "@/store/useAttachmentsStore";
import useMessageStore from "@/store/useMessageStore";
import useModelsStore from "@/store/useModelsStore";
import useProviders from "@/store/useProviders";
import useServersStore from "@/store/useServersStore";
import useThreadsStore from "@/store/useThreadsStore";

type UseMessagesProps = {
  isReady: boolean;
};

const useMessages = ({ isReady }: UseMessagesProps) => {
  const {
    messages,
    setIsStreamRunning,
    setIsRequestRunning,
    addMessage,

    updateLastMessage,
    fetchPrevMessages,
  } = useMessageStore();
  const { threadId, insertThread, insertNewMessageToThread } =
    useThreadsStore();
  const {
    manageToolData,
    callTools,
    checkAllowAlways,
    setAllowAlways,
    setManageToolData,
  } = useServersStore();
  const {
    attachmentFiles,
    clearAttachmentFiles,
    attachmentImages,
    clearAttachmentImages,
  } = useAttachmentsStore();
  const { currentProvider } = useProviders();
  const { currentModel, extendedThinking } = useModelsStore();

  const threadIdRef = useRef(threadId);

  useEffect(() => {
    if (!isReady) return;

    threadIdRef.current = threadId;

    fetchPrevMessages(threadId);
    clearAttachmentFiles();
  }, [threadId, isReady, fetchPrevMessages, clearAttachmentFiles]);

  const convertMessage = (message: ThreadMessageLike) => {
    return message;
  };

  const approveToolCall = (allowAlways: boolean) => {
    if (!manageToolData) return;

    const toolCall = manageToolData?.message?.content[manageToolData.idx];

    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const toolName = toolCall.toolName;

    const type = server.getServerType(toolName);
    const name = toolName.replace(`${type}_`, "");

    if (allowAlways) {
      setAllowAlways(true, type, name);
    }

    handleToolCall(
      manageToolData.message,
      manageToolData.idx,
      manageToolData.messageUID,
      true,
      false
    );

    setManageToolData(undefined);
  };

  const denyToolCall = () => {
    if (!manageToolData) return;

    handleToolCall(
      manageToolData.message,
      manageToolData.idx,
      manageToolData.messageUID,
      false,
      true
    );

    setManageToolData(undefined);
  };

  const handleToolCall = async (
    msg: ThreadMessageLike,
    idx: number,
    messageUID: string,
    accept?: boolean,
    deny?: boolean
  ) => {
    const toolCall = msg.content[idx];

    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const toolName = toolCall.toolName;

    const type = server.getServerType(toolName);
    const name = toolName.replace(`${type}_`, "");

    if (checkAllowAlways(type, name) || accept || deny) {
      const result = deny
        ? "User deny tool call"
        : await callTools(
            toolCall.toolName,
            toolCall.args as Record<string, unknown>
          );

      // Create a new content array with the updated tool call
      const updatedContent = Array.isArray(msg.content)
        ? msg.content.map((item, index) =>
            index === idx ? { ...toolCall, result } : item
          )
        : msg.content;

      // Create a new message object with updated content
      const updatedMessage = { ...msg, content: updatedContent };

      updateLastMessage(updatedMessage);
      updateMessage(messageUID, updatedMessage);

      if (!provider) return;

      const streamAfterToolCall = provider.sendMessageAfterToolCall(
        updatedMessage,
        extendedThinking
      );

      if (streamAfterToolCall) {
        handleStream(streamAfterToolCall, true, messageUID);
      }
    } else {
      setManageToolData({
        message: msg,
        idx,
        messageUID,
      });
    }
  };

  const handleStream = async (
    stream: SendMessageReturnType,
    afterToolCall?: boolean,
    messageUIDProp?: string
  ) => {
    setIsStreamRunning(true);
    let initedMessage = !!afterToolCall;
    const messageUID =
      afterToolCall && messageUIDProp ? messageUIDProp : crypto.randomUUID();

    if (messages)
      for await (const message of stream) {
        if ("isEnd" in message) {
          if (threadIdRef.current !== threadId) {
            setIsStreamRunning(false);
            setIsRequestRunning(false);

            return;
          }
          if (message.responseMessage.status?.type === "incomplete") {
            addMessage(message.responseMessage);

            setIsStreamRunning(false);
            setIsRequestRunning(false);

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
              handleToolCall(lastMessage, toolCallIdx, messageUID);

              return;
            }
          }

          setIsStreamRunning(false);
          setIsRequestRunning(false);

          return;
        }

        if (!initedMessage) {
          if (!afterToolCall) setIsRequestRunning(true);
          addMessage(message);
          createMessage(threadId, messageUID, message);
          initedMessage = true;
        } else {
          updateMessage(messageUID, message);

          if (threadIdRef.current === threadId) {
            updateLastMessage(message);
          }
        }
      }
  };

  const onNew = async (message: AppendMessage) => {
    if (!provider) return;
    if (!currentProvider || !currentModel) return;
    if (message.content[0].type !== "text") return;

    let fileContent: FileMessagePart[] = [];

    let imageContent: ImageMessagePart[] = [];

    if (attachmentFiles.length > 0) {
      fileContent = attachmentFiles.map((file) => ({
        type: "file",
        mimeType: JSON.stringify({ path: file.path, type: file.type }),
        data: file.content,
      }));

      clearAttachmentFiles();
    }

    if (attachmentImages.length > 0) {
      imageContent = attachmentImages.map((image) => ({
        type: "image",
        image: image.base64,
        name: image.name,
      }));

      clearAttachmentImages();
    }

    const content: ThreadMessageLike["content"] = [
      ...fileContent,
      ...imageContent,
      { type: "text", text: message.content[0].text },
    ];

    const userMessage: ThreadMessageLike = {
      role: "user",
      content,
      attachments: message.attachments,
    };

    const existingThread = await getThread(threadId);

    if (!existingThread) {
      let textForTitle = "";

      for (const msg of messages) {
        // Skip messages with errors
        if (msg.status?.type === "incomplete" && msg.status?.error) continue;

        textForTitle +=
          typeof msg.content === "string"
            ? msg.content
            : msg.content[0].type === "text"
              ? msg.content[0].text
              : "";

        textForTitle += "\n\n";
      }

      textForTitle += `\n\n${message.content[0].text}`;

      // Save all messages from the store to the database (skip error messages)
      for (const msg of messages) {
        // Skip messages with errors
        if (msg.status?.type === "incomplete" && msg.status?.error) continue;

        await createMessage(threadId, crypto.randomUUID(), msg);
      }

      // Save the new user message
      await createMessage(threadId, crypto.randomUUID(), userMessage);

      provider.createChatName(textForTitle).then(async (title) => {
        if (!title) return;

        insertThread(title, {
          provider: currentProvider,
          model: currentModel,
        });
      });
    } else {
      insertNewMessageToThread({
        provider: currentProvider,
        model: currentModel,
      });

      const createMessages = async () => {
        await createMessage(threadId, crypto.randomUUID(), userMessage);
      };

      createMessages();
    }

    addMessage(userMessage);

    const stream = provider.sendMessage([userMessage], extendedThinking);

    if (stream) handleStream(stream);
  };

  return {
    convertMessage,
    onNew,
    handleStream,
    approveToolCall,
    denyToolCall,
  };
};

export default useMessages;
