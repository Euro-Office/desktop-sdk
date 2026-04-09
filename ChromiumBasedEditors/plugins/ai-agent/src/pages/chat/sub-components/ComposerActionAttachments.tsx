import React from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "@/components/dropdown";
import type { DropDownItemProps } from "@/components/dropdown-item/DropDownItem.types";
import { IconButton } from "@/components/icon-button";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import {
  isDjVu,
  isDocument,
  isPdf,
  isPdfForm,
  isPresentation,
  isSpreadsheet,
  isVisio,
  isXps,
} from "@/lib/utils";
import useAttachmentsStore from "@/store/useAttachmentsStore";
import useProfilesStore from "@/store/useProfilesStore.ts";
import useServersStore from "@/store/useServersStore";

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

  const { addAttachmentFile, addAttachmentImage } = useAttachmentsStore();
  const { servers, changeToolStatus, webSearchEnabled, getWebSearchEnabled } =
    useServersStore();
  const { extendedThinking, toggleExtendedThinking } = useProfilesStore();

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const selectRecentFile = (path: string, type: number) => {
    const isSpreadsheetFile = isSpreadsheet(type);
    window.AscDesktopEditor.convertFileExternal(
      path,
      isSpreadsheetFile ? 260 : 69,
      (data, error) => {
        if (error) {
          console.log("Error:", error);
          return;
        }

        const uint8Array = new Uint8Array(data.content);
        const textDecoder = new TextDecoder("utf-8");
        const stringData = textDecoder.decode(uint8Array);

        addAttachmentFile({ path, content: stringData, type });
      }
    );
  };

  const selectLocalFile = () => {
    window.AscDesktopEditor.OpenFilenameDialog("", true, (file) => {
      if (Array.isArray(file)) {
        file.forEach((file, index) => {
          if (index > 5) return;

          const type = window.AscDesktopEditor.getOfficeFileType(file);

          const isSpreadsheetFile = isSpreadsheet(type);

          window.AscDesktopEditor.convertFileExternal(
            file,
            isSpreadsheetFile ? 260 : 69,
            (data, error) => {
              if (error) {
                console.log("Error:", error);
                return;
              }

              const uint8Array = new Uint8Array(data.content);
              const textDecoder = new TextDecoder("utf-8");
              const stringData = textDecoder.decode(uint8Array);

              addAttachmentFile({
                path: file,
                content: stringData || "",
                type,
              });
            }
          );
        });
      }
    });
  };

  const recentFiles = (
    JSON.parse(
      window.AscDesktopEditor?.callToolFunction("recent_files_reader") ?? "{}"
    ) as { files: { path: string; type: number; url: string }[] }
  )?.files
    ?.filter((file) => !file.url)
    ?.map((file) => {
      const iconName = getFileIconName(file.type);

      return {
        text: file.path.includes("\\")
          ? (file.path.split("\\").pop() ?? "")
          : (file.path.split("/").pop() ?? ""),
        key: file.path,
        id: file.path,
        icon: <IconButton iconName={iconName} size={24} disableHover noColor />,
        onClick: () => selectRecentFile(file.path, file.type),
      };
    })
    .filter(Boolean);

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

  const items: DropDownItemProps[] = [
    { text: t("AddLocalFile"), onClick: () => selectLocalFile() },
    {
      text: t("AddLocalImage"),
      onClick: () => imageInputRef.current?.click(),
    },
  ];

  if (recentFiles.length > 0) {
    items.push({
      text: t("RecentFiles"),
      onClick: () => {
        // ignore
      },
      subMenu: recentFiles,
    });
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
      window.dispatchEvent(new CustomEvent("tools-changed"));
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
