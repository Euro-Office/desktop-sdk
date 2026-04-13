import {
  ActionBarPrimitive,
  MessagePrimitive,
  useMessage,
} from "@assistant-ui/react";
import { motion } from "framer-motion";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/button";
import { Dialog, DialogContent } from "../../../components/dialog";
import { DropdownMenu } from "../../../components/dropdown";
import { FileItem } from "../../../components/file-item";
import { IconButton } from "../../../components/icon-button";
import { Input } from "../../../components/input";
import { MarkdownText } from "../../../components/markdown";
import { TooltipIconButton } from "../../../components/tooltip-icon-button";
import { useDirection } from "../../../hooks/useDirection";
import { cn } from "../../../lib/utils";
import { useStores } from "../../../store/context";
import type { TAttachmentFile } from "../../../types";
import { PROMPT_DIALOG_CLASS } from "./ComposerActionPrompts";

type NewFolderDialogProps = {
  messageText: string;
  onClose: VoidFunction;
};

const NewFolderDialog = ({ messageText, onClose }: NewFolderDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { usePromptsStore } = useStores();
  const { addFolder, addPrompt } = usePromptsStore();
  const [folderName, setFolderName] = useState(t("NewFolder"));

  const onSave = useCallback(() => {
    if (!folderName.trim()) return;
    const folderId = addFolder(folderName.trim());
    addPrompt(messageText, folderId);
    onClose();
  }, [folderName, onClose, addFolder, addPrompt, messageText]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("NewAIPromptFolder")}
        onClose={onClose}
        className={PROMPT_DIALOG_CLASS}
      >
        <form
          className="flex flex-col justify-between h-full"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <div className="py-[32px]">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full h-[36px]"
              autoFocus
            />
          </div>
          <div
            className={cn(
              "flex items-center gap-[8px] h-[64px] mx-[-24px] px-[24px]",
              isRTL ? "flex-row-reverse justify-end" : "flex-row justify-end"
            )}
          >
            <Button variant="default" onClick={onClose} className="h-[36px]">
              {t("Cancel")}
            </Button>
            <Button
              onClick={onSave}
              disabled={!folderName.trim()}
              className="h-[36px]"
            >
              {t("Save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UserActionBar = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const { usePromptsStore } = useStores();
  const { addPrompt, folders } = usePromptsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isNewFolderDialogVisible, setIsNewFolderDialogVisible] =
    useState(false);

  const getMessageText = () =>
    message.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

  return (
    <>
      <ActionBarPrimitive.Root className="col-start-2 mt-1 flex justify-end gap-[8px]">
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
        <DropdownMenu
          open={isOpen}
          onOpenChange={setIsOpen}
          trigger={
            <IconButton
              iconName="more"
              size={20}
              isActive={isOpen}
              insideElement
            />
          }
          items={[
            {
              text: t("SaveAIPrompt"),
              onClick: () => {
                addPrompt(getMessageText());
              },
            },
            {
              text: t("SaveAIPromptToTable"),
              onClick: () => {
                // TODO
              },
              subMenuClassName: "w-[225px]",
              subMenu: [
                ...folders.map((folder) => ({
                  text: folder.name,
                  onClick: () => {
                    addPrompt(getMessageText(), folder.id);
                  },
                })),
                ...(folders.length > 0
                  ? [{ text: "", isSeparator: true, onClick: () => undefined }]
                  : []),
                {
                  text: t("NewFolder"),
                  trailingIcon: "btn-zoomup",
                  trailingIconSize: 16,
                  onClick: () => {
                    setIsNewFolderDialogVisible(true);
                  },
                },
              ],
            },
          ]}
          side="bottom"
          align="end"
        />
      </ActionBarPrimitive.Root>
      {isNewFolderDialogVisible ? (
        <NewFolderDialog
          messageText={getMessageText()}
          onClose={() => setIsNewFolderDialogVisible(false)}
        />
      ) : null}
    </>
  );
};

export const UserMessage = memo(() => {
  const message = useMessage();
  const { isRTL } = useDirection();

  const images = message.content
    .filter((item) => item.type === "image")
    .map((item) => item.image);

  const files: TAttachmentFile[] = message.content
    .filter((item) => item.type === "file")
    .map((item) => {
      return {
        type: JSON.parse(item.mimeType).type,
        content: item.data,
        path: JSON.parse(item.mimeType).path,
      };
    });

  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        dir={isRTL ? "rtl" : "ltr"}
        className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-1 px-[var(--thread-padding-x)] py-4 [&:where(>*)]:col-start-2"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="user"
      >
        {images.length > 0 || files.length > 0 ? (
          <div className="col-span-full col-start-1 row-start-1 mb-[8px] overflow-x-auto">
            <div className="flex flex-row gap-[8px] w-max justify-end ms-auto">
              {images.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-[72px] w-[72px] rounded-[8px] object-cover"
                />
              ))}
              {files.map((file) => (
                <FileItem key={file.path} file={file} withoutClose />
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "bg-[var(--chat-user-message-background)] text-[var(--chat-user-message-color)] col-start-2 break-words rounded-[16px] px-[12px] py-[8px]",
            isRTL ? "rounded-bl-[0px]" : "rounded-br-[0px]"
          )}
        >
          <MessagePrimitive.Content
            components={{ Text: MarkdownText, Image: () => null }}
          />
        </div>

        <UserActionBar />
      </motion.div>
    </MessagePrimitive.Root>
  );
});
