import React from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "@/components/dropdown";
import { IconButton } from "@/components/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { useDirection } from "@/hooks/useDirection";
import type { TProvider } from "@/lib/types";
import { cn } from "@/lib/utils";
import useProviders from "@/store/useProviders";
import { DeleteProviderDialog } from "./DeleteProviderDialog";
import { EditProviderDialog } from "./EditProviderDialog";

type ProviderItemProps = {
  provider: TProvider;
};

const ProviderItem = ({ provider }: ProviderItemProps) => {
  const { providersModels } = useProviders();
  const { isRTL } = useDirection();

  const [editProviderVisible, setEditProviderVisible] = React.useState(false);
  const [deleteProviderVisible, setDeleteProviderVisible] =
    React.useState(false);

  const [containerElement, setContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const containerRef = React.useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  const { t } = useTranslation();

  const hasModels = !!providersModels.get(provider.name)?.length;

  return (
    <>
      <div
        className={cn(
          "flex justify-between gap-[12px] px-[16px] py-[12px] min-w-[274px] max-w-[312px] flex-1 rounded-[8px] bg-[var(--ai-provider-item-background-color)] shadow-[var(--ai-provider-item-shadow)]",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <div
            className={cn(
              "flex items-center gap-[4px]",
              isRTL ? "flex-row-reverse" : "flex-row"
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="font-normal text-[14px] leading-[20px] text-[var(--ai-provider-item-color)] truncate w-fit">
                  {provider.name}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom">{provider.name}</TooltipContent>
            </Tooltip>
            {!hasModels && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <IconButton
                      iconName="status.error"
                      size={16}
                      disableHover
                      noColor
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("NoModelsAvailable")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p
            className={cn(
              "text-[12px] leading-[14px] text-[var(--ai-provider-item-description-color)]",
              isRTL ? "text-end" : ""
            )}
          >
            {provider.type}
            <br />
            {provider.baseUrl}
          </p>
        </div>
        <div className="flex items-center justify-end" ref={containerRef}>
          <DropdownMenu
            onOpenChange={setIsOpen}
            trigger={<IconButton iconName="more" size={20} isActive={isOpen} />}
            items={[
              {
                icon: (
                  <IconButton
                    iconName="btn-edit"
                    size={20}
                    disableHover
                    isStroke
                  />
                ),
                text: t("Edit"),
                onClick: () => setEditProviderVisible(true),
              },
              {
                text: "",
                onClick: () => {
                  // ignore
                },
                isSeparator: true,
              },
              {
                icon: (
                  <IconButton iconName="btn-remove" size={20} disableHover />
                ),
                text: t("Delete"),
                onClick: () => setDeleteProviderVisible(true),
              },
            ]}
            side={isRTL ? "left" : "right"}
            align={isRTL ? "end" : "start"}
            sideOffset={0}
            containerRef={containerElement}
          />
        </div>
      </div>
      {editProviderVisible ? (
        <EditProviderDialog
          name={provider.name}
          onClose={() => setEditProviderVisible(false)}
        />
      ) : null}
      {deleteProviderVisible ? (
        <DeleteProviderDialog
          name={provider.name}
          onClose={() => setDeleteProviderVisible(false)}
        />
      ) : null}
    </>
  );
};

export { ProviderItem };
