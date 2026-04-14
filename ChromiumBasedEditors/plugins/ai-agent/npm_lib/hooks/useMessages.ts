import type { AppendMessage } from "@assistant-ui/react";
import { useCallback, useEffect, useRef } from "react";
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
  const extendedThinkingRef = useRef(extendedThinking);

  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    extendedThinkingRef.current = extendedThinking;
  }, [extendedThinking]);

  useEffect(() => {
    if (!isReady) return;

    fetchPrevMessages(threadId);
    clearAttachmentFiles();
  }, [threadId, isReady, fetchPrevMessages, clearAttachmentFiles]);

  const handleEvent = useCallback(
    (event: ChatEvent) => {
      switch (event.type) {
        case "message-start":
          addMessage(event.message);
          break;
        case "message-delta":
          updateLastMessage(event.message);
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
    },
    [
      addMessage,
      updateLastMessage,
      setIsStreamRunning,
      setIsRequestRunning,
      setManageToolData,
      insertThread,
    ]
  );

  const handleEventRef = useRef(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  const processEvents = useCallback(
    async (events: AsyncGenerator<ChatEvent>) => {
      setIsStreamRunning(true);

      for await (const event of events) {
        if (event.type === "message-start") {
          setIsRequestRunning(true);
        }

        if (event.type === "tool-call-pending") {
          // Try auto-allow first via ChatEngine.handleToolCall
          const innerEvents = chatEngine.handleToolCall(
            event.message,
            event.idx,
            event.messageUID,
            extendedThinkingRef.current
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
              handleEventRef.current(innerEvent);
            }
          }
          if (handled) return;
        } else {
          handleEventRef.current(event);
        }
      }

      setIsStreamRunning(false);
      setIsRequestRunning(false);
    },
    [chatEngine, setIsStreamRunning, setIsRequestRunning, setManageToolData]
  );

  const extractToolData = (): ToolCallData | null => {
    if (!manageToolData) return null;
    return {
      message: manageToolData.message,
      idx: manageToolData.idx,
      messageUID: manageToolData.messageUID,
    };
  };

  const approveToolCall = useCallback(
    (allowAlways: boolean) => {
      const data = extractToolData();
      if (!data) return;

      setManageToolData(undefined);

      const events = chatEngine.approveToolCall(
        data,
        allowAlways,
        extendedThinkingRef.current
      );
      processEvents(events);
    },
    [chatEngine, setManageToolData, processEvents]
  );

  const denyToolCall = useCallback(() => {
    const data = extractToolData();
    if (!data) return;

    setManageToolData(undefined);

    const events = chatEngine.denyToolCall(data, extendedThinkingRef.current);
    processEvents(events);
  }, [chatEngine, setManageToolData, processEvents]);

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
    onNew,
    approveToolCall,
    denyToolCall,
  };
};

export default useMessages;
