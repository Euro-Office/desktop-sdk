import { ComposerPrimitive } from "@assistant-ui/react";
import { useTranslation } from "react-i18next";
import { FileItem } from "@/components/file-item";
import useAttachmentsStore from "@/store/useAttachmentsStore";
import useModelsStore from "@/store/useModelsStore";
import useProviders from "@/store/useProviders";
import { ComposerAction } from "./ComposerAction";

const Composer = () => {
  const { attachmentFiles, attachmentImages } = useAttachmentsStore();
  const { currentProvider } = useProviders();
  const { currentModel } = useModelsStore();
  const { t } = useTranslation();

  return (
    <div className="relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-[8px] px-[var(--thread-padding-x)] pb-[16px]">
      <ComposerPrimitive.Root className="composer-root relative flex w-full flex-col gap-[16px] rounded-[16px] border px-[24px] py-[16px] box-border">
        {attachmentFiles.length || attachmentImages.length ? (
          <div className="flex flex-row gap-[8px] overflow-x-auto">
            {attachmentFiles.map((file) => (
              <FileItem key={file.path} file={file} />
            ))}
            {attachmentImages.map((image) => (
              <FileItem key={image.name} file={image} />
            ))}
          </div>
        ) : null}

        <ComposerPrimitive.Input
          placeholder={t("AskAI")}
          className="composer-input max-h-[calc(50vh)] min-h-[16px] w-full resize-none outline-none"
          rows={1}
          autoFocus
          aria-label="Message input"
          disabled={!currentProvider || !currentModel}
          data-testid="composer-input"
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
      <p className="text-center font-normal text-[12px] leading-[16px] text-[var(--text-tertiary)]">
        {t("CheckInfo")}
      </p>
    </div>
  );
};

export { Composer };
