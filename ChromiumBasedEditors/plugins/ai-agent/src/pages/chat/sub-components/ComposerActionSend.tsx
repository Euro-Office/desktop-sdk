import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { IconButton } from "@/components/icon-button";
import useMessageStore from "@/store/useMessageStore";
import useModelsStore from "@/store/useModelsStore";
import useProviders from "@/store/useProviders";

const BUTTON_STYLES =
  "rounded-[4px] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-[var(--chat-composer-action-send-background-color)] hover:enabled:bg-[var(--chat-composer-action-send-background-hover-color)] active:enabled:bg-[var(--chat-composer-action-send-background-pressed-color)] disabled:opacity-[0.5]";

const ComposerActionSend = () => {
  const { isStreamRunning } = useMessageStore();
  const { currentModel } = useModelsStore();
  const { currentProvider } = useProviders();

  return isStreamRunning ? (
    <ComposerPrimitive.Cancel asChild>
      <IconButton
        iconName="stop"
        size={24}
        className={BUTTON_STYLES}
        width={12}
        height={12}
        data-testid="stop-button"
      />
    </ComposerPrimitive.Cancel>
  ) : (
    <ThreadPrimitive.If running={false}>
      <ComposerPrimitive.Send
        asChild
        disabled={!currentModel || !currentProvider}
      >
        <IconButton
          iconName="arrow.top"
          size={24}
          width={12}
          height={14}
          color="var(--chat-composer-action-send-color)"
          className={BUTTON_STYLES}
          data-testid="send-button"
        />
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>
  );
};

export { ComposerActionSend };
