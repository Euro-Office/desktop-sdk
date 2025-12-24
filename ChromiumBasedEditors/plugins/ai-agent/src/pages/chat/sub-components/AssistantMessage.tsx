import {
  ActionBarPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  useMessage,
} from "@assistant-ui/react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { Loader } from "@/components/loader";
import { MarkdownContent } from "@/components/markdown";
import { ToolFallback } from "@/components/tool-fallback";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { convertMessagesToMd, getMessageTitleFromMd } from "@/lib/utils";
import useMessageStore from "@/store/useMessageStore";

const ThinkingMarkdownText = ({ text }: { text: string }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { thinkingContent, responseContent, isThinkingComplete } =
    useMemo(() => {
      // Strip signature comment from content for display
      const stripSignature = (content: string) =>
        content.replace(/<!--sig:[\s\S]*?-->/g, "").trim();

      // Check for complete thinking block first
      const completeMatch = text.match(/<think>([\s\S]*?)<\/think>/);
      if (completeMatch) {
        return {
          thinkingContent: stripSignature(completeMatch[1] || ""),
          responseContent: text.replace(/<think>[\s\S]*?<\/think>\n*/g, ""),
          isThinkingComplete: true,
        };
      }

      // Check for incomplete thinking block (streaming)
      const incompleteMatch = text.match(/<think>([\s\S]*)/);
      if (incompleteMatch) {
        return {
          thinkingContent: stripSignature(incompleteMatch[1] || ""),
          responseContent: "",
          isThinkingComplete: false,
        };
      }

      return {
        thinkingContent: null,
        responseContent: text,
        isThinkingComplete: true,
      };
    }, [text]);

  return (
    <>
      {thinkingContent && (
        <div className="my-[8px] flex w-full flex-col">
          <div
            className="flex items-center gap-[10px] cursor-pointer mb-[8px]"
            onClick={() => setIsCollapsed((val) => !val)}
          >
            {isThinkingComplete ? (
              <Icon name="tool.called" size={16} noColor />
            ) : (
              <Loader size={16} />
            )}
            <span className="text-[14px] font-normal leading-[20px] text-[var(--chat-message-color)] ">
              Thinking
            </span>
            <Icon
              name="arrow.right"
              size={16}
              width={8}
              height={8}
              isStroke
              isTransform={!isCollapsed}
            />
          </div>
          {!isCollapsed && (
            <div className="ps-[26px]">
              <MarkdownContent>{thinkingContent}</MarkdownContent>
            </div>
          )}
        </div>
      )}
      {responseContent && <MarkdownContent>{responseContent}</MarkdownContent>}
    </>
  );
};

const MessageError = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="border border-[var(--chat-message-error-border-color)] rounded-[4px] p-[6px]">
        <ErrorPrimitive.Message className="text-[var(--chat-message-error-color)] text-[14px] leading-[20px] font-normal" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantActionBar = () => {
  const { t } = useTranslation();

  const { isStreamRunning, messages } = useMessageStore();

  const message = useMessage();

  if (message.status?.type === "incomplete" && message.status?.error) return;

  const onDownload = () => {
    const parentMessage = messages[Number(message.parentId)];

    const mdValue = convertMessagesToMd([parentMessage, message]);

    const title = getMessageTitleFromMd(mdValue);

    window.AscDesktopEditor.SaveFilenameDialog(`${title}.docx`, (path) => {
      if (!path) return;

      window.AscDesktopEditor.saveAndOpen(mdValue, 0x5c, path, 0x41, (code) => {
        if (!code) console.log("Conversion error");
      });
    });
  };

  return (
    <ActionBarPrimitive.Root
      hidden={isStreamRunning}
      // autohide="not-last"
      // autohideFloat="single-branch"
      className="col-start-3 row-start-2 ml-3 mt-3 flex gap-[8px]"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip={t("CopyToClipboard")}>
          <MessagePrimitive.If copied>
            <IconButton iconName="checked" size={24} isStroke disabled />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <IconButton iconName="btn-copy" size={24} />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <div>
        <TooltipIconButton tooltip={t("Save")}>
          <IconButton
            iconName="btn-save"
            size={24}
            onClick={onDownload}
            isStroke
          />
        </TooltipIconButton>
      </div>
      {/* <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload> */}
    </ActionBarPrimitive.Root>
  );
};

export const AssistantMessage = () => {
  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        className="relative mx-auto grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] px-[var(--thread-padding-x)] py-4"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="assistant"
      >
        <div className="leading-[20px] text-[14px] col-span-2 col-start-2 row-start-1 ml-4 break-words leading-7 text-[var(--chat-message-color)]">
          <MessagePrimitive.Content
            components={{
              Text: ThinkingMarkdownText,
              tools: { Fallback: ToolFallback },
            }}
          />
          <MessageError />
        </div>

        <AssistantActionBar />
      </motion.div>
    </MessagePrimitive.Root>
  );
};
