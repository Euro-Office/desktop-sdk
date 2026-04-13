import { useComposerRuntime } from "@assistant-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/button";
import { Dialog, DialogContent } from "../../../components/dialog";
import { DropdownMenu } from "../../../components/dropdown";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { FieldContainer } from "../../../components/field-container";
import { IconButton } from "../../../components/icon-button";
import { Input } from "../../../components/input";
import { TooltipIconButton } from "../../../components/tooltip-icon-button";
import { useDirection } from "../../../hooks/useDirection";
import { cn } from "../../../lib/utils";
import { useStores } from "../../../store/context";

export const PROMPT_DIALOG_CLASS =
  "!w-[480px] [&>div:last-child]:!px-[24px] [&>div:nth-child(2)]:!h-[52px] [&>div:nth-child(2)]:!ps-[24px] [&>div:nth-child(2)]:!pe-[8px] [&>div:nth-child(2)]:!py-[12px]";

type EditPromptDialogProps = {
  promptId: string;
  initialName: string;
  initialText: string;
  onClose: VoidFunction;
};

const EditPromptDialog = ({
  promptId,
  initialName,
  initialText,
  onClose,
}: EditPromptDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { usePromptsStore } = useStores();
  const { editPrompt } = usePromptsStore();
  const [name, setName] = useState(initialName);
  const [text, setText] = useState(initialText);

  const onSave = useCallback(() => {
    if (!name.trim()) return;
    editPrompt(promptId, { name: name.trim(), text });
    onClose();
  }, [name, text, promptId, onClose, editPrompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("EditAIPrompt")}
        onClose={onClose}
        className={PROMPT_DIALOG_CLASS}
      >
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-col gap-[12px] py-[24px]">
            <FieldContainer header={t("PromptName")}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-[36px]"
                autoFocus
              />
            </FieldContainer>
            <FieldContainer header={t("PromptText")}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                dir={isRTL ? "rtl" : "ltr"}
                className={cn(
                  "w-full min-h-[120px] rounded-[4px] box-border border border-[var(--input-border-color)]",
                  "bg-[var(--input-background-color)] resize-none",
                  "hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
                  "focus:bg-[var(--input-active-background-color)] focus:border focus:border-[var(--input-active-border-color)]",
                  "outline-none",
                  "placeholder:text-[var(--input-placeholder-color)] text-[var(--input-color)]",
                  "px-[12px] py-[8px] text-[14px] leading-[20px] font-normal"
                )}
                spellCheck={false}
              />
            </FieldContainer>
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
              disabled={!name.trim()}
              className="h-[36px]"
            >
              {t("Save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

type RenameFolderDialogProps = {
  folderId: string;
  initialName: string;
  onClose: VoidFunction;
};

const RenameFolderDialog = ({
  folderId,
  initialName,
  onClose,
}: RenameFolderDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { usePromptsStore } = useStores();
  const { renameFolder } = usePromptsStore();
  const [name, setName] = useState(initialName);

  const onSave = useCallback(() => {
    if (!name.trim()) return;
    renameFolder(folderId, name.trim());
    onClose();
  }, [name, folderId, onClose, renameFolder]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("RenameFolder")}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              disabled={!name.trim()}
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

type DeleteFolderDialogProps = {
  folderId: string;
  onClose: VoidFunction;
};

const DeleteFolderDialog = ({ folderId, onClose }: DeleteFolderDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { usePromptsStore } = useStores();
  const { removeFolder } = usePromptsStore();

  const onConfirm = useCallback(() => {
    removeFolder(folderId);
    onClose();
  }, [folderId, onClose, removeFolder]);

  return (
    <Dialog open={true}>
      <DialogContent header={t("Warning")} onClose={onClose} withWarningIcon>
        <div
          className="flex flex-col justify-between h-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onConfirm();
            }
          }}
        >
          <p className="select-none h-[40px] flex items-center text-[12px] leading-[16px] text-[var(--text-normal)]">
            {t("WantDeleteFolder")}
          </p>
          <div
            className={cn(
              "flex items-center gap-[8px] h-[64px] mx-[-24px] px-[24px]",
              isRTL ? "flex-row-reverse justify-end" : "flex-row justify-end"
            )}
          >
            <Button variant="default" onClick={onClose}>
              {t("No")}
            </Button>
            <Button onClick={onConfirm}>{t("Yes")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ComposerActionPrompts = () => {
  const { t } = useTranslation();
  const { usePromptsStore } = useStores();
  const { prompts, folders, editPrompt, removePrompt } = usePromptsStore();
  const composerRuntime = useComposerRuntime();
  const [isOpen, setIsOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{
    id: string;
    name: string;
    text: string;
  } | null>(null);

  const trigger = useMemo(
    () => (
      <TooltipIconButton visible={!isOpen} tooltip={t("SavedPrompts")}>
        <IconButton iconName="btn-prompt" size={24} isActive={isOpen} />
      </TooltipIconButton>
    ),
    [isOpen, t]
  );

  const applyPrompt = useCallback(
    (text: string) => {
      composerRuntime.setText(text);
    },
    [composerRuntime]
  );

  const buildPromptContextMenu = useCallback(
    (prompt: {
      id: string;
      name: string;
      text: string;
      folderId?: string;
    }): DropDownItemProps[] => {
      const moveToFolderItems: DropDownItemProps[] = [
        ...(prompt.folderId
          ? [
              {
                text: t("SavedPrompts"),
                onClick: () => editPrompt(prompt.id, { folderId: null }),
              },
            ]
          : []),
        ...folders
          .filter((f) => f.id !== prompt.folderId)
          .map((folder) => ({
            text: folder.name,
            onClick: () => editPrompt(prompt.id, { folderId: folder.id }),
          })),
      ];

      return [
        {
          text: t("EditAIPrompt"),
          onClick: () => {
            setEditingPrompt({
              id: prompt.id,
              name: prompt.name,
              text: prompt.text,
            });
          },
        },
        ...(moveToFolderItems.length > 0
          ? [
              {
                text: t("MoveToFolder"),
                onClick: () => undefined,
                subMenu: moveToFolderItems,
              },
            ]
          : []),
        {
          text: "",
          isSeparator: true,
          onClick: () => undefined,
        },
        {
          text: t("Delete"),
          onClick: () => removePrompt(prompt.id),
        },
      ];
    },
    [t, folders, editPrompt, removePrompt]
  );

  const items = useMemo(() => {
    const result: DropDownItemProps[] = [];

    const rootPrompts = prompts.filter((p) => !p.folderId);
    for (const prompt of rootPrompts) {
      result.push({
        text: prompt.name,
        onClick: () => applyPrompt(prompt.text),
        subMenu: buildPromptContextMenu(prompt),
        subMenuIcon: "more",
        subMenuIconSize: 20,
      });
    }

    if (rootPrompts.length > 0 && folders.length > 0) {
      result.push({
        text: "",
        isSeparator: true,
        onClick: () => undefined,
      });
    }

    for (const folder of folders) {
      const folderPrompts = prompts.filter((p) => p.folderId === folder.id);
      result.push({
        text: folder.name,
        onClick: () => undefined,
        subMenu: [
          ...folderPrompts.map((prompt) => ({
            text: prompt.name,
            onClick: () => applyPrompt(prompt.text),
            subMenu: buildPromptContextMenu(prompt),
            subMenuIcon: "more",
            subMenuIconSize: 20,
          })),
          ...(folderPrompts.length > 0
            ? [{ text: "", isSeparator: true, onClick: () => undefined }]
            : []),
          {
            text: t("RenameFolder"),
            icon: "btn-rename",
            onClick: () =>
              setRenamingFolder({ id: folder.id, name: folder.name }),
          },
          {
            text: t("DeleteFolder"),
            icon: "btn-remove",
            onClick: () => setDeletingFolderId(folder.id),
          },
        ],
      });
    }

    return result;
  }, [prompts, folders, applyPrompt, buildPromptContextMenu, t]);

  if (prompts.length === 0 && folders.length === 0) return null;

  return (
    <>
      <DropdownMenu
        trigger={trigger}
        items={items}
        onOpenChange={setIsOpen}
        contentClassName="w-[225px]"
      />
      {editingPrompt ? (
        <EditPromptDialog
          promptId={editingPrompt.id}
          initialName={editingPrompt.name}
          initialText={editingPrompt.text}
          onClose={() => setEditingPrompt(null)}
        />
      ) : null}
      {renamingFolder ? (
        <RenameFolderDialog
          folderId={renamingFolder.id}
          initialName={renamingFolder.name}
          onClose={() => setRenamingFolder(null)}
        />
      ) : null}
      {deletingFolderId ? (
        <DeleteFolderDialog
          folderId={deletingFolderId}
          onClose={() => setDeletingFolderId(null)}
        />
      ) : null}
    </>
  );
};

export { ComposerActionPrompts };
