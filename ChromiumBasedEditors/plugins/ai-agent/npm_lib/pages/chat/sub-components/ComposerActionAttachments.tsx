import React from "react";
import { useTranslation } from "react-i18next";
import { usePlatform } from "../../../platform/context";
import { DropdownMenu } from "../../../components/dropdown";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import { IconButton } from "../../../components/icon-button";
import { TooltipIconButton } from "../../../components/tooltip-icon-button";
import { chatEvents } from "../../../events";
import {
  isDjVu,
  isDocument,
  isPdf,
  isPdfForm,
  isPresentation,
  isSpreadsheet,
  isVisio,
  isXps,
} from "../../../lib/utils";
import { useStores } from "../../../store/context";

const getFileIconName = (type: number): string => {
  if (isPdfForm(type)) return "pdf-form";
  if (isPdf(type)) return "pdf";
  if (isDjVu(type)) return "djvu";
  if (isXps(type)) return "xps";
  if (isSpreadsheet(type)) return "spreadsheets";
  if (isDocument(type)) return "documents";
  if (isPresentation(type)) return "presentations";
  if (isVisio(type)) return "visio";
  return "unknown-format";
};

const ComposerActionAttachment = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const platform = usePlatform();
  const { useAttachmentsStore, useServersStore, useProfilesStore } =
    useStores();

  const { addAttachmentFile, addAttachmentImage } = useAttachmentsStore();
  const { servers, changeToolStatus, webSearchEnabled, getWebSearchEnabled } =
    useServersStore();
  const { extendedThinking, toggleExtendedThinking } = useProfilesStore();

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const selectRecentFile = React.useCallback(
    async (path: string, type: number) => {
      if (!platform.file) return;
      const isSpreadsheetFile = isSpreadsheet(type);
      const content = await platform.file.convertFileToText(
        path,
        isSpreadsheetFile ? 260 : 69
      );
      addAttachmentFile({ path, content, type });
    },
    [platform.file, addAttachmentFile]
  );

  const selectLocalFile = async () => {
    if (!platform.file) return;
    const files = await platform.file.pickFiles();
    if (!files) return;

    for (const file of files.slice(0, 6)) {
      const type = platform.file.getFileType(file.path);
      const isSpreadsheetFile = isSpreadsheet(type);
      const content = await platform.file.convertFileToText(
        file.path,
        isSpreadsheetFile ? 260 : 69
      );
      addAttachmentFile({ path: file.path, content: content || "", type });
    }
  };

  const [recentFiles, setRecentFiles] = React.useState<DropDownItemProps[]>([]);

  React.useEffect(() => {
    if (!platform.file) return;

    platform.file.getRecentFiles().then((raw) => {
      try {
        const parsed = JSON.parse(raw) as {
          files: { path: string; type: number; url: string }[];
        };
        const items = parsed?.files
          ?.filter((file) => !file.url)
          ?.map((file) => {
            const iconName = getFileIconName(file.type);
            return {
              text: file.path.includes("\\")
                ? (file.path.split("\\").pop() ?? "")
                : (file.path.split("/").pop() ?? ""),
              key: file.path,
              id: file.path,
              icon: (
                <IconButton
                  iconName={iconName}
                  size={24}
                  disableHover
                  noColor
                />
              ),
              onClick: () => selectRecentFile(file.path, file.type),
            };
          })
          .filter(Boolean);
        setRecentFiles(items ?? []);
      } catch {
        setRecentFiles([]);
      }
    });
  }, [platform.file, selectRecentFile]);

  const { t } = useTranslation();

  const trigger = (
    <TooltipIconButton tooltip={t("Attachments")} visible={!isOpen}>
      <IconButton
        iconName="btn-zoomup"
        size={24}
        className="cursor-pointer rounded-[4px] outline-none"
        isActive={isOpen}
        data-testid="attachment-button"
      />
    </TooltipIconButton>
  );

  const items: DropDownItemProps[] = [];

  if (platform.file) {
    items.push(
      { text: t("AddLocalFile"), onClick: () => selectLocalFile() },
      {
        text: t("AddLocalImage"),
        onClick: () => imageInputRef.current?.click(),
      }
    );

    if (recentFiles.length > 0) {
      items.push({
        text: t("RecentFiles"),
        onClick: () => {
          // ignore
        },
        subMenu: recentFiles,
      });
    }
  }

  items.push({
    text: "",
    onClick: () => {
      // ignore
    },
    isSeparator: true,
  });

  items.push({
    text: t("WebSearch"),
    onClick: () => {
      // ignore
    },
    icon: <IconButton iconName="btn-web-search" size={24} disableHover />,
    withToggle: true,
    toggleChecked: getWebSearchEnabled() ? webSearchEnabled : false,
    toggleDisabled: !getWebSearchEnabled(),
    tooltipText: getWebSearchEnabled() ? "" : t("EnableWebSearch"),
    onToggleChange: () => {
      const webSearchTool = servers["web-search"]?.[0];
      if (!webSearchTool) return;
      changeToolStatus("web-search", webSearchTool.name, !webSearchEnabled);
      chatEvents.emit("tools-changed");
    },
  });

  items.push({
    text: t("ExtendedThinking"),
    icon: (
      <IconButton iconName="btn-extended-thinking" size={24} disableHover />
    ),
    onClick: () => {
      // ignore
    },
    withToggle: true,
    toggleChecked: extendedThinking,
    onToggleChange: toggleExtendedThinking,
    withAbout: true,
    aboutContent: (
      <p className="p-[16px] text-[11px] leading-[16px] text-[var(--text-secondary)]">
        {t("ExtendedThinkingDescription")}
      </p>
    ),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        addAttachmentImage({ name: file.name, base64 });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />
      <DropdownMenu
        trigger={trigger}
        items={items}
        onOpenChange={onOpenChange}
      />
    </>
  );
};

export { ComposerActionAttachment };
