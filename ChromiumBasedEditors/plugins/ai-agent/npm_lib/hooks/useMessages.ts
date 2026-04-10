import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import type { ChatEvent, ToolCallData } from "../services/chat-engine";
import { useStores } from "../store/context";

type UseMessagesProps = {
  isReady: boolean;
};

const useMessages = ({ isReady }: UseMessagesProps) => {
  const {
    useMessageStore,
    useThreadsStore,
    useServersStore,
    useAttachmentsStore,
    useProfilesStore,
    chatEngine,
    selectCurrentChatProfile,
  } = useStores();

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
  const { manageToolData, setManageToolData } = useServersStore();
  const {
    attachmentFiles,
    clearAttachmentFiles,
    attachmentImages,
    clearAttachmentImages,
  } = useAttachmentsStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const extendedThinking = useProfilesStore((s) => s.extendedThinking);

  const threadIdRef = useRef(threadId);

  useEffect(() => {
    if (!isReady) return;

    threadIdRef.current = threadId;

    fetchPrevMessages(threadId);
    clearAttachmentFiles();
  }, [threadId, isReady, fetchPrevMessages, clearAttachmentFiles]);

  const processEvents = async (events: AsyncGenerator<ChatEvent>) => {
    setIsStreamRunning(true);

    for await (const event of events) {
      switch (event.type) {
        case "message-start":
          setIsRequestRunning(true);
          addMessage(event.message);
          break;

        case "message-delta":
          if (threadIdRef.current === threadId) {
            updateLastMessage(event.message);
          }
          break;

        case "message-end":
          setIsStreamRunning(false);
          setIsRequestRunning(false);
          return;

        case "message-incomplete":
          addMessage(event.message);
          setIsStreamRunning(false);
          setIsRequestRunning(false);
          return;

        case "tool-call-pending": {
          // Try auto-allow first via ChatEngine.handleToolCall
          const innerEvents = chatEngine.handleToolCall(
            event.message,
            event.idx,
            event.messageUID,
            extendedThinking
          );
          let handled = false;
          for await (const innerEvent of innerEvents) {
            if (innerEvent.type === "tool-call-pending") {
              // Not auto-allowed — show UI prompt
              setManageToolData({
                message: innerEvent.message,
                idx: innerEvent.idx,
                messageUID: innerEvent.messageUID,
              });
              handled = true;
            } else {
              await processEvent(innerEvent);
            }
          }
          if (handled) return;
          break;
        }

        case "thread-title":
          insertThread(event.title, { profileId: event.profileId });
          break;
      }
    }

    setIsStreamRunning(false);
    setIsRequestRunning(false);
  };

  const processEvent = async (event: ChatEvent) => {
    switch (event.type) {
      case "message-delta":
        if (threadIdRef.current === threadId) {
          updateLastMessage(event.message);
        }
        break;
      case "message-start":
        addMessage(event.message);
        break;
      case "message-end":
        setIsStreamRunning(false);
        setIsRequestRunning(false);
        break;
      case "message-incomplete":
        addMessage(event.message);
        setIsStreamRunning(false);
        setIsRequestRunning(false);
        break;
      case "tool-call-pending":
        setManageToolData({
          message: event.message,
          idx: event.idx,
          messageUID: event.messageUID,
        });
        break;
      case "thread-title":
        insertThread(event.title, { profileId: event.profileId });
        break;
    }
  };

  const convertMessage = (message: ThreadMessageLike) => {
    return message;
  };

  const approveToolCall = (allowAlways: boolean) => {
    if (!manageToolData) return;

    const data: ToolCallData = {
      message: manageToolData.message,
      idx: manageToolData.idx,
      messageUID: manageToolData.messageUID,
    };

    setManageToolData(undefined);

    const events = chatEngine.approveToolCall(
      data,
      allowAlways,
      extendedThinking
    );
    processEvents(events);
  };

  const denyToolCall = () => {
    if (!manageToolData) return;

    const data: ToolCallData = {
      message: manageToolData.message,
      idx: manageToolData.idx,
      messageUID: manageToolData.messageUID,
    };

    setManageToolData(undefined);

    const events = chatEngine.denyToolCall(data, extendedThinking);
    processEvents(events);
  };

  const onNew = async (message: AppendMessage) => {
    if (!currentProfile) return;
    if (message.content[0].type !== "text") return;

    const files = attachmentFiles.length > 0 ? [...attachmentFiles] : undefined;
    const images =
      attachmentImages.length > 0 ? [...attachmentImages] : undefined;

    if (files) clearAttachmentFiles();
    if (images) clearAttachmentImages();

    addMessage({
      role: "user",
      content: [
        ...(files?.map((f) => ({
          type: "file" as const,
          mimeType: JSON.stringify({ path: f.path, type: f.type }),
          data: f.content,
        })) ?? []),
        ...(images?.map((i) => ({
          type: "image" as const,
          image: i.base64,
          name: i.name,
        })) ?? []),
        { type: "text" as const, text: message.content[0].text },
      ],
    });

    if (
      !useThreadsStore.getState().threads.find((t) => t.threadId === threadId)
    ) {
      // New thread — will be created when title is generated
    } else {
      insertNewMessageToThread({ profileId: currentProfile?.id });
    }

    const events = chatEngine.sendMessage({
      text: message.content[0].text,
      threadId,
      files,
      images,
      existingMessages: messages,
      extendedThinking,
      profileId: currentProfile?.id,
    });

    processEvents(events);
  };

  return {
    convertMessage,
    onNew,
    approveToolCall,
    denyToolCall,
  };
};

export default useMessages;
