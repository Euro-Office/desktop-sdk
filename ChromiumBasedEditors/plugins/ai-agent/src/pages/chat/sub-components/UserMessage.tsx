import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { motion } from "framer-motion";
import { FileItem } from "@/components/file-item";
import { MarkdownText } from "@/components/markdown";
import { useDirection } from "@/hooks/useDirection";
import type { TAttachmentFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const UserMessage = () => {
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
      </motion.div>
    </MessagePrimitive.Root>
  );
};
