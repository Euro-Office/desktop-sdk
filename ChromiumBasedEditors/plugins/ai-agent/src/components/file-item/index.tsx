import { Icon } from "@/components/icon";
import { useDirection } from "@/hooks/useDirection";
import type { TAttachmentFile, TAttachmentImage } from "@/lib/types";
import {
  cn,
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
import { IconButton } from "../icon-button";

type FileItemProps = {
  file: TAttachmentFile | TAttachmentImage;
  withoutClose?: boolean;
};

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

const FileItem = ({ file, withoutClose }: FileItemProps) => {
  const { isRTL } = useDirection();
  const { deleteAttachmentFile, deleteAttachmentImage } = useAttachmentsStore();

  const handleDelete = () => {
    if ("path" in file && file.path) deleteAttachmentFile(file.path);
    if ("name" in file && file.name) deleteAttachmentImage(file.name);
  };

  const name =
    "path" in file
      ? file.path.includes("\\")
        ? (file.path.split("\\").pop() ?? "")
        : (file.path.split("/").pop() ?? "")
      : file.name;
  const extension = name.split(".").pop() ?? "";
  const nameWithoutExtension = name.replace(`.${extension}`, "");

  const fileType = "type" in file ? file.type : 0;
  const iconName = getFileIconName(fileType);

  const isImage = "base64" in file;

  return (
    <div
      className={cn(
        "w-fit flex flex-row items-center gap-[12px] h-[36px] rounded-[8px] box-border border-[var(--file-items-border-color)]",
        isImage ? (isRTL ? "p-0 pl-[4px]" : "p-0 pr-[4px]") : "p-[4px]",
        withoutClose
          ? isRTL
            ? "cursor-pointer pl-[24px]"
            : "cursor-pointer pr-[24px]"
          : "",
        withoutClose
          ? "bg-[var(--file-items-chat-background-color)]"
          : "border bg-[var(--file-items-background-color)]",
        withoutClose
          ? "hover:bg-[var(--file-items-chat-hover-background-color)]"
          : "",
        withoutClose
          ? "active:bg-[var(--file-items-chat-pressed-background-color)]"
          : ""
      )}
      onClick={() => {
        if (!withoutClose || !("path" in file)) return;

        window.AscDesktopEditor.openTemplate(file.path, name);
      }}
    >
      {"base64" in file ? (
        <img
          className={cn(
            "w-[36px] h-[36px]",
            isRTL ? "rounded-r-[8px]" : "rounded-l-[8px]"
          )}
          src={file.base64}
          alt=""
        />
      ) : (
        <div className="flex flex-row items-center h-[24px] gap-[4px]">
          <Icon name={iconName} size={24} noColor />
          <p className="text-[var(--file-items-color)] font-normal text-[14px] leading-[20px] whitespace-nowrap overflow-hidden text-ellipsis">
            {nameWithoutExtension}
            <span className="text-[var(--file-items-ext-color)]">
              .{extension}
            </span>
          </p>
        </div>
      )}

      {!withoutClose ? (
        <IconButton
          iconName="btn-close.small"
          size={16}
          onClick={handleDelete}
        />
      ) : null}
    </div>
  );
};

export { FileItem };
