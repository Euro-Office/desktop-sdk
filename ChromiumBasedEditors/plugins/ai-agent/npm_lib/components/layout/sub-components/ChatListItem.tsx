import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import type { Page } from "../../../store/create-stores";
import type { Thread } from "../../../types";
import { DropdownMenu } from "../../dropdown";
import { Icon } from "../../icon";
import { IconButton } from "../../icon-button";
import { Input } from "../../input";
import { DeleteChatDialog } from "./DeleteChatDialog";

type ChatListItemProps = {
  thread: Thread;
  isActive: boolean;
  onSwitchToThread: (threadId: string) => void;
  onRenameThread: (threadId: string, newTitle: string) => void;
  onDownloadThread: (threadId: string) => void;
  onClearThreadHistory: (threadId: string) => void;
  setCurrentPage: (page: Page) => void;
};

const DownloadIcon = () => <Icon name="btn-save" size={24} isStroke />;
const RenameIcon = () => <Icon name="btn-rename" size={24} />;
const RemoveIcon = () => <Icon name="btn-remove" size={24} />;

const ChatListItemComponent = ({
  thread,
  isActive,
  onSwitchToThread,
  onRenameThread,
  onDownloadThread,
  onClearThreadHistory,
  setCurrentPage,
}: ChatListItemProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isRenameInputVisible, setIsRenameInputVisible] = React.useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] =
    React.useState(false);

  const [newTitle, setNewTitle] = React.useState(thread.title);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { t } = useTranslation();

  // Handle keyboard events for rename input
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isRenameInputVisible) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setIsRenameInputVisible(false);
        setNewTitle(thread.title); // Reset to original title
      } else if (event.key === "Enter") {
        event.preventDefault();
        inputRef.current?.blur(); // This will trigger the onBlur event
      }
    };

    if (isRenameInputVisible) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRenameInputVisible, thread.title]);

  const onSwitchToThreadAction = () => {
    if (isOpen || isRenameInputVisible || isDeleteDialogVisible) return;

    onSwitchToThread(thread.threadId);
    setCurrentPage("chat");
  };

  const onDeleteClick = () => {
    setIsDeleteDialogVisible(true);
    setIsOpen(false);
  };

  const onRenameClick = () => {
    setIsRenameInputVisible(true);
    setIsOpen(false);
  };

  const onClearHistoryClick = () => {
    onClearThreadHistory(thread.threadId);
    setIsOpen(false);
  };

  const onDownloadClick = () => {
    onDownloadThread(thread.threadId);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      key={thread.threadId}
      className={`cursor-pointer rounded-[4px] h-[36px] min-h-[36px] flex items-center justify-between ${
        isRenameInputVisible
          ? ""
          : `px-[12px] ${
              isActive || isOpen
                ? "bg-[var(--chat-list-item-active-background-color)]"
                : "hover:bg-[var(--chat-list-item-hover-background-color)] active:bg-[var(--chat-list-item-active-background-color)]"
            }`
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isOpen) {
          setIsHovered(false);
        }
      }}
      onClick={onSwitchToThreadAction}
    >
      {isRenameInputVisible ? (
        <Input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={() => {
            setIsRenameInputVisible(false);

            if (newTitle) {
              onRenameThread(thread.threadId, newTitle);
            }
          }}
          autoFocus
          className="w-full"
          maxLength={128}
        />
      ) : (
        <>
          <p className="text-[var(--chat-list-item-color)] font-normal text-[14px] leading-[20px] truncate">
            {thread.title}
          </p>
          {isHovered && !isRenameInputVisible ? (
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
                  text: t("Open"),
                  onClick: onSwitchToThreadAction,
                },
                {
                  icon: <DownloadIcon />,
                  text: t("Save"),
                  onClick: onDownloadClick,
                },
                {
                  icon: <RenameIcon />,
                  text: t("Rename"),
                  onClick: onRenameClick,
                },
                {
                  icon: <RemoveIcon />,
                  text: t("Delete"),
                  onClick: onDeleteClick,
                },
                {
                  text: "",
                  isSeparator: true,
                  onClick: () => undefined,
                },
                {
                  text: t("ClearHistory"),
                  onClick: onClearHistoryClick,
                },
              ]}
              side="right"
              align="start"
              sideOffset={0}
              containerRef={containerRef.current}
            />
          ) : null}
        </>
      )}

      {isDeleteDialogVisible ? (
        <DeleteChatDialog
          id={thread.threadId}
          onClose={() => setIsDeleteDialogVisible(false)}
        />
      ) : null}
    </div>
  );
};

const ChatListItem = memo(ChatListItemComponent);
export { ChatListItem };
