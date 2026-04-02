import React from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "@/components/dropdown";
import { IconButton } from "@/components/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { useDirection } from "@/hooks/useDirection";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { provider } from "@/providers";

type ModelCardProps = {
  profile: Profile;
  onEdit?: () => void;
  onDelete?: () => void;
};

const ModelCard = ({ profile, onEdit, onDelete }: ModelCardProps) => {
  const providerName = provider.getProviderInfo(profile.providerType).name;
  const { isRTL } = useDirection();
  const { t } = useTranslation();

  const [containerElement, setContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const containerRef = React.useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  return (
    <div
      className={cn(
        "flex justify-between gap-[12px] px-[16px] py-[12px] w-full rounded-[var(--model-card-border-radius)] bg-[var(--model-card-background-color)] border border-[var(--model-card-border-color)]",
        isRTL ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[12px] min-w-0 flex-1",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div className="w-[32px] h-[32px] rounded-[var(--model-card-logo-border-radius)] border border-[var(--model-card-logo-border-color)] shrink-0" />
        <div className="flex flex-col overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-normal text-[14px] leading-[20px] text-[var(--model-card-color)] truncate">
                {profile?.name}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom">{profile?.name}</TooltipContent>
          </Tooltip>
          <p
            className={cn(
              "text-[12px] leading-[14px] text-[var(--model-card-description-color)] truncate",
              isRTL ? "text-end" : ""
            )}
          >
            {providerName}
          </p>
        </div>
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
              onClick: () => onEdit?.(),
            },
            {
              text: "",
              onClick: () => {
                // ignore
              },
              isSeparator: true,
            },
            {
              icon: <IconButton iconName="btn-remove" size={20} disableHover />,
              text: t("Delete"),
              onClick: () => onDelete?.(),
            },
          ]}
          side={isRTL ? "left" : "right"}
          align={isRTL ? "end" : "start"}
          sideOffset={0}
          containerRef={containerElement}
        />
      </div>
    </div>
  );
};

export { ModelCard };
